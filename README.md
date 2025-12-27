# EasyData Backend

FastAPI backend for natural-language-to-SQL on Oracle/MSSQL with LLM (Groq/OpenAI/etc.) and Chroma/Qdrant vector stores. Follows the canonical architecture in `docs/guidelines.md`, `docs/project_design_document.md`, and API contract `master_api_contract.md`.

## Prerequisites
- Python 3.11
- Local venv at `./.venv` (PEP 668 compliant)
- Oracle client (thin driver via `oracledb`) if using Oracle
- Access keys for the selected LLM provider
- No system-wide `pip install` (use the venv only)

## Setup
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Configuration
Edit `.env` (single source of truth). Minimum for Oracle + Groq + Chroma:
```
DB_PROVIDER=oracle
ORACLE_CONNECTION_STRING=oracle+oracledb://USER:PASSWORD@HOST:PORT/SERVICE
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_key
VECTOR_DB=chromadb
VECTOR_STORE_PATH=./data/vectorstore
AUTH_ENABLED=false
RBAC_ENABLED=false
RLS_ENABLED=false
```
Other keys (see `app/core/config.py` and `.env` template):
- `JWT_SECRET_KEY` (required when `AUTH_ENABLED=true`)
- `OPENAI_API_KEY`, `GOOGLE_API_KEY`, etc. depending on `LLM_PROVIDER`
- `QDRANT_URL`, `QDRANT_API_KEY` if `VECTOR_DB=qdrant`

## Running the backend
```bash
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
API base path: `/api/v1`. NDJSON streaming contract is in `AskResponse_NDJSON_Schema.md`.

## Key endpoints
- `POST /api/v1/ask` — NDJSON stream: `technical_view` → `data` → `chart` → `summary`
- `POST /api/v1/auth/login` — demo login (admin/changeme)
- `GET /api/v1/auth/me`
- `POST /api/v1/admin/training/approve`
- `GET /api/v1/health/llm`

## Oracle DDL extraction/training
```bash
source .venv/bin/activate
export VANNA_ALLOW_DDL=true
python scripts/oracle/extract_and_ingest_ddl.py --owner <OWNER> --skip-venv-check --overwrite
```
- Writes DDL docs to Chroma collection `ddl` under `VECTOR_STORE_PATH`.
- Use `--list-owners` to enumerate schemas; `--dry-run` to preview.

## Tests
```bash
source .venv/bin/activate
pytest -q
```
All tests currently pass; warnings for the `integration` mark and a Chromadb/Pydantic deprecation are benign.

## Frontend
Frontend sources are under `frontend/`. See `FRONTEND.md` for build/run steps if you need the UI.

## Project structure (selected)
- `main.py` — ASGI entrypoint, router wiring, middleware toggles
- `app/api/v1/` — FastAPI routes (`ask`, `auth`, `admin`, `health`)
- `app/services/` — business services (`orchestration_service.py`, `vanna_service.py`)
- `app/providers/` — LLM/DB/vector providers and factory
- `scripts/oracle/` — DDL extraction and ingestion utilities
- `tests/` — integration/contract tests (Oracle, auth, ask streaming, health)
- `docs/` — architecture, API contract, ADRs, requirements

## Security notes
- Use read-only DB credentials.
- Keep secrets in `.env`; do not commit them.
- Set `AUTH_ENABLED=true` and `RBAC_ENABLED=true` for non-dev use; ensure `JWT_SECRET_KEY` is set.

