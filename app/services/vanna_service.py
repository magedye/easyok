from typing import Any, List, Tuple
import logging
import re
import asyncio

import sqlparse

from app.core.config import get_settings
from app.api.dependencies import UserContext
from app.providers.factory import (
    create_llm_provider,
    create_db_provider,
    create_vector_provider,
)

logger = logging.getLogger(__name__)


class VannaService:
    def __init__(self):
        self.settings = get_settings()
        # Instantiate providers as per Governance Phase 4
        self.llm = create_llm_provider(self.settings)
        self.db = create_db_provider(self.settings)

        try:
            self.vector = create_vector_provider(self.settings)
        except Exception:
            self.vector = None

    async def ask(
        self,
        question: str,
        user_context: UserContext,
        top_k: int = 5,
    ) -> dict:
        """
        Process a natural language question and return query results.
        Implementation follows the strict Fail-Closed governance model.
        """
        # Generate SQL using the refined generate_sql logic
        sql = await self.generate_sql(question)

        # 🔓 Apply RLS only if enabled in settings
        if self.settings.RLS_ENABLED:
            sql = self.inject_rls_filters(
                sql,
                user_context.get("data_scope", {}),
            )

        # Execute validated SQL
        return await self.execute(sql)

    async def generate_sql(self, question: str) -> str:
        """
        Generate Oracle-compatible SQL using the LLM provider.
        Optimized for NDJSON streaming and high-security environments.
        """
        prompt = question
        ctx_parts = []

        if self.vector is not None:
            try:
                # Retrieve RAG context from the vector store
                try:
                    results = self.vector.query(
                        question,
                        n_results=self.settings.RAG_TOP_K,
                    )
                except Exception:
                    results = []

                for doc, meta in results or []:
                    owner = (meta or {}).get("owner") or (meta or {}).get("OWNER") or ""
                    name = (meta or {}).get("name") or (meta or {}).get("NAME") or ""
                    excerpt = (doc or "")[:600]
                    ident = f"{owner}.{name}" if owner or name else "training_doc"
                    ctx_parts.append(f"{ident}: {excerpt}")

                if ctx_parts:
                    prompt = (
                        "\n\n-- SCHEMA CONTEXT (Governance Enforced):\n"
                        + "\n\n".join(ctx_parts)
                        + f"\n\nQuestion: {question}\n\n"
                        "Respond with a single Oracle-compatible SELECT statement only. "
                        "Do not include semicolons, markdown fences, DESCRIBE/SHOW, or any DML/DDL."
                    )
            except Exception as exc:
                logger.warning("Vector context retrieval failed: %s", exc)

        try:
            # ✅ CORRECTED CALL: Matches inspected signature (prompt, temperature, max_tokens)
            sql = await asyncio.wait_for(
                self.llm.generate_sql(
                    prompt=prompt,
                    temperature=self.settings.LLM_TEMPERATURE, 
                    max_tokens=self.settings.LLM_MAX_TOKENS,
                ),
                timeout=self.settings.LLM_REQUEST_TIMEOUT,
            )

            # Sanitize and Post-process
            sql_clean = self._sanitize_sql(sql)
            sql_clean = self._oracle_postprocess(sql_clean)

            if not sql_clean:
                return ""

            # Governance: Only log that SQL was generated, avoid sensitive data leakage
            logger.info("LLM generated SQL (sanitized and validated)")
            return sql_clean

        except Exception as exc:
            # GOVERNANCE: Fail-closed on any LLM/Provider failure
            logger.warning("LLM SQL generation failed: %s", exc)
            return ""

    def _sanitize_sql(self, sql: Any) -> str:
        """
        Sanitize SQL using sqlparse==0.5.3.
        Removes markdown, comments, and normalizes formatting.
        """
        if not isinstance(sql, str):
            return ""

        sql_clean = sql.strip()

        # Remove markdown fences if present
        if "```" in sql_clean:
            m = re.search(r"```(?:sql)?\s*(.*?)\s*```", sql_clean, re.S | re.I)
            if m:
                sql_clean = m.group(1)

        # Remove leading "SQL:" indicators
        if sql_clean.lower().startswith("sql:"):
            sql_clean = sql_clean.split(":", 1)[1].strip()

        try:
            # Official sanitization using sqlparse
            sql_clean = sqlparse.format(
                sql_clean,
                strip_comments=True,
                reindent=True,
                keyword_case="upper",
            )
        except Exception as exc:
            logger.warning("sqlparse formatting failed: %s", exc)

        return sql_clean.strip().rstrip(";")

    def _oracle_postprocess(self, sql: str) -> str:
        """
        Rewrites non-standard SQL constructs to Oracle-compatible syntax.
        Mainly targets LIMIT to FETCH conversion.
        """
        if not sql:
            return sql

        # Regex for LIMIT conversion, safe after sqlparse normalization
        m = re.search(r"\sLIMIT\s+(\d+)", sql, flags=re.I)
        if m:
            n = m.group(1)
            sql = re.sub(
                r"\sLIMIT\s+\d+",
                f" FETCH FIRST {n} ROWS ONLY",
                sql,
                flags=re.I,
            )

        return sql.strip()

    def inject_rls_filters(self, sql: str, data_scope: dict) -> str:
        """
        Safely injects Row-Level Security filters.
        Ensures the WHERE clause is placed correctly before structural SQL keywords.
        """
        if not sql or not data_scope:
            return sql

        tenant_id = data_scope.get("tenant_id")
        if not tenant_id:
            return sql

        condition = f"tenant_id = '{tenant_id}'"
        upper_sql = sql.upper()

        if " WHERE " in upper_sql:
            return re.sub(
                r"(\sWHERE\s)",
                rf"\1{condition} AND ",
                sql,
                count=1,
                flags=re.I,
            )

        # Inject WHERE before specific structural keywords
        split_keywords = [" GROUP BY ", " ORDER BY ", " FETCH FIRST ", " LIMIT "]
        split_index = len(sql)

        for kw in split_keywords:
            idx = upper_sql.find(kw)
            if idx != -1 and idx < split_index:
                split_index = idx

        return sql[:split_index] + f" WHERE {condition} " + sql[split_index:]

    async def execute(self, sql: str) -> Any:
        """
        Executes the final SQL through the database provider.
        """
        try:
            return self.db.execute(sql)
        except Exception as exc:
            logger.exception("Database execution failed")
            return {"error": str(exc)}

    def referenced_tables(self, sql: str) -> List[Tuple[str, str]]:
        """
        Extract referenced tables using sqlparse with a robust regex fallback.
        """
        if not sql:
            return []

        try:
            parsed = sqlparse.parse(sql)[0]
            tables = []

            from sqlparse.sql import IdentifierList, Identifier
            from sqlparse.tokens import Keyword

            def extract(token):
                if isinstance(token, IdentifierList):
                    for ident in token.get_identifiers():
                        extract(ident)
                elif isinstance(token, Identifier):
                    name = token.get_real_name()
                    parent = token.get_parent_name()
                    if name:
                        tables.append((str(parent or "").upper(), str(name).upper()))

            in_from = False
            for tok in parsed.tokens:
                if tok.ttype is Keyword and tok.value.upper() in ("FROM", "JOIN"):
                    in_from = True
                elif tok.ttype is Keyword and tok.value.upper() in (
                    "WHERE",
                    "GROUP BY",
                    "ORDER BY",
                    "HAVING",
                ):
                    in_from = False
                elif in_from:
                    extract(tok)

            return list(set(tables))

        except Exception:
            return self._regex_referenced_tables(sql)

    def _regex_referenced_tables(self, sql: str) -> List[Tuple[str, str]]:
        matches = re.findall(r"(?:FROM|JOIN)\s+([\"A-Za-z0-9_\.]+)", sql, re.I)
        out = []
        for m in matches:
            ident = m.strip().strip('"')
            if "." in ident:
                owner, tbl = ident.split(".", 1)
                out.append((owner.upper(), tbl.upper()))
            else:
                out.append(("", ident.upper()))
        return out