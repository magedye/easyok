from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

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
    GuardedSqlRunner,
    TrackingRunSqlTool,
    TrackingVisualizeDataTool,
    build_llm_service,
    build_request_context,
)


class VannaNativeService:
    """
    Tier 2 — Vanna Native (Productivity-first).

    Full agent with memory, feedback, and charting enabled when configured.
    """

    def __init__(self) -> None:
        self.settings = settings
        self.user_resolver = ContextUserResolver()
        self.sql_runner = GuardedSqlRunner(self.settings)
        self.run_sql_tool = TrackingRunSqlTool(self.sql_runner)
        self.visualize_tool = TrackingVisualizeDataTool()

        registry = ToolRegistry()
        registry.register_local_tool(self.run_sql_tool, [])
        if self.settings.VANNA_ENABLE_CHARTS:
            registry.register_local_tool(self.visualize_tool, [])

        memory = self._init_memory()
        if self.settings.VANNA_ENABLE_MEMORY:
            registry.register_local_tool(SaveQuestionToolArgsTool(), [])
            registry.register_local_tool(SearchSavedCorrectToolUsesTool(), [])
            registry.register_local_tool(SaveTextMemoryTool(), [])

        agent_config = AgentConfig(
            stream_responses=False,
            include_thinking_indicators=True,
            temperature=self.settings.LLM_TEMPERATURE,
            max_tokens=self.settings.LLM_MAX_TOKENS,
        )

        self.agent = Agent(
            llm_service=build_llm_service(self.settings),
            tool_registry=registry,
            user_resolver=self.user_resolver,
            agent_memory=memory,
            config=agent_config,
            system_prompt_builder=DefaultSystemPromptBuilder(
                base_prompt=self.settings.VANNA_SYSTEM_PROMPT_TEMPLATE
            ),
        )

        self.chat_handler = ChatHandler(self.agent)

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
        snapshot = self.run_sql_tool.take_snapshot(response.conversation_id)
        chart_snapshot = self.visualize_tool.take_snapshot(response.conversation_id)

        # If the agent did not call run_sql, return the raw components instead of failing.
        if not snapshot:
            return {
                "conversation_id": response.conversation_id,
                "request_id": response.request_id,
                "sql": None,
                "rows": [],
                "columns": [],
                "components": [chunk.model_dump() for chunk in response.chunks],
                "chart": chart_snapshot.get("chart") if chart_snapshot else None,
                "memory": {
                    "enabled": self.settings.VANNA_ENABLE_MEMORY,
                    "type": self.settings.VANNA_MEMORY_TYPE,
                },
                "message": "No SQL was executed by the agent",
            }

        return {
            "conversation_id": response.conversation_id,
            "request_id": response.request_id,
            "sql": snapshot.get("sql"),
            "rows": snapshot.get("rows", []),
            "columns": snapshot.get("columns", []),
            "components": [chunk.model_dump() for chunk in response.chunks],
            "chart": chart_snapshot.get("chart") if chart_snapshot else None,
            "memory": {
                "enabled": self.settings.VANNA_ENABLE_MEMORY,
                "type": self.settings.VANNA_MEMORY_TYPE,
            },
        }

    async def handle_feedback(
        self,
        question: str,
        sql: str,
        rating: int,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Persist feedback directly into the active agent memory backend.
        """
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

    def _init_memory(self):
        """
        Initialise memory backend. Current implementation supports in-memory + chroma fallback.
        """
        if self.settings.VANNA_MEMORY_TYPE == "in_memory":
            return DemoAgentMemory(max_items=1024)

        if self.settings.VANNA_MEMORY_TYPE == "chroma":
            try:
                from vanna.integrations.chromadb import ChromaAgentMemory

                return ChromaAgentMemory(
                    collection_name="vanna_memory",
                    persist_directory="./data/vanna_memory",
                )
            except Exception as exc:  # pragma: no cover - optional dependency
                raise ValueError(f"Chroma memory unavailable: {exc}")

        # Postgres/Redis backends are not available in the OSS package we ship with.
        raise ValueError(
            f"Memory backend '{self.settings.VANNA_MEMORY_TYPE}' is not supported by the current Vanna build"
        )
