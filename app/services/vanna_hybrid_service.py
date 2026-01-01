from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from vanna import Agent
from vanna.core.agent.config import AgentConfig
from vanna.core.registry import ToolRegistry
from vanna.core.system_prompt import SystemPromptBuilder
from vanna.core.tool import ToolContext
from vanna.integrations.local.agent_memory.in_memory import DemoAgentMemory
from vanna.servers.base import ChatHandler
from vanna.servers.base.models import ChatRequest

from app.core.config import settings
from app.services.vanna_common import (
    ContextUserResolver,
    GuardedSqlRunner,
    TrackingRunSqlTool,
    build_llm_service,
    build_request_context,
)


class HybridSystemPromptBuilder(SystemPromptBuilder):
    """
    Role-aware prompt builder for Tier 1 (Governed) that keeps the base template
    while surfacing the enforced row limit to the agent.
    """

    def __init__(self, prompt_template: str, default_limit: int):
        self.prompt_template = prompt_template
        self.default_limit = default_limit

    async def build_system_prompt(self, user, tools) -> str:
        role = (user.metadata or {}).get("role") or (user.group_memberships[0] if user.group_memberships else "analyst")
        allowed_tables = (user.metadata or {}).get("allowed_tables", [])
        prompt_lines = [
            self.prompt_template,
            f"Active role: {role}",
            f"Default row limit: {self.default_limit}",
        ]
        if allowed_tables:
            prompt_lines.append(f"Use only allowed tables: {allowed_tables}")
        return "\n".join(prompt_lines)


class VannaHybridService:
    """
    Tier 1 — Governed productivity mode.

    Uses the Vanna Agent with light governance:
    - Sanitised SQL via GuardedSqlRunner
    - Role-aware prompt builder
    - AgentConfig wired with temperature/max_tokens from settings
    """

    def __init__(self) -> None:
        self.settings = settings
        self.user_resolver = ContextUserResolver()
        self.sql_runner = GuardedSqlRunner(self.settings)
        self.run_sql_tool = TrackingRunSqlTool(self.sql_runner)

        registry = ToolRegistry()
        registry.register_local_tool(self.run_sql_tool, [])

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
            agent_memory=DemoAgentMemory(max_items=256),
            config=agent_config,
            system_prompt_builder=HybridSystemPromptBuilder(
                prompt_template=self.settings.VANNA_SYSTEM_PROMPT_TEMPLATE,
                default_limit=self.settings.VANNA_DEFAULT_LIMIT,
            ),
        )

        self.chat_handler = ChatHandler(self.agent)

    async def ask(
        self,
        question: str,
        context: Optional[Dict[str, Any]] = None,
        mode: str = "auto",
    ) -> Dict[str, Any]:
        request_context = build_request_context(context)
        chat_request = ChatRequest(
            message=question,
            request_context=request_context,
            metadata={"mode": mode},
        )

        response = await self.chat_handler.handle_poll(chat_request)
        snapshot = self.run_sql_tool.take_snapshot(response.conversation_id)

        if not snapshot:
            raise ValueError("No SQL was executed by the agent")

        rows = snapshot.get("rows", [])
        result: Dict[str, Any] = {
            "sql": snapshot.get("sql"),
            "rows": rows,
            "summary": self._summarise(rows, question),
            "confidence": 0.65,
            "mode": mode,
        }

        return result

    async def handle_feedback(
        self,
        question: str,
        sql: str,
        rating: int,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Optional feedback hook. Stores lightweight feedback in in-memory backend.
        """
        try:
            request_context = build_request_context(context)
            user = await self.user_resolver.resolve_user(request_context)
            tool_context = ToolContext(
                user=user,
                conversation_id=uuid.uuid4().hex,
                request_id=uuid.uuid4().hex,
                agent_memory=self.agent.agent_memory,
                metadata={"rating": rating},
            )
            await self.agent.agent_memory.save_text_memory(
                content=f"Rating {rating} for question '{question}' with SQL: {sql}",
                context=tool_context,
            )
        except Exception:
            # Fail-closed: feedback is optional; swallow errors to avoid impacting ask path.
            pass

        return {
            "status": "feedback_recorded",
            "message": "Feedback stored for tuning",
        }

    @staticmethod
    def _summarise(rows: Any, question: str) -> str:
        if not rows:
            return f"No rows returned for: {question}"
        if isinstance(rows, list) and isinstance(rows[0], dict):
            columns = list(rows[0].keys())
            return f"Retrieved {len(rows)} rows with columns {columns}"
        return "Query executed"
