from __future__ import annotations

import asyncio
import re
from typing import Any, Dict, Optional

import pandas as pd
import sqlparse
from vanna.capabilities.sql_runner import RunSqlToolArgs, SqlRunner
from vanna.core.llm import LlmService
from vanna.core.user import RequestContext, User, UserResolver
from vanna.integrations.google import GeminiLlmService
from vanna.integrations.ollama import OllamaLlmService
from vanna.integrations.openai import OpenAILlmService
from vanna.tools import RunSqlTool, VisualizeDataTool

from app.core.settings import Settings
from app.providers.factory import create_db_provider


class ContextUserResolver(UserResolver):
    """
    Resolve Vanna RequestContext into a minimal User object using metadata carried
    from the API layer. Keeps group memberships aligned with the upstream role.
    """

    async def resolve_user(self, request_context: RequestContext) -> User:
        meta = request_context.metadata or {}
        user_ctx = meta.get("user_context", {}) or {}
        role = user_ctx.get("role", "guest")
        groups = list(user_ctx.get("groups", []))
        if role and role not in groups:
            groups.append(role)

        user_id = user_ctx.get("user_id", "anonymous")
        username = user_ctx.get("username") or user_id
        email = user_ctx.get("email") or f"{user_id}@local"

        return User(
            id=str(user_id),
            username=username,
            email=email,
            group_memberships=groups,
            metadata=user_ctx,
        )


def build_request_context(user_context: Optional[Dict[str, Any]] = None) -> RequestContext:
    """
    Build a Vanna RequestContext that carries the upstream user context inside metadata.
    """
    return RequestContext(
        cookies={},
        headers={},
        remote_addr=None,
        query_params={},
        metadata={"user_context": user_context or {}},
    )


def _format_sql(sql: str, dialect: str, default_limit: int) -> str:
    """
    Sanitize and format SQL using sqlparse (0.5.x) with a dialect-aware LIMIT injector.
    """
    if not isinstance(sql, str) or not sql.strip():
        raise ValueError("SQL text is required")

    cleaned = sql.strip()

    if "```" in cleaned:
        fence_match = re.search(r"```(?:sql)?\\s*(.*?)\\s*```", cleaned, re.S | re.I)
        if fence_match:
            cleaned = fence_match.group(1)

    formatted = sqlparse.format(
        cleaned,
        strip_comments=True,
        reindent=True,
        keyword_case="upper",
    ).strip()

    first_token = formatted.split()[:1]
    if not first_token or first_token[0].upper() not in {"SELECT", "WITH"}:
        raise ValueError("Only SELECT/CTE queries are permitted")

    formatted_no_semicolon = formatted.rstrip(";")
    upper_sql = formatted_no_semicolon.upper()

    has_limit = any(
        marker in upper_sql
        for marker in (" LIMIT ", " FETCH FIRST ", " OFFSET ", " TOP ")
    )
    if default_limit and not has_limit:
        if dialect == "oracle":
            formatted_no_semicolon = f"{formatted_no_semicolon} FETCH FIRST {default_limit} ROWS ONLY"
        elif dialect == "mssql":
            formatted_no_semicolon = re.sub(
                r"^SELECT\\s+",
                f"SELECT TOP {default_limit} ",
                formatted_no_semicolon,
                count=1,
                flags=re.I,
            )
        else:
            formatted_no_semicolon = f"{formatted_no_semicolon} LIMIT {default_limit}"

    return formatted_no_semicolon


