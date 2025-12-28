# SigNoz Integration (OTel / OTLP)

This document defines how EasyData exports traces/metrics to SigNoz without changing runtime behaviour or security.

## Backend (FastAPI)
- Already instrumented via `app/telemetry.py` (OpenTelemetry).
- Configure via environment:
  - `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g., `http://localhost:4318/v1/traces` for self-hosted SigNoz).
  - `OTEL_SERVICE_NAME` (e.g., `easydata-backend`).
  - `OTEL_SAMPLER_RATIO` (0–1).
  - `OTEL_EXPORTER_OTLP_HEADERS` (if SigNoz Cloud requires auth headers).
- Spans emitted (metadata only; no SQL/PII):
  - `ask.request`
  - `llm.sql_generation`
  - `sql_guard.validation`
  - `db.execution`
  - `stream.technical_view`
  - `stream.data`
  - `ragas.evaluation` (async, when invoked)
  - Attributes: `question`, `schema_version`, `policy_version`, `llm_provider`, `sql_hash` (never raw SQL), no rows/PII.

## Frontend (optional, phase 2)
- Can add OTel browser tracing to emit spans to the same OTLP endpoint; not included in this stage.

## Dashboards to provision in SigNoz
- Ask latency (p50/p95) using `ask.request`.
- SQLGuard block rate / top violation reasons (from `sql_guard.validation` + status).
- DB execution latency (from `db.execution`).
- Streaming phases timing (`stream.technical_view`, `stream.data`).
- RAGAS faithfulness trend (`ragas.evaluation` spans + stored metrics).
- Error rate by schema/policy version (use attributes on spans).

## Security/Privacy
- Never export raw SQL or result rows.
- Only hashes/metadata; PII masking enforced upstream.
- Governance unchanged: SQLGuard + SchemaAccessPolicy still enforced; tracing is observational only.
