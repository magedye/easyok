# Sentry ↔ SigNoz Trace Correlation

## Requirement
Every Sentry issue must be correlatable to a SigNoz trace for the same event.

## Mechanism
- Enable `SENTRY_ENABLE_OTEL_BRIDGE=true` (env).
- Ensure OTEL is configured (OTEL_EXPORTER_OTLP_ENDPOINT set).
- Sentry events include `trace_id` propagated from OTel spans.
- SigNoz traces carry the same `trace_id` (ask.request root).

## Usage
- Sentry issue → copy `trace_id` → search in SigNoz traces.
- SigNoz trace → use `trace_id` to locate Sentry issue via permalink.

## Notes
- No duplication of dashboards: Sentry remains for deep exception analysis; SigNoz remains the primary observability UI.