class GuardedSqlRunner(SqlRunner):
    """
    SqlRunner implementation that reuses existing DB providers while enforcing
    lightweight governance (read-only SELECT + LIMIT injection).
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.db = create_db_provider(settings)
        self.dialect = settings.VANNA_SQLRUNNER_DIALECT.lower()
        self.default_limit = settings.VANNA_DEFAULT_LIMIT or settings.DEFAULT_ROW_LIMIT
        self._recent: Dict[tuple[str, str], Dict[str, Any]] = {}
        self._by_conversation: Dict[str, Dict[str, Any]] = {}

    async def run_sql(self, args: RunSqlToolArgs, context) -> pd.DataFrame:
        sanitized = _format_sql(
            args.sql,
            dialect=self.dialect,
            default_limit=self.default_limit,
        )

        # Execute in a thread to avoid blocking the event loop with sync drivers.
        rows = await asyncio.to_thread(self.db.execute, sanitized)
        df = pd.DataFrame(rows)

        snapshot = {
            "sql": sanitized,
            "rows": df.to_dict("records"),
            "columns": df.columns.tolist(),
        }
        self._recent[(context.conversation_id, context.request_id)] = snapshot
        self._by_conversation[context.conversation_id] = snapshot
        return df

    def take_snapshot(self, conversation_id: str, request_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if request_id:
            return self._recent.pop((conversation_id, request_id), None)
        return self._by_conversation.pop(conversation_id, None)


class TrackingRunSqlTool(RunSqlTool):
    """
    RunSqlTool that keeps per-request snapshots for service-level response shaping.
    """

    def __init__(self, sql_runner: GuardedSqlRunner):
        super().__init__(sql_runner=sql_runner)
        self.sql_runner = sql_runner

    def take_snapshot(self, conversation_id: str, request_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        return self.sql_runner.take_snapshot(conversation_id, request_id)


class TrackingVisualizeDataTool(VisualizeDataTool):
    """
    VisualizeDataTool wrapper that stores generated chart metadata keyed by request_id.
    """

    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        self._recent_charts: Dict[str, Dict[str, Any]] = {}

    async def execute(self, context, args):
        result = await super().execute(context, args)
        chart = result.metadata.get("chart")
        if chart is not None:
            self._recent_charts[context.request_id] = {
                "chart": chart,
                "metadata": result.metadata,
            }
        return result

    def take_snapshot(self, request_id: str) -> Optional[Dict[str, Any]]:
        return self._recent_charts.pop(request_id, None)


class ConfiguredOpenAILlmService(OpenAILlmService):
    """
    OpenAI LLM service that ensures temperature/max_tokens are propagated.
    """

    def _build_payload(self, request):
        payload = super()._build_payload(request)
        if request.temperature is not None:
            payload["temperature"] = request.temperature
        if request.max_tokens is not None and "max_tokens" not in payload:
            payload["max_tokens"] = request.max_tokens
        return payload


def build_llm_service(settings: Settings) -> LlmService:
    """
    Factory for Vanna-compatible LLM services with temperature/max_tokens bindings.
    """
    provider = settings.VANNA_LLM_PROVIDER.lower()

    if provider == "ollama":
        return OllamaLlmService(
            model=settings.VANNA_LLM_MODEL,
            host=settings.VANNA_LLM_ENDPOINT or settings.OLLAMA_BASE_URL,
            temperature=settings.LLM_TEMPERATURE,
            num_predict=settings.LLM_MAX_TOKENS,
        )

    if provider in {"openai", "openai_compatible", "groq"}:
        api_key = settings.OPENAI_API_KEY or settings.GROQ_API_KEY
        base_url = settings.VANNA_LLM_ENDPOINT or settings.OPENAI_BASE_URL
        if provider == "groq" and not base_url:
            base_url = "https://api.groq.com/openai/v1"

        timeout = settings.GROQ_TIMEOUT if provider == "groq" else settings.OPENAI_TIMEOUT

        return ConfiguredOpenAILlmService(
            model=settings.VANNA_LLM_MODEL or settings.OPENAI_MODEL or settings.GROQ_MODEL,
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
        )

    if provider == "google":
        return GeminiLlmService(
            model=settings.VANNA_LLM_MODEL or settings.GOOGLE_MODEL,
            api_key=settings.GOOGLE_API_KEY,
            temperature=settings.LLM_TEMPERATURE,
        )

    # Default back to OpenAI-compatible path for unknown providers
    return ConfiguredOpenAILlmService(
        model=settings.VANNA_LLM_MODEL or settings.OPENAI_MODEL,
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.VANNA_LLM_ENDPOINT or settings.OPENAI_BASE_URL,
    )
