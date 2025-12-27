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
                    prompt = f"{schema_ctx}\n\nQuestion: {question}\n\nOnly use tables present in the schema context above. Provide a single Oracle-compatible SELECT statement."
            except Exception as exc:
                logger.warning("Vector store query failed: %s", exc)

        fallback_sql = "SELECT 1 FROM DUAL"

        # Call LLM
        try:
            import asyncio

            sql = await asyncio.wait_for(self.llm.generate_sql(prompt), timeout=5)

            # Extract code fence if present
            if isinstance(sql, str) and "```" in sql:
                try:
                    import re
                    m = re.search(r"```(?:sql)?\s*(.*?)\s*```", sql, re.S | re.I)
                    if m:
                        sql = m.group(1)
                except Exception:
                    pass

            sql_clean = (sql or "").strip()
            if not sql_clean:
                logger.warning("LLM returned empty SQL; using fallback")
                return fallback_sql

            logger.info("LLM generated SQL: %s", sql_clean)
            return sql_clean
        except Exception as exc:  # pragma: no cover - provider failures
            logger.warning("LLM SQL generation failed (%s); using fallback", exc)
            return fallback_sql
    
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
