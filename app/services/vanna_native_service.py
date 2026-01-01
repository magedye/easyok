from __future__ import annotations

import uuid
import math  # ✔️ REQUIRED: for NaN / Infinity checks
from typing import Any, Dict, Optional, List

from vanna import Agent
from vanna.core.agent.config import AgentConfig
from vanna.core.registry import ToolRegistry
from vanna.core.system_prompt import DefaultSystemPromptBuilder
from vanna.core.tool import ToolContext
from vanna.integrations.local.agent_memory.in_memory import DemoAgentMemory
from vanna.servers.base import ChatHandler
from vanna.servers.base.models import ChatRequest
from vanna.tools.agent_memory import (
    SaveQuestionToolArgsTool,
    SaveTextMemoryTool,
    SearchSavedCorrectToolUsesTool,
)

from app.core.config import settings
from app.services.vanna_common import (
    ContextUserResolver,
    TrackingRunSqlTool,
    TrackingVisualizeDataTool,
    build_llm_service,
    build_request_context,
    build_sql_runner,
)

# ============================================================================
# Tier-2 System Prompt
# ============================================================================
TIER2_SYSTEM_PROMPT = """
You are a Senior Data Analyst AI (Tier-2 Native Mode).

RULES:
1. Use ONLY run_sql and visualize_data tools.
2. No web tools, no file I/O.
3. Use Oracle SQL dialect.
4. Retry on ORA- errors.
5. Do not hallucinate.
"""

