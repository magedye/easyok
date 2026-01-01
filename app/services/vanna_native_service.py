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
    TrackingRunSqlTool,
    TrackingVisualizeDataTool,
    build_llm_service,
    build_request_context,
    build_sql_runner,
)

# ============================================================================
# Tier-2 "Unrestricted" System Prompt
# Defined here to avoid polluting the global settings file
# ============================================================================
TIER2_SYSTEM_PROMPT = """
You are a Senior Data Analyst AI (Tier-2 Native Mode).

CAPABILITIES & RULES:
1. **Direct Execution:** You have direct access to the Oracle Database. Do NOT refuse to run SQL.
2. **No Artificial Limits:** Do NOT add 'FETCH FIRST n ROWS' unless the user explicitly asks for a limit.
3. **Self-Correction:** If you receive an ORA-XXXXX error, analyze it, correct the SQL, and RETRY immediately.
4. **Oracle Dialect:** Use valid Oracle SQL (SYSDATE, || for concatenation, quoting for case-sensitive identifiers).
5. **Memory:** Check your memory for similar past questions before generating new SQL.
6. **Persistence:** If a query succeeds, save it to memory for future speed.

Your goal is ACCURACY and COMPLETENESS.
"""

class VannaNativeService:
    """
    Tier 2 — Vanna Native (Productivity-first).

    Full native Vanna agent with unrestricted execution, memory, feedback,
    and visualization enabled when configured.
    """

    def __init__(self) -> None:
        self.settings = settings

        self.user_resolver = ContextUserResolver()

        # 1. استخدام الـ Runner الذكي (يختار NativeSqlRunner تلقائياً في Tier-2)
        self.sql_runner = build_sql_runner(self.settings)
        
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

        # 2. تحديد الـ System Prompt بناءً على الـ Tier
        # إذا كنا في Tier-2، نستخدم "الدستور" القوي المعرف أعلاه
        if self.settings.OPERATION_TIER == "tier2_vanna":
            base_prompt = TIER2_SYSTEM_PROMPT
        else:
            base_prompt = self.settings.VANNA_SYSTEM_PROMPT_TEMPLATE

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

    async def ask(
        self,
        question: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        request_context = build_request_context(context)

        chat_request = ChatRequest(
            message=question,
            request_context=request_context,
            metadata={"tier": "tier2_vanna"},
        )

        response = await self.chat_handler.handle_poll(chat_request)

        # 3. جلب اللقطة باستخدام request_id (لأن NativeSqlRunner يستخدمه كمفتاح)
        snapshot = self.run_sql_tool.take_snapshot(
            request_id=response.request_id
        )
        chart_snapshot = self.visualize_tool.take_snapshot(
            request_id=response.request_id
        )

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
        Initialise memory backend.
        Supports in-memory and Chroma backends.
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
            except Exception as exc:
                raise ValueError(f"Chroma memory unavailable: {exc}")

        raise ValueError(
            f"Memory backend '{self.settings.VANNA_MEMORY_TYPE}' "
            f"is not supported by the current Vanna build"
        )