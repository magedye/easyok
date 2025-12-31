# Quick Guide — EasyData Backend (Fortress v16.7.9)

## 1) Prereqs
- Python 3.11
- `jq`, `curl`
- Virtualenv at `./.venv` (no system-wide installs)

## 2) Environment (Local)
```bash
cp .env.schema .env   # or keep your existing .env
python scripts/verify/check_env_schema_parity.py
```
Required local flags inside `.env`:
- `ENV=local`
- `ADMIN_LOCAL_BYPASS=true`
- `ENABLE_AUDIT_LOGGING=true`
- `TRAINING_READINESS_ENFORCED=false`
- `ENABLE_TELEMETRY=false`, `ENABLE_OTEL=false`, `ANON_TELEMETRY=false`

## 3) Install
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-rag.txt
pip install -r requirements-nlp.txt
```

## 4) Run Backend
```bash
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Startup order is enforced: settings → environment policy → local policy bootstrap → training readiness → app.

## 5) Verify (Local Runtime)
Backend must be running:
```bash
./verify_backend.sh
```

## 6) Tests (Governance Suite)
```bash
source .venv/bin/activate
pytest -q -rs          # governed/offline tests
```
Integration gates (optional):
```bash
export RUN_INTEGRATION_TESTS=true RUN_ORACLE_TESTS=true RUN_TELEMETRY_TESTS=true
pytest -q -rs
```

## 7) API Contracts
- Canonical spec: `openapi/fortress.yaml`
- Lint: `npx @stoplight/spectral-cli lint openapi/fortress.yaml --ruleset openapi/generator/spectral-rules.yaml`

## 8) Key Rules (Do Not Break)
- `.env.schema` is SSOT; no undefined vars.
- Admin bypass only when `ENV=local` and `ADMIN_LOCAL_BYPASS=true`.
- No training without audit logging + active SchemaAccessPolicy (unless local bypass as above).
- No change to startup order.