class VannaNativeService:
    """
    Tier-2 — Vanna Native Service

    - Native Oracle execution
    - Deterministic agent limits
    - JSON-safe output sanitization (bytes + floats)
    """

    def __init__(self) -> None:
        self.settings = settings

        # ------------------------------------------------------------------
        # User + SQL runner
        # ------------------------------------------------------------------
        self.user_resolver = ContextUserResolver()
        self.sql_runner = build_sql_runner(self.settings)
        self.run_sql_tool = TrackingRunSqlTool(self.sql_runner)

        # ------------------------------------------------------------------
        # Tool registry
        # ------------------------------------------------------------------
        registry = ToolRegistry()
        registry.register_local_tool(self.run_sql_tool, [])

        self.visualize_tool: Optional[TrackingVisualizeDataTool] = None
        if self.settings.VANNA_ENABLE_CHARTS:
            self.visualize_tool = TrackingVisualizeDataTool()
            registry.register_local_tool(self.visualize_tool, [])

        # ------------------------------------------------------------------
        # Memory
        # ------------------------------------------------------------------
        memory = self._init_memory()
        if self.settings.VANNA_ENABLE_MEMORY:
            registry.register_local_tool(SaveQuestionToolArgsTool(), [])
            registry.register_local_tool(SearchSavedCorrectToolUsesTool(), [])
            registry.register_local_tool(SaveTextMemoryTool(), [])

        # ------------------------------------------------------------------
        # Agent config (hard stops)
        # ------------------------------------------------------------------
        agent_config = AgentConfig(
            stream_responses=False,
            include_thinking_indicators=True,
            temperature=self.settings.LLM_TEMPERATURE,
            max_tokens=self.settings.LLM_MAX_TOKENS,
            max_iterations=5,
            request_timeout=60,
        )

        # ------------------------------------------------------------------
        # System prompt
        # ------------------------------------------------------------------
        base_prompt = (
            TIER2_SYSTEM_PROMPT
            if self.settings.OPERATION_TIER == "tier2_vanna"
            else self.settings.VANNA_SYSTEM_PROMPT_TEMPLATE
        )

        self.agent = Agent(
            llm_service=build_llm_service(self.settings),
            tool_registry=registry,
            user_resolver=self.user_resolver,
            agent_memory=memory,
            config=agent_config,
            system_prompt_builder=DefaultSystemPromptBuilder(
                base_prompt=base_prompt
            ),
        )

        self.chat_handler = ChatHandler(self.agent)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def ask(
        self,
        question: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        request_context = build_request_context(context)

        chat_request = ChatRequest(
            message=question,
            request_context=request_context,
            metadata={"tier": "vanna_native"},
        )

        response = await self.chat_handler.handle_poll(chat_request)

        snapshot = self.run_sql_tool.take_snapshot(
            request_id=response.request_id
        )

        chart_snapshot = None
        if self.visualize_tool:
            chart_snapshot = self.visualize_tool.take_snapshot(
                request_id=response.request_id
            )

        if not snapshot:
            result = {
                "conversation_id": response.conversation_id,
                "request_id": response.request_id,
                "sql": None,
                "rows": [],
                "columns": [],
                "components": [c.model_dump() for c in response.chunks],
                "chart": chart_snapshot.get("chart") if chart_snapshot else None,
                "memory": {
                    "enabled": self.settings.VANNA_ENABLE_MEMORY,
                    "type": self.settings.VANNA_MEMORY_TYPE,
                },
                "message": "No SQL was executed by the agent",
            }
            return self._sanitize_recursive(result)

        result = {
            "conversation_id": response.conversation_id,
            "request_id": response.request_id,
            "sql": snapshot.get("sql"),
            "rows": snapshot.get("rows", []),
            "columns": snapshot.get("columns", []),
            "components": [c.model_dump() for c in response.chunks],
            "chart": chart_snapshot.get("chart") if chart_snapshot else None,
            "memory": {
                "enabled": self.settings.VANNA_ENABLE_MEMORY,
                "type": self.settings.VANNA_MEMORY_TYPE,
            },
        }

        # ✔️ FINAL FIX: sanitize before FastAPI serialization
        return self._sanitize_recursive(result)

    async def handle_feedback(
        self,
        question: str,
        sql: str,
        rating: int,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        request_context = build_request_context(context)
        user = await self.user_resolver.resolve_user(request_context)

        tool_context = ToolContext(
            user=user,
            conversation_id=uuid.uuid4().hex,
            request_id=uuid.uuid4().hex,
            agent_memory=self.agent.agent_memory,
            metadata={"rating": rating},
        )

        await self.agent.agent_memory.save_tool_usage(
            question=question,
            tool_name="run_sql",
            args={"sql": sql},
            context=tool_context,
            success=rating > 0,
            metadata={"rating": rating},
        )

        await self.agent.agent_memory.save_text_memory(
            content=f"Feedback {rating} for question '{question}' and SQL: {sql}",
            context=tool_context,
        )

        return {
            "status": "feedback_recorded",
            "message": "Agent memory updated",
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _sanitize_recursive(self, obj: Any) -> Any:
        """
        Recursively fix data before JSON serialization:
        1) Decode bytes with legacy Oracle encodings.
        2) Replace NaN / Infinity floats with None (JSON-compliant).
        """

        # Bytes → UTF-8 / CP1252
        if isinstance(obj, bytes):
            try:
                return obj.decode("utf-8")
            except UnicodeDecodeError:
                return obj.decode("cp1252", errors="replace")

        # Floats → JSON-safe
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return obj

        # Dict
        if isinstance(obj, dict):
            return {k: self._sanitize_recursive(v) for k, v in obj.items()}

        # List
        if isinstance(obj, list):
            return [self._sanitize_recursive(v) for v in obj]

        return obj

    def _init_memory(self):
        if self.settings.VANNA_MEMORY_TYPE == "in_memory":
            return DemoAgentMemory(max_items=1024)

        if self.settings.VANNA_MEMORY_TYPE == "chroma":
            from vanna.integrations.chromadb import ChromaAgentMemory

            return ChromaAgentMemory(
                collection_name="vanna_memory",
                persist_directory="./data/vanna_memory",
            )

        raise ValueError(
            f"Memory backend '{self.settings.VANNA_MEMORY_TYPE}' is not supported"
        )
