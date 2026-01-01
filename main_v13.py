# =============================================================
#  main_v13.py — VANNA-PRO v13
#  FastAPI server with Vanna Agent, Groq LLM, Oracle runner, Chroma memory,
#  JWT auth, rate limiting, training APIs, and monitoring.
# =============================================================

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from vanna import Agent, AgentConfig
from vanna.core.registry import ToolRegistry
from vanna.core.tool import ToolContext
from vanna.core.user import RequestContext, User, UserResolver
from vanna.integrations.chromadb import ChromaAgentMemory
from vanna.integrations.openai import OpenAILlmService
from vanna.integrations.oracle import OracleRunner

# Mocks for CI/test mode
try:
    from mocks.mock_llm import MockLLM
    from mocks.mock_oracle_runner import MockOracleRunner
except Exception:
    MockLLM = None
    MockOracleRunner = None

from admin_panel import delete_embedding, ensure_admin, list_embeddings, wipe_memory
from auth import create_tokens, decode_token
from logging_config import setup_logging
from performance_monitor import PerformanceMonitor
from rate_limiter import rate_limit
from vanna_tools import schema_tools, sql_tools, training_tools, visualization_tools
from vanna_tools.safety_guard import validate_sql_safe
from vanna_tools.utils import debug, validate_json

load_dotenv()
logger = setup_logging()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

ORACLE_USER = os.getenv("ORACLE_USER", "")
ORACLE_PASSWORD = os.getenv("ORACLE_PASSWORD", "")
ORACLE_DSN = os.getenv("ORACLE_DSN", "")
TEST_MODE = os.getenv("TEST_MODE", "false").lower() == "true"

memory_dir = Path("memory") / "chroma_db"
memory_dir.mkdir(parents=True, exist_ok=True)

# Share the SQL performance monitor instance
monitor: PerformanceMonitor = sql_tools.monitor


class CustomUserResolver(UserResolver):
    async def resolve_user(self, request_context: RequestContext) -> User:
        # Attempt to read Authorization header for Bearer token
        auth_header = None
        if hasattr(request_context, "request") and request_context.request:
            auth_header = request_context.request.headers.get("Authorization")
        if not auth_header and hasattr(request_context, "get_header"):
            try:
                auth_header = request_context.get_header("Authorization")  # type: ignore[attr-defined]
            except Exception:
                auth_header = None
        if not auth_header:
            raise HTTPException(status_code=401, detail="Missing Authorization token")

        token = auth_header.replace("Bearer", "").strip()
        payload = decode_token(token, expected_type="access")
        email = payload["email"]
        role = payload.get("role", "user")
        groups = [role] if isinstance(role, str) else role

        return User(
            id=email,
            username=email.split("@")[0],
            email=email,
            group_memberships=groups,
        )


user_resolver = CustomUserResolver()

# LLM configuration (Groq via OpenAILlmService)
if TEST_MODE and MockLLM:
    llm = MockLLM()
else:
    llm = OpenAILlmService(model=GROQ_MODEL, api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)

# Oracle runner
if TEST_MODE and MockOracleRunner:
    sql_runner = MockOracleRunner()
else:
    sql_runner = OracleRunner(user=ORACLE_USER, password=ORACLE_PASSWORD, dsn=ORACLE_DSN)

# Chroma memory
agent_memory = ChromaAgentMemory(collection_name="vanna_pro_memory", persist_directory=str(memory_dir))

# Tool registry and agent
tool_registry = ToolRegistry()
agent_config = AgentConfig(agent_name="VANNA-PRO-v13", max_prompt_tokens=1800, enable_memory=True)
agent = Agent(
    llm_service=llm,
    tool_registry=tool_registry,
    user_resolver=user_resolver,
    agent_memory=agent_memory,
    config=agent_config,
)


# Tool wrappers with explicit names (required by Vanna 2)
class RunSqlTool:
    name = "run_sql"

    def __init__(self, agent_instance, runner):
        self.agent = agent_instance
        self.runner = runner

    async def __call__(self, context, sql):
        return await sql_tools.execute_sql(self.agent, self.runner, sql, context=context)


class ExplainSqlTool:
    name = "explain_sql"

    def __init__(self, agent_instance):
        self.agent = agent_instance

    async def __call__(self, context, sql):
        return await sql_tools.explain_sql(self.agent, sql)


class VisualizeDataTool:
    name = "visualize_data"

    async def __call__(self, context, df, chart_type, x=None, y=None):
        return visualization_tools.visualize_data(df, chart_type, x, y)


class RefineSqlTool:
    name = "refine_sql"

    def __init__(self, agent_instance):
        self.agent = agent_instance

    async def __call__(self, context, sql):
        return await sql_tools.refine_sql(self.agent, sql)


class OptimizeSqlTool:
    name = "optimize_sql"

    def __init__(self, agent_instance):
        self.agent = agent_instance

    async def __call__(self, context, sql):
        return await sql_tools.optimize_sql(self.agent, sql)


class TrainSchemaTool:
    name = "train_schema"

    def __init__(self, agent_instance, runner):
        self.agent = agent_instance
        self.runner = runner

    async def __call__(self, context):
        return await schema_tools.train_schema(self.agent, self.runner, context)


