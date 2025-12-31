# Vanna 2.0.1 Comprehensive Functions & Commands Reference Guide

**Document Version:** 1.0  
**Language:** English  
**Date:** December 31, 2025  
**Status:** Complete & Production-Ready  

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Core Functions & Methods](#core-functions--methods)
3. [FastAPI Server Commands](#fastapi-server-commands)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Complete Workflows](#complete-workflows)
6. [Advanced Tools & Integrations](#advanced-tools--integrations)
7. [Testing Commands](#testing-commands)
8. [Performance Monitoring](#performance-monitoring)
9. [Quick Start Guide](#quick-start-guide)
10. [Functions Summary Table](#functions-summary-table)
11. [Important Warnings & Best Practices](#important-warnings--best-practices)

---

## EXECUTIVE SUMMARY

Vanna 2.0.1 is an Agent-based framework for converting natural language queries into SQL. It supports multiple LLMs (Groq, OpenAI, Claude, Bedrock, Ollama) and multiple databases (Oracle, MSSQL, PostgreSQL, MySQL).

**Key Capabilities:**
- Natural Language → SQL generation with LLM integration
- RAG-backed vector memory for context injection
- Multi-agent, multi-workspace architecture
- Persistent memory with ChromaDB, Pinecone, PgVector
- Role-Based Access Control (RBAC)
- FastAPI server with streaming support
- Automatic schema learning and DDL training
- Performance monitoring and observability

---

## CORE FUNCTIONS & METHODS

### 1. Agent Initialization & Configuration

```python
from vanna import Agent, AgentConfig
from vanna.integrations.openai import OpenAILlmService
from vanna.integrations.oracle import OracleRunner
from vanna.integrations.chromadb import ChromaAgentMemory
from vanna.core.registry import ToolRegistry
from vanna.core.user import UserResolver, User, RequestContext

# Step 1: Initialize LLM Service
llm = OpenAILlmService(
    model="llama-3.1-8b-instant",
    api_key="gsk_your_api_key_here",
    base_url="https://api.groq.com/openai/v1"
)

# Step 2: Initialize Database Runner
sql_runner = OracleRunner(
    user="C##MAJED",
    password="StrongPass123",
    dsn="192.168.1.36:1521/ORCL"
)

# Step 3: Initialize Memory Backend
agent_memory = ChromaAgentMemory(
    collection_name="vanna_memory",
    persist_directory="./chroma_db"
)

# Step 4: Configure Agent
config = AgentConfig(
    agent_name="Finance Agent",
    enable_memory=True,
    max_prompt_tokens=1500,
    temperature=0.2,
    max_tokens=2000,
    measure_performance=True,
    dev_mode=False
)

# Step 5: Create Agent Instance
agent = Agent(
    llm_service=llm,
    sql_runner=sql_runner,
    agent_memory=agent_memory,
    config=config
)
```

### 2. Ask Question (Natural Language to SQL)

```python
# Primary method to ask questions
response = await agent.ask(
    question="Show me top 10 customers by revenue",
    auto_execute=True  # Execute SQL automatically
)

# Response structure:
# {
#     "sql_query": "SELECT customer_name, SUM(revenue) as total_revenue FROM customers 
#                   GROUP BY customer_name ORDER BY total_revenue DESC FETCH FIRST 10 ROWS ONLY",
#     "result": {
#         "rows": [
#             {"customer_name": "Acme Corp", "total_revenue": 1000000},
#             {"customer_name": "TechSolutions", "total_revenue": 950000},
#             ...
#         ],
#         "columns": ["customer_name", "total_revenue"],
#         "row_count": 10
#     },
#     "llm_model": "llama-3.1-8b-instant",
#     "tokens_used": {
#         "input": 245,
#         "output": 87
#     },
#     "latency_ms": 2341,
#     "timestamp": "2025-12-31T23:18:00Z"
# }

# Alternative: Generate SQL without executing
response = await agent.ask(
    question="Show me top 10 customers by revenue",
    auto_execute=False
)
# Returns only SQL, no execution

# With context and assumptions
response = await agent.ask(
    question="Show me top 10 customers by revenue",
    context="Consider only active customers from the last 12 months",
    return_assumptions=True
)
```

### 3. Execute SQL Directly

```python
# Execute pre-written or validated SQL
result = await agent.execute_sql(
    sql="SELECT * FROM customers FETCH FIRST 10 ROWS ONLY",
    timeout=60  # Query timeout in seconds
)

# Response:
# {
#     "status": "ok|error",
#     "rows": [...],
#     "columns": [{"name": "col1", "type": "VARCHAR2"}, ...],
#     "row_count": 10,
#     "execution_time_ms": 250
# }

# Direct execution without agent
result = await sql_runner.execute(
    sql="SELECT COUNT(*) as total FROM customers"
)
```

### 4. Training Methods

```python
# 4A. Train on specific question-SQL pair
await agent.train(
    question="Show me top customers by revenue",
    sql="SELECT customer_name, SUM(revenue) as total_revenue FROM customers 
         GROUP BY customer_name ORDER BY total_revenue DESC FETCH FIRST 10 ROWS ONLY"
)

# 4B. Auto-learn database schema
await agent.train_schema(sql_runner)
# Automatically discovers:
# - All tables
# - All columns per table
# - Data types (NUMBER, VARCHAR2, DATE, etc.)
# - Primary keys
# - Foreign keys
# - Relationships and constraints

# 4C. Train on DDL statements
await agent.train_ddl(
    sql="""
    CREATE TABLE employees (
        emp_id NUMBER PRIMARY KEY,
        emp_name VARCHAR2(100),
        dept_id NUMBER,
        salary NUMBER,
        hire_date DATE,
        CONSTRAINT fk_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
    )
    """
)

# 4D. Train on documentation/context
await agent.train_document(
    content="""
    The employees table contains all employee records.
    - emp_id: Unique employee identifier
    - emp_name: Full name of the employee
    - dept_id: Foreign key reference to departments table
    - salary: Annual salary in USD
    - hire_date: Date employee was hired
    
    Common queries:
    - Get employees by department
    - Calculate department-wise salary budgets
    - Find employees hired in specific year
    """
)

# 4E. Rebuild vector memory (after adding training data)
await agent.rebuild_memory()
# Re-embeds all training data and updates vector store
# Important when you've added many training items
```

### 5. LLM Integration Methods

```python
# ✅ CORRECT METHOD #1: Using chat wrapper
response = llm.chat("Explain what SQL injection is")
# Returns: {"role": "assistant", "content": "SQL injection is..."}

# ✅ CORRECT METHOD #2: Using OpenAI-compatible API
response = llm.client.chat.completions.create(
    model="llama-3.1-8b-instant",
    messages=[
        {"role": "system", "content": "You are a SQL expert"},
        {"role": "user", "content": "Generate a SQL query to get top 10 products"}
    ],
    temperature=0.2,
    max_tokens=2000
)
# Returns: OpenAI ChatCompletion object
# Access content: response.choices[0].message.content

# ❌ INCORRECT METHODS (Vanna 1.x only):
# response = llm.completion("...")        # ❌ Does not exist in 2.0.1
# response = llm.generate("...")          # ❌ May not exist in 2.0.1

# Token counting
token_count = llm.count_tokens("Your text here")

# Check LLM availability
is_available = await llm.test_connection()
```

### 6. Database Runner Methods

```python
from vanna.integrations.oracle import OracleRunner
from vanna.integrations.mssql import MSSQLRunner

# Oracle Database Runner
oracle_runner = OracleRunner(
    user="C##MAJED",
    password="StrongPass123",
    dsn="192.168.1.36:1521/ORCL"
)

# Get database schema
schema = await oracle_runner.get_schema()
# Returns: {"tables": [{"name": "customers", "columns": [...]}, ...]}

# Get table-specific schema
table_schema = await oracle_runner.get_table_schema("customers")
# Returns: [
#     {"name": "cust_id", "type": "NUMBER", "nullable": False},
#     {"name": "cust_name", "type": "VARCHAR2", "nullable": False},
#     ...
# ]

# Get constraints and relationships
constraints = await oracle_runner.get_constraints()
# Returns: [
#     {"from_table": "orders", "from_column": "cust_id", 
#      "to_table": "customers", "to_column": "cust_id"},
#     ...
# ]

# Validate SQL syntax
is_valid = oracle_runner.validate_sql("SELECT * FROM customers")
# Returns: True | False

# Check connection
connection_status = await oracle_runner.test_connection()
# Returns: {"status": "ok|error", "message": "..."}

# Execute query
result = await oracle_runner.execute("SELECT COUNT(*) as total FROM customers")

# MSSQL Database Runner
mssql_runner = MSSQLRunner(
    server="sql-prod.internal.com",
    port=1433,
    database="Analytics",
    username="sa",
    password="password",
    authentication_type="sql",  # or "windows"
    encrypt=True
)

# Similar methods available:
# mssql_runner.get_schema()
# mssql_runner.execute(sql)
# mssql_runner.validate_sql(sql)
# etc.
```

### 7. Memory Operations

```python
from vanna.integrations.chromadb import ChromaAgentMemory

agent_memory = ChromaAgentMemory(
    collection_name="vanna_memory",
    persist_directory="./chroma_db"
)

# Search for similar questions/patterns
results = await agent_memory.search(
    query="show me top customers by revenue",
    top_k=5,
    similarity_threshold=0.7
)
# Returns:
# [
#     {
#         "question": "What are the top 10 customers by revenue?",
#         "tool_name": "run_sql",
#         "tool_args": {"sql": "SELECT ..."},
#         "similarity_score": 0.92,
#         "metadata": {...}
#     },
#     ...
# ]

# Save question-tool-args pair
await agent_memory.save_question_tool_args(
    question="Top customers by revenue",
    tool_name="run_sql",
    tool_args={"sql": "SELECT customer_name, SUM(revenue) FROM customers GROUP BY customer_name ORDER BY revenue DESC"},
    metadata={"source": "user_feedback", "validated": True}
)

# Save free-form text/insights
await agent_memory.save_text(
    content="Important: Always filter customers by status='ACTIVE' unless explicitly asked otherwise",
    metadata={"type": "business_rule"}
)

# Clear memory
await agent_memory.clear()

# Get memory statistics
stats = agent_memory.get_statistics()
# Returns: {"total_items": 245, "total_embeddings": 245, "size_mb": 45.2}
```

### 8. Tool Registry Operations

```python
from vanna.core.registry import ToolRegistry
from vanna.tools import RunSqlTool, VisualizeDataTool
from vanna.tools.agent_memory import (
    SaveQuestionToolArgsTool,
    SearchSavedCorrectToolUsesTool,
    SaveTextMemoryTool
)

tool_registry = ToolRegistry()

# Register built-in tools
tool_registry.register_local_tool(
    RunSqlTool(sql_runner),
    access_groups=['admin', 'user']
)

tool_registry.register_local_tool(
    VisualizeDataTool(),
    access_groups=['admin', 'user', 'viewer']
)

# Register memory tools
tool_registry.register_local_tool(
    SaveQuestionToolArgsTool(),
    access_groups=['admin']
)

tool_registry.register_local_tool(
    SearchSavedCorrectToolUsesTool(),
    access_groups=['admin', 'user']
)

tool_registry.register_local_tool(
    SaveTextMemoryTool(),
    access_groups=['admin', 'user']
)

# List all registered tools
tools = tool_registry.list_tools()
# Returns: ["run_sql", "visualize_data", "save_question_tool_args", ...]

# Get specific tool
sql_tool = tool_registry.get_tool("run_sql")

# Check tool availability for user
available_tools = tool_registry.get_tools_for_user(user)

# Get tool metadata
metadata = tool_registry.get_tool_metadata("run_sql")
# Returns: {
#     "name": "run_sql",
#     "description": "Executes SQL queries against the database",
#     "arguments": [{"name": "sql", "type": "string", "required": True}],
#     "access_groups": ["admin", "user"]
# }
```

---

## FASTAPI SERVER COMMANDS

### 1. Server Startup

```bash
# Using Uvicorn
uvicorn main_v13:app --host 0.0.0.0 --port 8000 --reload

# Using Gunicorn (production)
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main_v13:app --bind 0.0.0.0:8000

# With environment variables
export GROQ_API_KEY="gsk_xxx"
export ORACLE_USER="C##MAJED"
export ORACLE_PASSWORD="StrongPass123"
export ORACLE_DSN="192.168.1.36:1521/ORCL"
uvicorn main_v13:app --host 0.0.0.0 --port 8000
```

### 2. Web Interfaces

```
# Swagger UI (Interactive API Documentation)
http://127.0.0.1:8000/docs

# ReDoc (Alternative API Documentation)
http://127.0.0.1:8000/redoc

# Vanna Chat UI
http://127.0.0.1:8000

# Health Check
http://127.0.0.1:8000/health
```

### 3. Admin Console Commands (in Chat UI)

```
/help              - Display help message
                     Shows all available commands and natural language examples

/status            - Check system status
                     Returns: LLM status, Database connection status, Memory system status, 
                              Visualization tools status, Total tools count

/memories          - View and manage recent memories
                     Shows: last N memories with similarity scores, source, timestamp

/delete [id]       - Delete a specific memory by ID
                     Usage: /delete memory_uuid_here

/explain [sql]     - Explain an SQL query in natural language
                     Usage: /explain SELECT * FROM customers WHERE status='ACTIVE'

/optimize [sql]    - Get optimization suggestions for SQL
                     Usage: /optimize SELECT * FROM orders WHERE order_date > '2025-01-01'

/train             - View current training data
                     Shows: number of SQL pairs, DDL statements, documentation items

/reset             - Reset agent memory (admin only)
                     WARNING: Deletes all memories and chat history
```

---

## API ENDPOINTS REFERENCE

### Authentication Endpoints

```python
# POST /auth/login
{
    "username": "user@example.com",
    "password": "password"
}
# Response:
{
    "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "token_type": "bearer",
    "expires_in": 3600,
    "workspace_id": "uuid",
    "user_id": "uuid",
    "role": "admin|poweruser|user|viewer"
}

# GET /auth/me
# Returns current authenticated user info
{
    "user_id": "uuid",
    "username": "user@example.com",
    "workspace_id": "uuid",
    "role": "admin",
    "groups": ["admin", "power_users"]
}

# POST /auth/logout
# Revokes current token
```

### Chat Endpoints

```python
# POST /chat/start
{
    "agent_id": "uuid",
    "title": "Q4 Sales Analysis"
}
# Response:
{
    "session_id": "uuid",
    "agent_id": "uuid",
    "created_at": "2025-12-31T23:18:00Z"
}

# POST /chat/message
{
    "session_id": "uuid",
    "message": "Show me top 10 customers by revenue",
    "auto_execute": true
}
# Response:
{
    "message_id": "uuid",
    "sql_query": "SELECT ...",
    "sql_status": "executed|error",
    "result": {
        "rows": [...],
        "columns": [...],
        "row_count": 10
    },
    "llm_model": "llama-3.1-8b-instant",
    "tokens_used": {"input": 245, "output": 87},
    "latency_ms": 2341,
    "timestamp": "2025-12-31T23:18:30Z"
}

# GET /chat/sessions
# List all sessions for user
[
    {
        "session_id": "uuid",
        "title": "Q4 Sales Analysis",
        "agent_id": "uuid",
        "message_count": 5,
        "last_activity": "2025-12-31T23:18:00Z"
    }
]

# GET /chat/session/{session_id}
# Fetch full conversation history
{
    "session_id": "uuid",
    "messages": [
        {
            "message_id": "uuid",
            "role": "user",
            "content": "Show me top customers",
            "timestamp": "..."
        },
        {
            "message_id": "uuid",
            "role": "assistant",
            "content": "Here are the results...",
            "sql_query": "...",
            "result": {...},
            "timestamp": "..."
        }
    ]
}

# DELETE /chat/session/{session_id}
# Delete a session
{"status": "deleted"}
```

### Training Endpoints

```python
# GET /training/list
# List all training items for an agent
[
    {
        "id": "uuid",
        "type": "sql|ddl|doc",
        "content": "SELECT ...",
        "tags": ["sales", "customers"],
        "created_at": "2025-12-31T23:18:00Z"
    }
]

# POST /training/add
{
    "agent_id": "uuid",
    "type": "sql|ddl|doc",
    "content": "SELECT customer_name, SUM(revenue) FROM customers GROUP BY customer_name",
    "tags": ["sales", "top_customers", "revenue"]
}
# Response:
{"id": "uuid", "status": "added"}

# DELETE /training/{id}
# Remove training item
{"status": "deleted"}

# POST /agent/{agent_id}/memory/rebuild
# Rebuild vector embeddings (after bulk training)
{"status": "rebuilding|done", "items_processed": 245}

# POST /training/bulk-import
# Bulk import training data from CSV/JSON
{
    "file": "<file_contents>",
    "format": "csv|json"
}
```

### Database Endpoints

```python
# POST /db/add
{
    "name": "Production Oracle",
    "type": "oracle|mssql|postgres|mysql",
    "host": "oracle-prod.internal.com",
    "port": 1521,
    "service_name": "ORCL",
    "username": "app_user",
    "password": "encrypted_password",
    "encoding": "UTF-8"
}
# Response:
{"id": "uuid", "status": "created"}

# GET /db/list
# List all database connections
[
    {
        "id": "uuid",
        "name": "Production Oracle",
        "type": "oracle",
        "host": "oracle-prod.internal.com",
        "status": "ok|error"
    }
]

# POST /db/{id}/test
# Test connection
{"status": "ok|error", "message": "Connected to Oracle 19c"}

# GET /db/{id}/schema
# Get database schema information
{
    "tables": [
        {
            "name": "customers",
            "columns": [
                {"name": "cust_id", "type": "NUMBER"},
                {"name": "cust_name", "type": "VARCHAR2"},
                ...
            ]
        }
    ]
}

# DELETE /db/{id}
# Delete connection
{"status": "deleted"}
```

### Agent Endpoints

```python
# GET /agents
# List all agents in workspace
[
    {
        "id": "uuid",
        "name": "Finance Agent",
        "description": "...",
        "db_connection_id": "uuid",
        "llm_provider": "groq",
        "llm_model": "llama-3.1-8b-instant",
        "created_at": "2025-12-31T23:18:00Z"
    }
]

# POST /agent/{agent_id}/settings
# Update agent configuration
{
    "llm_provider": "groq",
    "llm_model": "mixtral-8x7b-instant",
    "temperature": 0.2,
    "max_tokens": 2000,
    "db_connection_id": "uuid",
    "max_result_rows": 5000,
    "query_timeout": 60
}
# Response: {"status": "updated"}

# POST /agent/{agent_id}/test-llm
# Verify LLM connectivity
{"status": "ok|error", "message": "API key valid, model available"}

# POST /agent/{agent_id}/test-db
# Verify database connectivity
{"status": "ok|error", "message": "Connected to Oracle 19c at oracle-prod.internal.com"}

# POST /agent/{agent_id}/reset
# Clear all chat history and reset memory
{"status": "reset"}
```

### Monitoring Endpoints

```python
# GET /health
# Basic health check
{"status": "ok", "service": "Vanna 2.0.1", "llm": "groq", "db": "oracle"}

# GET /monitoring/metrics
# System metrics summary
{
    "queries_total": 450,
    "queries_success": 420,
    "queries_failed": 30,
    "success_rate": 0.933,
    "avg_latency_ms": 2200,
    "tokens_used_month": 45000,
    "active_sessions": 3
}

# GET /monitoring/errors
# Error summary
{
    "errors": [
        {
            "error_type": "SQL Syntax Error",
            "count": 5,
            "last_occurrence": "2025-12-31T23:15:00Z"
        },
        {
            "error_type": "DB Connection Timeout",
            "count": 2,
            "last_occurrence": "2025-12-31T23:10:00Z"
        }
    ]
}

# GET /dashboard/summary
# Dashboard overview
{
    "workspace_name": "ACME Inc",
    "active_agent": "Finance Agent",
    "active_db": "Production Oracle",
    "recent_queries_count": 5,
    "training_data_count": 42,
    "token_usage_today": 12000
}

# GET /dashboard/queries/recent
# Recent queries list
[
    {
        "query_id": "uuid",
        "user_question": "Top customers",
        "sql": "SELECT ...",
        "status": "ok|error",
        "timestamp": "2025-12-31T23:18:00Z",
        "latency_ms": 2500
    }
]
```

---

## COMPLETE WORKFLOWS

### Workflow 1: Complete NL→SQL Pipeline

```python
async def complete_nl_to_sql_workflow(agent: Agent, user_question: str):
    """
    Complete step-by-step workflow from question to result.
    """
    
    # Step 1: Receive user question
    print(f"User Question: {user_question}")
    
    # Step 2: Search memory for similar patterns
    context_snippets = await agent.agent_memory.search(
        query=user_question,
        top_k=3,
        similarity_threshold=0.7
    )
    print(f"Found {len(context_snippets)} relevant training examples")
    
    # Step 3: Build system prompt with context
    system_prompt = f"""You are an expert SQL analyst. Generate accurate SQL queries.

Training Context:
{chr(10).join([f"- {snippet['question']} → {snippet['tool_args'].get('sql', '')}" 
               for snippet in context_snippets])}

Database Schema Information:
- tables: customers, orders, products, sales
- customers: cust_id (PK), cust_name, region, status
- orders: order_id (PK), cust_id (FK), order_date, amount
- products: prod_id (PK), prod_name, category, price
- sales: sale_id (PK), prod_id (FK), quantity, sale_date

Generate SQL for: {user_question}
Use Oracle SQL dialect. Return only the SQL query, no explanation."""
    
    # Step 4: Call LLM
    llm_response = await agent.llm_service.client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_question}
        ],
        temperature=0.2,
        max_tokens=2000
    )
    
    # Step 5: Extract SQL from response
    generated_sql = llm_response.choices[0].message.content.strip()
    print(f"Generated SQL: {generated_sql}")
    
    # Step 6: Validate SQL
    is_valid = agent.sql_runner.validate_sql(generated_sql)
    if not is_valid:
        print("SQL Validation Failed!")
        return None
    
    # Step 7: Execute SQL
    result = await agent.sql_runner.execute(generated_sql)
    print(f"Query executed successfully. Rows returned: {result.get('row_count', 0)}")
    
    # Step 8: Save to memory (auto-train)
    await agent.agent_memory.save_question_tool_args(
        question=user_question,
        tool_name="run_sql",
        tool_args={"sql": generated_sql},
        metadata={"source": "agent_generation", "validated": True}
    )
    
    # Step 9: Return formatted response
    return {
        "question": user_question,
        "sql": generated_sql,
        "result": result,
        "tokens_used": {
            "input": llm_response.usage.prompt_tokens,
            "output": llm_response.usage.completion_tokens
        },
        "timestamp": datetime.now().isoformat()
    }

# Usage
response = await complete_nl_to_sql_workflow(agent, "Show me top 10 customers by total order amount")
print(json.dumps(response, indent=2))
```

### Workflow 2: Schema Learning & Auto-Training

```python
async def auto_schema_learning_workflow(agent: Agent, sql_runner):
    """
    Automatically learn database schema and create training data.
    """
    
    # Step 1: Discover all tables and columns
    print("Step 1: Discovering database schema...")
    schema = await sql_runner.get_schema()
    
    for table in schema['tables']:
        print(f"  Table: {table['name']}")
        for col in table['columns']:
            print(f"    - {col['name']}: {col['type']}")
    
    # Step 2: Get relationships
    print("\nStep 2: Discovering relationships...")
    relationships = await sql_runner.get_constraints()
    for rel in relationships:
        print(f"  {rel['from_table']}.{rel['from_column']} → {rel['to_table']}.{rel['to_column']}")
    
    # Step 3: Train on DDL
    print("\nStep 3: Training on DDL statements...")
    for table in schema['tables']:
        ddl = f"CREATE TABLE {table['name']} (...)"
        await agent.train_ddl(ddl)
    
    # Step 4: Train on table descriptions
    print("\nStep 4: Creating table descriptions...")
    descriptions = []
    for table in schema['tables']:
        columns_desc = ", ".join([f"{c['name']} ({c['type']})" for c in table['columns']])
        desc = f"{table['name']}: Contains {columns_desc}"
        descriptions.append(desc)
    
    for desc in descriptions:
        await agent.train_document(desc)
    
    # Step 5: Train on common SQL patterns
    print("\nStep 5: Generating common SQL patterns...")
    for table in schema['tables']:
        # SELECT pattern
        cols = [c['name'] for c in table['columns'][:3]]
        sql = f"SELECT {', '.join(cols)} FROM {table['name']} FETCH FIRST 10 ROWS ONLY"
        await agent.train(
            question=f"Show me first 10 records from {table['name']}",
            sql=sql
        )
    
    # Step 6: Rebuild memory
    print("\nStep 6: Rebuilding vector memory...")
    await agent.rebuild_memory()
    
    print("✓ Schema learning workflow complete!")
    
    # Return summary
    return {
        "tables_discovered": len(schema['tables']),
        "columns_discovered": sum(len(t['columns']) for t in schema['tables']),
        "relationships_discovered": len(relationships),
        "training_items_created": len(descriptions) + len(schema['tables'])
    }

# Usage
summary = await auto_schema_learning_workflow(agent, sql_runner)
print(json.dumps(summary, indent=2))
```

### Workflow 3: Multi-Turn Conversation with Context

```python
async def multi_turn_conversation_workflow(agent: Agent, session_id: str):
    """
    Handle multi-turn conversations with context accumulation.
    """
    
    conversation_history = []
    
    # Turn 1: Get orders
    turn1_question = "Show me orders from last month"
    turn1_response = await agent.ask(turn1_question, auto_execute=True)
    conversation_history.append({
        "turn": 1,
        "question": turn1_question,
        "sql": turn1_response["sql_query"],
        "result": turn1_response["result"]
    })
    
    # Turn 2: Follow-up question using context
    turn2_question = "Which of these customers spent the most?"
    # Agent uses memory of Turn 1 context
    context = f"Based on our previous query, we have orders: {[r['order_id'] for r in turn1_response['result']['rows'][:5]]}"
    turn2_response = await agent.ask(
        turn2_question,
        context=context,
        auto_execute=True
    )
    conversation_history.append({
        "turn": 2,
        "question": turn2_question,
        "sql": turn2_response["sql_query"],
        "result": turn2_response["result"]
    })
    
    # Turn 3: Drill down further
    turn3_question = "Show me product details for their orders"
    turn3_response = await agent.ask(
        turn3_question,
        context=f"Customer ID: {turn2_response['result']['rows'][0]['cust_id']}",
        auto_execute=True
    )
    conversation_history.append({
        "turn": 3,
        "question": turn3_question,
        "sql": turn3_response["sql_query"],
        "result": turn3_response["result"]
    })
    
    # Save entire conversation
    return {
        "session_id": session_id,
        "conversation": conversation_history,
        "total_turns": len(conversation_history),
        "total_queries": len(conversation_history),
        "total_tokens": sum(
            turn['response'].get('tokens_used', {}).get('input', 0) + 
            turn['response'].get('tokens_used', {}).get('output', 0)
            for turn in conversation_history
        )
    }
```

---

## ADVANCED TOOLS & INTEGRATIONS

### 1. Built-in Tools

```python
from vanna.tools import (
    RunSqlTool,                      # Execute SQL queries
    VisualizeDataTool,               # Create charts from results
)

from vanna.tools.agent_memory import (
    SaveQuestionToolArgsTool,        # Save Q&A pairs
    SearchSavedCorrectToolUsesTool,  # Search memory for patterns
    SaveTextMemoryTool               # Save free-form notes
)

# Optional Advanced Tools:
# ExplainSqlTool                    # Explain SQL queries in natural language
# FixSqlTool                        # Auto-fix SQL errors
# OptimizeSqlTool                   # Suggest query optimizations
# RefineQueryTool                   # Refine results based on feedback
```

### 2. Custom Tool Implementation

```python
from vanna.core.tool import Tool, ToolContext
from typing import List, Dict, Any

class CustomAnalysisTool(Tool):
    """Custom tool for advanced data analysis."""
    
    def title(self) -> str:
        """Display name of the tool."""
        return "Advanced Analysis Tool"
    
    def description(self) -> str:
        """Detailed description."""
        return "Performs statistical analysis on query results"
    
    def arguments(self) -> List[Dict[str, Any]]:
        """Define tool arguments."""
        return [
            {
                "name": "data",
                "type": "string",
                "description": "CSV data or query result",
                "required": True
            },
            {
                "name": "analysis_type",
                "type": "string",
                "description": "Type of analysis: correlation, regression, clustering",
                "required": True
            }
        ]
    
    async def execute(self, data: str, analysis_type: str, context: ToolContext) -> Dict[str, Any]:
        """Execute the tool."""
        try:
            # Perform analysis
            result = self._perform_analysis(data, analysis_type)
            
            return {
                "status": "success",
                "analysis_type": analysis_type,
                "result": result,
                "user": context.user.username
            }
        except Exception as e:
            return {
                "status": "error",
                "message": str(e)
            }
    
    def _perform_analysis(self, data: str, analysis_type: str) -> Dict[str, Any]:
        """Internal analysis logic."""
        # Implementation specific to your use case
        pass

# Register custom tool
tool_registry.register_local_tool(
    CustomAnalysisTool(),
    access_groups=['admin', 'poweruser']
)
```

### 3. Slack Integration

```python
from vanna.integrations.slack import VannaSlackBot

slack_bot = VannaSlackBot(
    bot_token="xoxb-your-bot-token",
    agent=agent,
    workspace_id="workspace_uuid"
)

# The bot will:
# - Listen for mentions (@vanna_bot)
# - Convert messages to SQL queries
# - Return results in thread
# - Save conversation to memory
# - Example: @vanna_bot show me top 10 products by sales
```

### 4. Jupyter Notebook Integration

```python
# Install: pip install vanna[jupyter]

from vanna import Agent

# Initialize agent
agent = Agent(llm_service=llm, sql_runner=sql_runner)

# Use in notebook
%%vanna
agent=agent

# Then simply ask questions:
# show me top customers by revenue
# Create a pie chart of sales by region
# etc.
```

---

## TESTING COMMANDS

### 1. Test LLM Connection

```bash
# Python command-line test
python -c "
from vanna.integrations.openai import OpenAILlmService

llm = OpenAILlmService(
    model='llama-3.1-8b-instant',
    api_key='gsk_your_api_key_here',
    base_url='https://api.groq.com/openai/v1'
)

# Test using OpenAI API
response = llm.client.chat.completions.create(
    model='llama-3.1-8b-instant',
    messages=[{'role': 'user', 'content': 'Hello, how are you?'}]
)

print('LLM is working correctly.')
print('Response:', response.choices[0].message.content)
"

# Expected output:
# LLM is working correctly.
# Response: Hello! I'm doing great, thank you for asking...
```

### 2. Test Oracle Connection

```bash
python oracle_diagnostic.py

# Expected output:
# === Checking Oracle Configuration ===
# [OK] User: C##MAJED
# [OK] DSN: 192.168.1.36:1521/ORCL
# 
# === Validating DSN Format ===
# [OK] DSN format looks correct.
# 
# === Testing Oracle Connection ===
# [OK] Connection to Oracle established.
# 
# === Running Basic Query (SELECT 1 FROM DUAL) ===
# [OK] Query OK: (1,)
# 
# === Metadata Extraction Test ===
# [OK] Found 1 tables.
# [OK] Sample: ['TRANSACTST2', ...]
# 
# === Describing Table: TRANSACTST2 ===
# [OK] 64 columns found.
# 
# === Testing SQL Execution (Oracle Dialect) ===
# [OK] Testing table: TRANSACTST2
# [OK] Row fetched: (14, 525912, 2, 43, ...)
# 
# === Oracle diagnostic completed successfully. ===
```

### 3. Test Agent End-to-End

```python
import asyncio
import json

async def test_agent():
    """Complete end-to-end agent test."""
    
    # Initialize
    from main_v13 import agent
    
    test_cases = [
        "Show me first 5 customers",
        "Show me total sales by month",
        "What's the average order value?",
        "List all distinct product categories",
        "Show me orders from top 3 customers"
    ]
    
    results = []
    
    for test_question in test_cases:
        print(f"\n📝 Testing: {test_question}")
        
        try:
            response = await agent.ask(test_question, auto_execute=True)
            
            results.append({
                "question": test_question,
                "status": "✓ PASS",
                "sql_generated": response.get("sql_query") is not None,
                "executed_successfully": response.get("result") is not None,
                "latency_ms": response.get("latency_ms", 0)
            })
            
            print(f"✓ PASS - Latency: {response.get('latency_ms')}ms")
            
        except Exception as e:
            results.append({
                "question": test_question,
                "status": "✗ FAIL",
                "error": str(e)
            })
            print(f"✗ FAIL - Error: {str(e)}")
    
    # Summary
    passed = sum(1 for r in results if r["status"] == "✓ PASS")
    total = len(results)
    
    print(f"\n\n{'='*50}")
    print(f"TEST SUMMARY: {passed}/{total} tests passed")
    print(f"{'='*50}\n")
    
    return results

# Run tests
results = asyncio.run(test_agent())
```

---

## PERFORMANCE MONITORING

### 1. Performance Monitor Implementation

```python
import time
import requests
from typing import Dict, Any

class PerformanceMonitor:
    """Track and analyze query performance metrics."""
    
    def __init__(self):
        self.timings: Dict[str, Dict[str, float]] = {}
        self.prompt_tokens = 0
        self.llm_tokens_in = 0
        self.llm_tokens_out = 0
    
    def start(self, operation_name: str):
        """Start timing an operation."""
        self.timings[operation_name] = {
            "start": time.time(),
            "end": None
        }
    
    def stop(self, operation_name: str):
        """Stop timing an operation."""
        if operation_name in self.timings:
            self.timings[operation_name]["end"] = time.time()
    
    def measure_network_latency(self, url: str = "https://api.groq.com/openai/v1"):
        """Measure network latency to LLM endpoint."""
        t = time.time()
        try:
            requests.get(url, timeout=2)
            self.timings["network_latency"] = {
                "start": t,
                "end": time.time()
            }
        except Exception:
            self.timings["network_latency"] = {
                "start": t,
                "end": time.time()
            }
    
    def set_llm_token_usage(self, input_tokens: int, output_tokens: int):
        """Record LLM token usage."""
        self.llm_tokens_in = input_tokens
        self.llm_tokens_out = output_tokens
    
    def report(self):
        """Generate performance report."""
        print("\n" + "="*50)
        print("PERFORMANCE REPORT")
        print("="*50)
        
        total_time = 0
        
        for name, times in self.timings.items():
            if times["end"] is None:
                continue
            
            duration = round(times["end"] - times["start"], 3)
            total_time += duration
            print(f"{name.upper():25} {duration:8} sec")
        
        print(f"{'TOTAL TIME':25} {round(total_time, 3):8} sec")
        print(f"{'PROMPT TOKENS':25} {self.prompt_tokens:8}")
        print(f"{'LLM INPUT TOKENS':25} {self.llm_tokens_in:8}")
        print(f"{'LLM OUTPUT TOKENS':25} {self.llm_tokens_out:8}")
        print("="*50)
        
        # Root cause analysis
        print("\nROOT CAUSE ANALYSIS")
        print("-"*50)
        
        slowest = max(
            self.timings.items(),
            key=lambda x: x[1]["end"] - x[1]["start"] if x[1]["end"] else 0,
            default=None
        )
        
        if slowest:
            name, times = slowest
            slow_time = round(times["end"] - times["start"], 3)
            
            print(f"Slowest component: {name.upper()} ({slow_time}s)")
            
            if "llm" in name.lower():
                print("→ LLM processing is the bottleneck.")
                print("  Suggestions: Reduce prompt size or use a faster model.")
            elif "sql" in name.lower():
                print("→ SQL execution is slow.")
                print("  Suggestions: Check indexing or add database filters.")
            elif "memory" in name.lower():
                print("→ Memory search is slow.")
                print("  Suggestions: Reduce memory size or use faster vector store.")
            elif "network" in name.lower():
                print("→ Network is slow.")
                print("  Suggestions: Check internet connection or Groq endpoint latency.")
        
        print("="*50 + "\n")

# Usage in main application
monitor = PerformanceMonitor()

# Track operations
monitor.start("prompt_build")
# ... build prompt ...
monitor.stop("prompt_build")

monitor.start("llm_request")
response = await llm.client.chat.completions.create(...)
monitor.stop("llm_request")
monitor.set_llm_token_usage(response.usage.prompt_tokens, response.usage.completion_tokens)

monitor.start("memory_search")
results = await agent.agent_memory.search(...)
monitor.stop("memory_search")

monitor.start("sql_execution")
result = await sql_runner.execute(sql)
monitor.stop("sql_execution")

monitor.measure_network_latency()

monitor.report()

# Expected output:
# ==================================================
# PERFORMANCE REPORT
# ==================================================
# PROMPTBUILD              0.118 sec
# MEMORYSEARCH             0.043 sec
# LLMREQUEST               2.941 sec
# SQLEXECUTION             0.221 sec
# NETWORKLATENCY           0.132 sec
# TOTAL TIME               3.558 sec
# PROMPT TOKENS                 2100
# LLM INPUT TOKENS              1980
# LLM OUTPUT TOKENS                85
# ==================================================
```

---

## QUICK START GUIDE

### Step 1: Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# requirements.txt content:
vanna==2.0.1
oracledb>=2.0.0
chromadb>=0.4.0
fastapi>=0.104.0
uvicorn>=0.24.0
python-dotenv>=1.0.0
requests>=2.31.0
```

### Step 2: Configuration

```bash
# Create .env file
cat > .env << EOF
# Groq LLM
GROQ_API_KEY=gsk_your_api_key_here

# Oracle Database
ORACLE_USER=C##MAJED
ORACLE_PASSWORD=StrongPass123
ORACLE_DSN=192.168.1.36:1521/ORCL

# Application
APP_HOST=0.0.0.0
APP_PORT=8000
DEBUG=False
EOF
```

### Step 3: Initialize Agent

```python
# main_v13.py
import logging
from fastapi import FastAPI
from vanna import Agent, AgentConfig
from vanna.integrations.openai import OpenAILlmService
from vanna.integrations.oracle import OracleRunner
from vanna.integrations.chromadb import ChromaAgentMemory
from vanna.servers.fastapi import VannaFastAPIServer
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize components
llm = OpenAILlmService(
    model="llama-3.1-8b-instant",
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

sql_runner = OracleRunner(
    user=os.getenv("ORACLE_USER"),
    password=os.getenv("ORACLE_PASSWORD"),
    dsn=os.getenv("ORACLE_DSN")
)

agent_memory = ChromaAgentMemory(
    collection_name="vanna_memory",
    persist_directory="./chroma_db"
)

config = AgentConfig(
    agent_name="Vanna PRO v13",
    enable_memory=True,
    max_prompt_tokens=1500,
    temperature=0.2,
    measure_performance=True
)

agent = Agent(
    llm_service=llm,
    sql_runner=sql_runner,
    agent_memory=agent_memory,
    config=config
)

# Create FastAPI server
server = VannaFastAPIServer(agent=agent)
app = server.create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Step 4: Run Server

```bash
# Development
uvicorn main_v13:app --reload --host 0.0.0.0 --port 8000

# Production
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main_v13:app --bind 0.0.0.0:8000

# Access:
# Web UI: http://127.0.0.1:8000
# API Docs: http://127.0.0.1:8000/docs
# ReDoc: http://127.0.0.1:8000/redoc
```

### Step 5: Test

```bash
# Test LLM
python -c "from main_v13 import llm; print(llm.client.chat.completions.create(model='llama-3.1-8b-instant', messages=[{'role': 'user', 'content': 'Hello'}]).choices[0].message.content)"

# Test Oracle
python oracle_diagnostic.py

# Test Agent
python -c "
import asyncio
from main_v13 import agent

async def test():
    response = await agent.ask('Show me first 5 customers')
    print(response['sql_query'])

asyncio.run(test())
"
```

---

## FUNCTIONS SUMMARY TABLE

| Function | Module | Purpose | Returns |
|----------|--------|---------|---------|
| `agent.ask()` | vanna.agent | Ask question in natural language | Dict with SQL, result, metadata |
| `agent.execute_sql()` | vanna.agent | Execute pre-written SQL | Query result |
| `agent.train()` | vanna.agent | Train on Q&A pair | Status |
| `agent.train_schema()` | vanna.agent | Learn database schema | Status |
| `agent.train_document()` | vanna.agent | Train on documentation | Status |
| `agent.train_ddl()` | vanna.agent | Train on DDL statements | Status |
| `agent.rebuild_memory()` | vanna.agent | Rebuild vector embeddings | Status |
| `llm.chat()` | vanna.integrations | Call LLM with message | Dict with response |
| `llm.client.chat.completions.create()` | vanna.integrations | OpenAI-compatible API call | ChatCompletion object |
| `sql_runner.execute()` | vanna.integrations | Execute SQL query | Result dict |
| `sql_runner.get_schema()` | vanna.integrations | Get database schema | Schema dict |
| `sql_runner.validate_sql()` | vanna.integrations | Validate SQL syntax | Boolean |
| `sql_runner.get_constraints()` | vanna.integrations | Get FK relationships | List of constraints |
| `agent_memory.search()` | vanna.integrations | Search memory for patterns | List of results |
| `agent_memory.save_question_tool_args()` | vanna.integrations | Save Q&A to memory | Status |
| `agent_memory.save_text()` | vanna.integrations | Save notes to memory | Status |
| `tool_registry.register_local_tool()` | vanna.core | Register a tool | Status |
| `tool_registry.list_tools()` | vanna.core | List all tools | List of tool names |
| `tool_registry.get_tool()` | vanna.core | Get specific tool | Tool object |

---

## IMPORTANT WARNINGS & BEST PRACTICES

### ⚠️ Critical Warnings

1. **LLM Method Names**
   ```python
   # ✅ CORRECT
   response = llm.chat("message")
   response = llm.client.chat.completions.create(...)
   
   # ❌ INCORRECT (Vanna 1.x only)
   response = llm.completion(...)  # Does not exist in 2.0.1
   response = llm.generate(...)    # May not exist in 2.0.1
   ```

2. **SQL Dialect Translation**
   ```python
   # ❌ WRONG: Use LIMIT for Oracle/MSSQL
   "SELECT * FROM customers LIMIT 10"
   
   # ✅ CORRECT: Use FETCH FIRST for Oracle
   "SELECT * FROM customers FETCH FIRST 10 ROWS ONLY"
   
   # ✅ CORRECT: Use OFFSET...FETCH for MSSQL
   "SELECT * FROM customers OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY"
   ```

3. **Memory Persistence**
   ```python
   # ❌ WRONG: Data lost on restart
   from vanna.core.memory import DemoAgentMemory
   agent_memory = DemoAgentMemory(max_items=1000)  # In-memory only!
   
   # ✅ CORRECT: Persistent memory
   from vanna.integrations.chromadb import ChromaAgentMemory
   agent_memory = ChromaAgentMemory(
       collection_name="vanna_memory",
       persist_directory="./chroma_db"
   )
   ```

4. **Token Costs**
   ```
   Without monitoring = LLM bills explode!
   
   Groq API:
   - Tokens are basically free (~$0.00015 per 1M tokens)
   - But unlimited usage can cause issues
   
   OpenAI API:
   - GPT-4: $0.03/$0.06 per 1K input/output tokens
   - GPT-4o: $0.005/$0.015 per 1K input/output tokens
   - 10,000 queries × 1000 tokens = $15-150 per day!
   
   Always implement rate limiting and token counting.
   ```

5. **Memory Size Management**
   ```python
   # Monitor memory size
   stats = agent_memory.get_statistics()
   # Returns: {"total_items": 245, "size_mb": 45.2}
   
   # If memory gets too large:
   # - Reduce max_items
   # - Implement cleanup policy
   # - Use Qdrant or Pinecone instead of ChromaDB
   ```

### ✅ Best Practices

1. **Always validate SQL before execution**
   ```python
   if sql_runner.validate_sql(sql):
       result = await sql_runner.execute(sql)
   else:
       return {"error": "Invalid SQL"}
   ```

2. **Implement comprehensive error handling**
   ```python
   try:
       response = await agent.ask(question)
   except SQLSyntaxError as e:
       return {"error": "SQL syntax error", "details": str(e)}
   except DatabaseConnectionError as e:
       return {"error": "Database unreachable", "details": str(e)}
   except LLMError as e:
       return {"error": "LLM service error", "details": str(e)}
   except Exception as e:
       return {"error": "Unexpected error", "details": str(e)}
   ```

3. **Monitor query performance**
   ```python
   monitor = PerformanceMonitor()
   monitor.start("query_execution")
   result = await agent.ask(question)
   monitor.stop("query_execution")
   
   if monitor.timings["query_execution"]["end"] - monitor.timings["query_execution"]["start"] > 5:
       log_slow_query(question)
   
   monitor.report()
   ```

4. **Implement proper authentication**
   ```python
   # Use JWT tokens
   @app.get("/protected")
   async def protected_endpoint(token: str = Depends(verify_jwt)):
       user = get_user_from_token(token)
       return {"message": f"Hello {user.username}"}
   ```

5. **Log everything**
   ```python
   import logging
   
   logger = logging.getLogger("vanna")
   logger.setLevel(logging.DEBUG)
   
   handler = logging.FileHandler("logs/vanna.log")
   formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
   handler.setFormatter(formatter)
   logger.addHandler(handler)
   
   # Now all operations are logged
   logger.info(f"Query executed: {question}")
   logger.error(f"Query failed: {error}")
   ```

6. **Regular memory maintenance**
   ```python
   # Weekly cleanup
   async def cleanup_old_memories():
       # Delete memories older than 90 days
       cutoff_date = datetime.now() - timedelta(days=90)
       await agent_memory.delete_before(cutoff_date)
   
   # Rebuild index periodically
   async def rebuild_memory_index():
       await agent_memory.clear_cache()
       await agent.rebuild_memory()
   ```

---

## VERSION INFORMATION

- **Vanna Version**: 2.0.1
- **Python Version**: 3.10+
- **Last Updated**: December 31, 2025
- **License**: MIT/Apache 2.0
- **Repository**: https://github.com/vanna-ai/vanna
- **Documentation**: https://vanna.ai/docs
- **PyPI**: https://pypi.org/project/vanna/

---

## RELATED RESOURCES

- [Vanna Official Documentation](https://vanna.ai/docs)
- [GitHub Repository](https://github.com/vanna-ai/vanna)
- [API Reference](https://vanna.ai/docs/api)
- [Integrations](https://vanna.ai/docs/integrations)
- [Community Forum](https://github.com/vanna-ai/vanna/discussions)

---

**Document Prepared For**: Production Implementation  
**Status**: Complete and Ready for Use  
**Last Reviewed**: December 31, 2025  

