

# 🛡️ EasyData Backend — Fortress-Governed AI Data System

**EasyData Backend** is a **governance-first, security-hardened backend system** for natural-language data analysis.
It is designed as a **Fortress Architecture**: deterministic at startup, audit-ready at runtime, and intolerant to silent drift.

This repository represents the **final, locked backend state** after full governance enforcement.

---

## 🚀 Purpose

EasyData Backend provides:

* Natural Language → SQL analysis
* Strict schema access governance
* NDJSON streaming responses (contract-driven)
* Training and learning workflows under explicit approval
* Full auditability and traceability
* Frontend-agnostic, contract-first APIs

The system **refuses to start** if governance requirements are violated.

---

## 🧱 Core Principles

### Governance First

* No implicit behavior
* No silent bypasses
* No environment ambiguity
* No training without policy + audit

### Fail Fast

* Startup crashes on misconfiguration
* Hard errors on contract violations
* Explicit skips only (never silent)

### Contract Sovereignty

* Environment schema (`.env.schema`) is the SSOT
* OpenAPI & NDJSON contracts are binding
* Frontend behavior is dictated by backend reality

---

## 🏗️ Architecture Overview

**Stack**

* **Framework:** FastAPI
* **Runtime:** Python 3.11
* **Streaming:** NDJSON (ordered chunks)
* **DB Providers:** Oracle / MSSQL (exclusive)
* **Vector Stores:** ChromaDB / Qdrant
* **LLM Providers:** OpenAI / Groq / others (pluggable)
* **Observability:** OpenTelemetry (disabled in local by default)
* **Testing:** Pytest + Playwright (integration)

---

## 🔐 Governance Model

### Schema Access Policy (Core Primitive)

All data access is governed by an **Active SchemaAccessPolicy**:

* Allowed tables
* Allowed columns per table
* Explicit deny rules
* Lifecycle: draft → active → revoked

**No active policy = no training, no SQL, no metadata access.**

---

### Training Readiness Guard

Training or learning is allowed **only if**:

* `ENABLE_AUDIT_LOGGING=true`
* An **active SchemaAccessPolicy** exists
* Training readiness is enforced (`TRAINING_READINESS_ENFORCED=true`)

Local development may disable readiness **explicitly** — never implicitly.

---

## 🧬 Startup Sequence (Sacred Order)

The following order is **mandatory** and enforced:

1. Load settings (`settings.py`)
2. Enforce environment boundaries
3. Bootstrap local schema policy *(ENV=local only)*
4. Assert training readiness
5. Create and run the application

Any reordering is a **governance violation**.

---

## 🌍 Environment Model

### Supported Environments

* `local` — Development (explicit governance path)
* `ci` — Automated validation
* `production` — Fully enforced, no bypasses

### Environment Schema

* `.env.schema` — **Single Source of Truth**
* `.env` / `.env.local` / `.env.production` — Derived
* `sync_env.py` — Enforces schema alignment

**Using an undefined variable is forbidden.**

---

## 🔌 API & Streaming

### API

* Fully documented via OpenAPI
* No duplicated `operationId`
* No undocumented responses

### Streaming (NDJSON)

Ordered chunks:

1. `thinking`
2. `technical_view`
3. `data`
4. `business_view`
5. `error` *(if applicable)*
6. `end`

Rules:

* Order is strict
* All chunks share the same `trace_id`
* No chunks after `end`

---

## 🧪 Testing & Verification

### Test Suite

```bash
pytest -q -rs
```

**Accepted result:**

* 0 Failures
* Explicit Skips only (environment-driven)

### Verification Script

```bash
./verify_backend.sh
```

* Reads environment from `.env`
* Skips auth checks when `AUTH_ENABLED=false`
* Never aborts early
* Always produces a report

---

## 🧰 Local Development

### Requirements

* Python 3.11
* Virtualenv
* Backend DB reachable (or tests skipped)

### Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python sync_env.py
uvicorn main:app --reload
```

### Local Governance Defaults

* Telemetry disabled
* Explicit local bypass only
* No silent training

---

## 🧾 CI & Repository Hardening

* Protected main branch
* Mandatory PRs
* Required CI gates:

  * Pytest
  * Environment schema validation
  * Architectural linting
  * OpenAPI / contract checks
* Sensitive paths protected via CODEOWNERS

---

## 📚 Documentation Entry Points

Start here:

* `/docs/FRONTEND_HANDOFF.md`
* `/docs/api/endpoints.md`
* `/docs/api/streaming.md`
* `/docs/api/errors.md`
* `/docs/governance/frontend-rules.md`
* `/docs/environment/frontend-behavior.md`

---

## 🚫 What This Backend Will NOT Do

* ❌ Guess permissions
* ❌ Infer schema
* ❌ Auto-train
* ❌ Accept malformed environments
* ❌ Run with missing governance
* ❌ Hide errors

---

## ✅ Final Status

* **Governance:** LOCKED
* **Architecture:** STABLE
* **Tests:** PASS (with documented skips)
* **Contracts:** ENFORCED
* **Frontend-Ready:** YES

---

## 📌 License & Usage

This backend is intended for **controlled, auditable environments**.
Any modification must respect the **Governance Lock Protocol**.

---

**EasyData Backend**
*A system that crashes on contradiction — by design.*




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

