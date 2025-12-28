from typing import Any

from app.core.config import get_settings
from app.api.dependencies import UserContext
from app.providers.factory import create_llm_provider, create_db_provider, create_vector_provider
import logging

logger = logging.getLogger(__name__)


class VannaService:
    def __init__(self):
        self.settings = get_settings()
        # Instantiate providers lazily/once for this service
        self.llm = create_llm_provider(self.settings)
        self.db = create_db_provider(self.settings)
        # Vector store is optional in some deployments
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
        Process natural language question.
        
        Args:
            question: User question
            user_context: User context (stable contract)
        
        Returns:
            Query result
        
        Notes:
            - No auth checks inside service
            - RLS applied only if RLS_ENABLED
            - Service doesn't care if user is authenticated
        """
        
        # NOTE: top_k is reserved for future RAG retrieval controls.
        # It is currently accepted for API contract stability.

        # Generate SQL from question
        sql = await self.generate_sql(question)
        
        # 🔓 Apply RLS only if enabled
        if self.settings.RLS_ENABLED:
            sql = self.inject_rls_filters(
                sql,
                user_context.get("data_scope", {})
            )
        
        # Execute query
        result = await self.execute(sql)
        
        return result
    
    async def generate_sql(self, question: str) -> str:
        """Generate SQL from natural language question using configured LLM provider.

        Steps:
        - If a vector store is available, retrieve relevant DDL/docs and include short schema context
          in the prompt to the LLM so it is aware of table names and schema constraints.
        - Sanitize fenced SQL blocks returned by the model.
        - Log the generated SQL for auditing.
        """
        prompt = question
        # If we have a vector provider, query the 'training_data' docs and also the 'ddl' collection
        ctx_parts = []
        if self.vector is not None:
            try:
                # general training_data retrieval (if present)
                try:
                    results = self.vector.query(question, n_results=self.settings.RAG_TOP_K)
                except Exception:
                    results = []

                for doc, meta in results or []:
                    owner = (meta or {}).get('owner') or (meta or {}).get('OWNER') or ''
                    name = (meta or {}).get('name') or (meta or {}).get('NAME') or ''
                    excerpt = (doc or '')[:600]
                    idpart = f"{owner}.{name}" if owner or name else "training_doc"
                    ctx_parts.append(f"{idpart}: {excerpt}")

                # explicit DDL collection lookup (used by scripts/extract_and_ingest_ddl)
                try:
                    ddl_col = getattr(self.vector, 'client', None)
                    if ddl_col is not None:
                        try:
                            col = self.vector.client.get_collection('ddl')
                            ddl_res = col.query(query_texts=[question], n_results=self.settings.RAG_TOP_K)
                            docs = ddl_res.get('documents', [[]])[0]
                            metas = ddl_res.get('metadatas', [[]])[0]
                            for d, m in zip(docs, metas):
                                owner = (m or {}).get('owner') or (m or {}).get('OWNER') or ''
                                name = (m or {}).get('name') or (m or {}).get('NAME') or ''
                                excerpt = (d or '')[:800]
                                idpart = f"{owner}.{name}" if owner or name else "ddl_doc"
                                ctx_parts.append(f"{idpart}: {excerpt}")
                        except Exception:
                            # collection might not exist or query API differs across versions
                            pass
                except Exception:
                    pass

                if ctx_parts:
                    schema_ctx = "\n\n-- SCHEMA CONTEXT (from vector store):\n" + "\n\n".join(ctx_parts)
                    prompt = (
                        f"{schema_ctx}\n\nQuestion: {question}\n\n"
                        "Respond with a single Oracle-compatible SELECT statement only. "
                        "Do not include semicolons, markdown fences, DESCRIBE/SHOW, or any DML/DDL."
                    )
            except Exception as exc:
                logger.warning("Vector store query failed: %s", exc)

        fallback_sql = "SELECT 1 FROM DUAL"

        # Call LLM
        try:
            import asyncio

            sql = await asyncio.wait_for(self.llm.generate_sql(prompt), timeout=5)
            sql_clean = self._sanitize_sql(sql)
            sql_clean = self._oracle_postprocess(sql_clean)
            if not sql_clean:
                raise RuntimeError("Empty SQL after sanitization")
            logger.info("LLM generated SQL: %s", sql_clean)
            return sql_clean
        except Exception as exc:  # pragma: no cover - provider failures
            logger.warning("LLM SQL generation failed (%s)", exc)
            raise

    def _sanitize_sql(self, sql: Any) -> str:
        """Strip markdown fences, leading SQL: prefixes, and trailing semicolons."""
        if not isinstance(sql, str):
            return ""
        sql_clean = sql.strip()
        if "```" in sql_clean:
            try:
                import re
                m = re.search(r"```(?:sql)?\s*(.*?)\s*```", sql_clean, re.S | re.I)
                if m:
                    sql_clean = m.group(1)
            except Exception:
                pass
        if sql_clean.lower().startswith("sql:"):
            sql_clean = sql_clean.split(":", 1)[1].strip()
        sql_clean = sql_clean.replace("\r", " ").replace("\n", " ")
        sql_clean = sql_clean.strip().strip(";").strip()
        return sql_clean

    def _oracle_postprocess(self, sql: str) -> str:
        """Apply simple Oracle-safe rewrites: replace LIMIT with FETCH, add GROUP BY when needed."""
        if not isinstance(sql, str) or not sql:
            return sql
        import re

        rewritten = sql

        # Replace LIMIT n with FETCH FIRST n ROWS ONLY
        m = re.search(r"\sLIMIT\s+(\d+)", rewritten, flags=re.I)
        if m:
            n = m.group(1)
            rewritten = re.sub(r"\sLIMIT\s+\d+", f" FETCH FIRST {n} ROWS ONLY", rewritten, flags=re.I)

        # If SELECT contains aggregates and non-aggregate columns without GROUP BY, add it
        upper_sql = rewritten.upper()
        if "GROUP BY" not in upper_sql:
            select_split = re.split(r"\bFROM\b", rewritten, maxsplit=1, flags=re.I)
            if select_split:
                select_part = select_split[0].replace("SELECT", "", 1)
                cols = [c.strip() for c in select_part.split(",") if c.strip()]
                agg_tokens = ("COUNT(", "SUM(", "AVG(", "MIN(", "MAX(")
                has_agg = any(tok in select_part.upper() for tok in agg_tokens)
                non_agg = [c for c in cols if not any(tok in c.upper() for tok in agg_tokens)]
                if has_agg and non_agg:
                    group_clause = " GROUP BY " + ", ".join(non_agg)
                    if "FETCH FIRST" in upper_sql:
                        rewritten = re.sub(r"\sFETCH\s+FIRST", f"{group_clause} FETCH FIRST", rewritten, flags=re.I)
                    else:
                        rewritten = rewritten + group_clause

        return rewritten
    
    def inject_rls_filters(self, sql: str, data_scope: dict) -> str:
        """
        Inject Row-Level Security filters into SQL.
        
        Args:
            sql: Original SQL query
            data_scope: RLS scope (from user context)
        
        Returns:
            Modified SQL with RLS filters
        """
        if not data_scope:
            return sql
        
        # Apply RLS logic here (simple example: add WHERE owner = :tenant)
        try:
            scope_val = data_scope.get("tenant_id")
            if scope_val and sql.strip().lower().startswith("select"):
                # Naive injection for demonstration (real implementation must be robust)
                if " where " in sql.lower():
                    return sql + f" AND tenant_id = '{scope_val}'"
                return sql + f" WHERE tenant_id = '{scope_val}'"
        except Exception:
            pass
        return sql
    
    async def execute(self, sql: str) -> Any:
        """Execute SQL via configured DB provider and return rows (list of dicts).

        On DB errors, return a dict with `error` key so the orchestration layer can
        surface a meaningful summary to the UI instead of a generic 'ok'.
        """
        try:
            rows = self.db.execute(sql)
            return rows
        except Exception as exc:  # pragma: no cover - external DB failures
            logger.exception("Database execution failed")
            return {"error": str(exc)}

    def referenced_tables(self, sql: str) -> list[tuple]:
        """Return list of (owner, table) tuples referenced in FROM/JOIN clauses."""
        import re

        if not sql:
            return []
        matches = re.findall(r"(?:FROM|JOIN)\s+([\"A-Za-z0-9_\.]+)", sql, re.I)
        out = []
        for m in matches:
            identifier = m.strip().strip('"')
            if "." in identifier:
                owner, tbl = identifier.split(".", 1)
                out.append((owner.upper(), tbl.upper()))
            else:
                out.append(("", identifier.upper()))
        return out