class TrainSqlTool:
    name = "train_sql"

    def __init__(self, agent_instance):
        self.agent = agent_instance

    async def __call__(self, context, question, sql):
        return await training_tools.train_sql_pair(self.agent, question, sql, context)


class TrainDocumentTool:
    name = "train_document"

    def __init__(self, agent_instance):
        self.agent = agent_instance

    async def __call__(self, context, content):
        return await training_tools.train_document(self.agent, content, context)


class TrainDdlTool:
    name = "train_ddl"

    def __init__(self, agent_instance):
        self.agent = agent_instance

    async def __call__(self, context, ddl):
        return await training_tools.train_ddl(self.agent, ddl, context)


tool_registry.register_local_tool(
    RunSqlTool(agent, sql_runner),
    access_groups=["user", "poweruser", "admin"],
)
tool_registry.register_local_tool(
    ExplainSqlTool(agent),
    access_groups=["user", "poweruser", "admin"],
)
tool_registry.register_local_tool(
    VisualizeDataTool(),
    access_groups=["user", "poweruser", "admin"],
)
tool_registry.register_local_tool(
    RefineSqlTool(agent),
    access_groups=["admin", "poweruser"],
)
tool_registry.register_local_tool(
    OptimizeSqlTool(agent),
    access_groups=["admin", "poweruser"],
)
tool_registry.register_local_tool(
    TrainSchemaTool(agent, sql_runner),
    access_groups=["admin", "poweruser"],
)
tool_registry.register_local_tool(
    TrainSqlTool(agent),
    access_groups=["admin", "poweruser"],
)
tool_registry.register_local_tool(
    TrainDocumentTool(agent),
    access_groups=["admin", "poweruser"],
)
tool_registry.register_local_tool(
    TrainDdlTool(agent),
    access_groups=["admin", "poweruser"],
)

# FastAPI app
app = FastAPI(
    title="VANNA-PRO v13",
    description="Advanced SQL reasoning with auto-fix, Chroma memory, Oracle",
    version="13.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def limit_requests(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    rate_limit(ip)
    return await call_next(request)


@app.get("/health")
async def health():
    return {"status": "ok", "llm": "groq", "db": "oracle", "version": "v13"}


@app.get("/status")
async def status():
    return {
        "db": "oracle" if not TEST_MODE else "mock_oracle",
        "llm": "groq" if not TEST_MODE else "mock_llm",
        "memory": "chroma",
        "mode": "test" if TEST_MODE else "production",
        "tools": [t.name for t in tool_registry.tools] if hasattr(tool_registry, "tools") else []
    }


@app.get("/logs")
async def logs():
    try:
        with open(Path("logs") / "vanna.log", "r") as handle:
            lines = handle.readlines()[-200:]
    except FileNotFoundError:
        lines = ["Log file not created yet"]
    return {"recent_logs": lines}


@app.post("/auth/login")
async def login(request: Request):
    data = await request.json()
    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    if email == "admin@example.com" and password == "admin123":
        role = "admin"
    elif email == "power@example.com" and password == "power123":
        role = "poweruser"
    else:
        role = "user"

    access, refresh = create_tokens(email, role)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "Bearer",
        "role": role,
    }


@app.post("/auth/refresh")
async def refresh_token(request: Request):
    data = await request.json()
    token = data.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="Missing refresh_token")
    payload = decode_token(token, expected_type="refresh")
    email = payload["email"]
    role = payload["role"]
    new_access, new_refresh = create_tokens(email, role)
    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "Bearer",
    }


def resolve_user_from_request(request: Request):
    return user_resolver.resolve_user(RequestContext.from_fastapi_request(request))


@app.post("/tools/run_sql")
async def api_run_sql(request: Request):
    user = await resolve_user_from_request(request)
    data = await request.json()
    err = validate_json(data, ["sql"])
    if err:
        raise HTTPException(status_code=400, detail=err)
    context = ToolContext(user=user, question=data.get("question") or data["sql"])
    return await sql_tools.execute_sql(agent, sql_runner, data["sql"], context=context)


@app.post("/tools/explain_sql")
async def api_explain_sql(request: Request):
    user = await resolve_user_from_request(request)
    data = await request.json()
    err = validate_json(data, ["sql"])
    if err:
        raise HTTPException(status_code=400, detail=err)
    context = ToolContext(user=user, question=data["sql"])
    explanation = await sql_tools.explain_sql(agent, data["sql"])
    await agent.agent_memory.save_text_memory(content=explanation, context=context)
    return {"explanation": explanation}


@app.post("/tools/refine_sql")
async def api_refine_sql(request: Request):
    user = await resolve_user_from_request(request)
    data = await request.json()
    err = validate_json(data, ["sql"])
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"sql": await sql_tools.refine_sql(agent, data["sql"])}


@app.post("/tools/optimize_sql")
async def api_optimize_sql(request: Request):
    user = await resolve_user_from_request(request)
    data = await request.json()
    err = validate_json(data, ["sql"])
    if err:
        raise HTTPException(status_code=400, detail=err)
    return {"sql": await sql_tools.optimize_sql(agent, data["sql"])}


