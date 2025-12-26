from app.core.config import get_settings
from app.api.dependencies import UserContext


class VannaService:
    def __init__(self):
        self.settings = get_settings()
    
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
                user_context["data_scope"]
            )
        
        # Execute query
        result = await self.execute(sql)
        
        return result
    
    async def generate_sql(self, question: str) -> str:
        """Generate SQL from natural language question."""
        # Implementation detail
        return "SELECT 1"
    
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
        
        # Apply RLS logic here
        # Example: add WHERE clauses based on data_scope
        return sql
    
    async def execute(self, sql: str) -> dict:
        """Execute SQL and return results."""
        # Implementation detail
        return {"result": "ok"}
