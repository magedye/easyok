# 🛡️ EasyData Backend — Fortress-Governed AI Data System

**EasyData Backend** is a governance-first, security-hardened backend for natural-language data analysis. It follows a Fortress Architecture: deterministic at startup, audit-ready at runtime, and intolerant to silent drift. This repository represents the final, locked backend state after full governance enforcement.

---

## 🚀 Purpose
- Natural Language → SQL analysis
- Strict schema access governance
- NDJSON streaming responses (contract-driven)
- Training and learning under explicit approval
- Full auditability and traceability
- Frontend-agnostic, contract-first APIs
- The system refuses to start if governance requirements are violated.

---

## 🧱 Core Principles
### Governance First
- No implicit behavior
- No silent bypasses
- No environment ambiguity
- No training without policy + audit

### Fail Fast
- Startup crashes on misconfiguration
- Hard errors on contract violations
- Explicit skips only (never silent)

### Contract Sovereignty
- `.env.schema` is SSOT
- OpenAPI & NDJSON contracts are binding
- Frontend behavior is dictated by backend reality

---

## 🏗️ Architecture Overview
- **Framework:** FastAPI
- **Runtime:** Python 3.11
- **Streaming:** NDJSON (ordered chunks)
- **DB Providers:** Oracle / MSSQL (exclusive)
- **Vector Stores:** ChromaDB / Qdrant
- **LLM Providers:** OpenAI / Groq / others (pluggable)
- **Observability:** OpenTelemetry (disabled in local by default)
- **Testing:** Pytest + Playwright (integration)

---

## 🔐 Governance Model
### Schema Access Policy (Core Primitive)
- Active SchemaAccessPolicy governs allowed/denied tables/columns.
- Lifecycle: draft → active → revoked.
- No active policy = no training, no SQL, no metadata access.

### Training Readiness Guard
- Requires `ENABLE_AUDIT_LOGGING=true`, active SchemaAccessPolicy, and `TRAINING_READINESS_ENFORCED=true`.
- Local dev may disable readiness explicitly (never implicitly).

---

## 🧬 Startup Sequence (Sacred Order)
1. Load settings (`settings.py`)
2. Enforce environment boundaries
3. Bootstrap local schema policy (ENV=local only)
4. Assert training readiness
5. Create and run the application

Any reordering is a governance violation.

---

## 🌍 Environment Model
- Supported: `local`, `ci`, `production`
- `.env.schema` is the Single Source of Truth
- `.env` / `.env.local` / `.env.production` derived from schema
- `sync_env.py` enforces schema alignment
- Using an undefined variable is forbidden.

Local defaults (recommended):
- `ENV=local`, `ADMIN_LOCAL_BYPASS=true`
- `ENABLE_AUDIT_LOGGING=true`
- `TRAINING_READINESS_ENFORCED=false`
- `ENABLE_TELEMETRY=false`, `ENABLE_OTEL=false`, `ANON_TELEMETRY=false`

---

## 🔌 API & Streaming
### API
- Fully documented via OpenAPI
- No duplicate `operationId`
- No undocumented responses

### Streaming (NDJSON)
Ordered chunks:
1. `thinking`
2. `technical_view`
3. `data`
4. `business_view`
5. `error` (if applicable)
6. `end`

Rules: strict order, shared `trace_id`, nothing after `end`.

---

## 🧪 Testing & Verification
### Test Suite
```bash
pytest -q -rs
```
Accepted: 0 failures; explicit, environment-driven skips only.

### Verification Script (local runtime)
```bash
./verify_backend.sh
```
Reads `.env`, skips auth when `AUTH_ENABLED=false`, always emits a report.

### Integration/Optional Gates
- `scripts/verification_v3_operational.sh` (runtime DB/LLM)
- `scripts/verification_v4_resilience.sh` (load/failure injection)
- E2E: `npm run test:ci` (Playwright)

Common gates for legacy/integration:
```bash
export RUN_INTEGRATION_TESTS=true
export RUN_ORACLE_TESTS=true
export RUN_TELEMETRY_TESTS=true
```

---

## 🧰 Local Development
Requirements: Python 3.11, virtualenv, `jq`, `curl` (DB reachable for live tests).

Setup:
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-rag.txt
pip install -r requirements-nlp.txt
python sync_env.py
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Security notes:
- Use read-only DB credentials.
- Keep secrets out of VCS.
- For non-dev, set `AUTH_ENABLED=true`, `RBAC_ENABLED=true`, and `JWT_SECRET_KEY`.

---

## 🧾 CI & Repository Hardening
- Protected main branch; mandatory PRs; no force-push.
- CODEOWNERS on sensitive paths: `app/core/**`, `app/utils/sql_guard.py`, `main.py`, `.env.schema`, `openapi/**`, `.github/workflows/**`, `scripts/verify/**`, `tests/**`.
- Blocking CI gates:
  - `bash -n verify_backend.sh`
  - `python scripts/verify/check_env_schema_parity.py`
  - `pytest -q -rs`
  - `flake8 app` (arch lints)
  - Spectral on `openapi/fortress.yaml` with `openapi/generator/spectral-rules.yaml`
- Nightly/optional: backend smoke + Playwright E2E (no guard weakening).

---

## 📚 Documentation Entry Points
- `/docs/FRONTEND_HANDOFF.md`
- `/docs/api/endpoints.md`
- `/docs/api/streaming.md`
- `/docs/api/errors.md`
- `/docs/governance/frontend-rules.md`
- `/docs/environment/frontend-behavior.md`

---

## 🚫 What This Backend Will NOT Do
- Guess permissions
- Infer schema
- Auto-train
- Accept malformed environments
- Run with missing governance
- Hide errors

---

## ✅ Final Status
- Governance: LOCKED
- Architecture: STABLE
- Tests: PASS (documented skips only)
- Contracts: ENFORCED
- Frontend-Ready: YES

---

## 📌 License & Usage
Intended for controlled, auditable environments. Any change must respect the Governance Lock Protocol.

---

**EasyData Backend** — *A system that crashes on contradiction — by design.*