@app.post("/tools/visualize")
async def api_visualize(request: Request):
    user = await resolve_user_from_request(request)
    data = await request.json()
    if "rows" not in data or "columns" not in data:
        raise HTTPException(status_code=400, detail="rows and columns required")
    rows = data["rows"]
    cols = data["columns"]
    chart_type = data.get("chart_type", "bar")
    df = visualization_tools.rows_to_df(rows, cols)
    return visualization_tools.visualize_data(df, chart_type, x=data.get("x") or cols[0], y=data.get("y") or cols[1] if len(cols) > 1 else None)


@app.get("/train/templates")
async def api_get_templates():
    return training_tools.get_training_templates()


@app.post("/train/sql")
async def api_train_sql(request: Request):
    user = await resolve_user_from_request(request)
    if not any(group in ["admin", "poweruser"] for group in user.group_memberships):
        raise HTTPException(status_code=403, detail="Not authorized.")
    data = await request.json()
    err = validate_json(data, ["question", "sql"])
    if err:
        raise HTTPException(status_code=400, detail=err)
    context = ToolContext(user=user)
    return await training_tools.train_sql_pair(agent, data["question"], data["sql"], context)


@app.post("/train/document")
async def api_train_document(request: Request):
    user = await resolve_user_from_request(request)
    if not any(group in ["admin", "poweruser"] for group in user.group_memberships):
        raise HTTPException(status_code=403, detail="Not authorized.")
    data = await request.json()
    err = validate_json(data, ["content"])
    if err:
        raise HTTPException(status_code=400, detail=err)
    context = ToolContext(user=user)
    return await training_tools.train_document(agent, data["content"], context)


@app.post("/train/ddl")
async def api_train_ddl(request: Request):
    user = await resolve_user_from_request(request)
    if not any(group in ["admin", "poweruser"] for group in user.group_memberships):
        raise HTTPException(status_code=403, detail="Not authorized.")
    data = await request.json()
    err = validate_json(data, ["ddl"])
    if err:
        raise HTTPException(status_code=400, detail=err)
    context = ToolContext(user=user)
    return await training_tools.train_ddl(agent, data["ddl"], context)


@app.post("/train/schema")
async def api_train_schema(request: Request):
    user = await resolve_user_from_request(request)
    if not any(group in ["admin", "poweruser"] for group in user.group_memberships):
        raise HTTPException(status_code=403, detail="Not authorized.")
    context = ToolContext(user=user)
    return await schema_tools.train_schema(agent, sql_runner, context)

# Aliases for tool-style naming parity
@app.post("/tools/train_schema")
async def api_train_schema_alias(request: Request):
    return await api_train_schema(request)


@app.post("/tools/train_sql")
async def api_train_sql_alias(request: Request):
    return await api_train_sql(request)


@app.post("/tools/train_document")
async def api_train_document_alias(request: Request):
    return await api_train_document(request)


@app.post("/tools/train_ddl")
async def api_train_ddl_alias(request: Request):
    return await api_train_ddl(request)


@app.get("/monitor")
async def monitor_dashboard():
    try:
        with open(Path("logs") / "vanna.log", "r") as handle:
            lines = handle.readlines()[-20:]
    except FileNotFoundError:
        lines = ["Log file not created yet"]
    report = monitor.last_report or monitor.report()
    return {"service": "VANNA-PRO v13", "performance": report, "recent_logs": lines}


@app.get("/admin/memory/list")
async def api_list_memory(request: Request):
    user = await resolve_user_from_request(request)
    ensure_admin(user)
    return list_embeddings(agent)


@app.delete("/admin/memory/delete/{embedding_id}")
async def api_delete_record(embedding_id: str, request: Request):
    user = await resolve_user_from_request(request)
    ensure_admin(user)
    return delete_embedding(agent, embedding_id)


@app.delete("/admin/memory/wipe")
async def api_wipe_memory(request: Request):
    user = await resolve_user_from_request(request)
    ensure_admin(user)
    return wipe_memory(agent)


@app.get("/agent/memory/list")
async def api_agent_memory_list(request: Request):
    user = await resolve_user_from_request(request)
    ensure_admin(user)
    return list_embeddings(agent)


@app.post("/agent/memory/search")
async def api_agent_memory_search(request: Request):
    user = await resolve_user_from_request(request)
    ensure_admin(user)
    data = await request.json()
    query = data.get("query", " ")
    return agent.agent_memory.search(query, limit=50)


@app.delete("/agent/memory/delete/{embedding_id}")
async def api_agent_memory_delete(embedding_id: str, request: Request):
    user = await resolve_user_from_request(request)
    ensure_admin(user)
    return delete_embedding(agent, embedding_id)


@app.exception_handler(Exception)
async def handle_exception(request: Request, exc: Exception):
    debug(f"[ERROR] {str(exc)}")
    return JSONResponse(status_code=500, content={"error": str(exc)})


if __name__ == "__main__":
    import uvicorn

    print("Starting VANNA-PRO v13 on http://127.0.0.1:8000 ...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
