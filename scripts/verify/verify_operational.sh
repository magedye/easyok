#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# EasyData — Operational Verification (v5)
# Combines:
#  - v3: Operational Reality (DB / LLM / NDJSON)
#  - v4: Resilience & Failure Expectations
#
# NOT FOR CI. Manual / Staging / Pre-Prod use only.
# =============================================================================

BACKEND="${BACKEND:-http://localhost:8000}"
REPORT="verification_operational_$(date +%Y%m%d%H%M%S).txt"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-1521}"
LLM_ENDPOINT="${LLM_ENDPOINT:-}"

echo "════════════════════════════════════════════════════════════" > "$REPORT"
echo "EasyData Operational Verification — Reality & Resilience" >> "$REPORT"
echo "════════════════════════════════════════════════════════════" >> "$REPORT"
echo "Backend: $BACKEND" >> "$REPORT"
echo "Date   : $(date -u)" >> "$REPORT"
echo >> "$REPORT"

# -----------------------------------------------------------------------------
# Phase 1 — Backend Reachability
# -----------------------------------------------------------------------------
echo "PHASE 1: Backend Reachability" >> "$REPORT"

HC="$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND/api/v1/health/llm" || echo "000")"
if [[ "$HC" == "200" ]]; then
  echo "PASS: Backend health endpoint reachable (200)" >> "$REPORT"
else
  echo "FAIL: Backend health endpoint unreachable (HTTP $HC)" >> "$REPORT"
fi

echo >> "$REPORT"

# -----------------------------------------------------------------------------
# Phase 2 — Database Reachability (Network Only)
# -----------------------------------------------------------------------------
echo "PHASE 2: Database Reachability (Network Only)" >> "$REPORT"

if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
  echo "PASS: DB reachable at $DB_HOST:$DB_PORT" >> "$REPORT"
else
  echo "FAIL: DB unreachable at $DB_HOST:$DB_PORT" >> "$REPORT"
fi

echo >> "$REPORT"

# -----------------------------------------------------------------------------
# Phase 3 — LLM Endpoint Reachability (If Configured)
# -----------------------------------------------------------------------------
echo "PHASE 3: LLM Endpoint Reachability" >> "$REPORT"

if [[ -z "$LLM_ENDPOINT" ]]; then
  echo "INFO: LLM_ENDPOINT not set — skipping reachability check" >> "$REPORT"
else
  CODE="$(curl -s -o /dev/null -w "%{http_code}" "$LLM_ENDPOINT" || echo "000")"
  if [[ "$CODE" == "200" ]]; then
    echo "PASS: LLM endpoint reachable (200)" >> "$REPORT"
  else
    echo "WARN: LLM endpoint unreachable or non-200 (HTTP $CODE)" >> "$REPORT"
  fi
fi

echo >> "$REPORT"

# -----------------------------------------------------------------------------
# Phase 4 — NDJSON Streaming Reality Check
# -----------------------------------------------------------------------------
echo "PHASE 4: NDJSON Streaming (/ask)" >> "$REPORT"

STREAM="$(curl -s -N -H "Content-Type: application/json" \
  -d '{"question":"operational verification"}' \
  "$BACKEND/api/v1/ask" 2>/dev/null | head -n 5)"

if echo "$STREAM" | grep -q '"type"'; then
  echo "PASS: NDJSON stream detected" >> "$REPORT"
else
  echo "FAIL: NDJSON stream missing or malformed" >> "$REPORT"
fi

echo >> "$REPORT"

# -----------------------------------------------------------------------------
# Phase 5 — Concurrency Smoke Test (Resilience Signal)
# -----------------------------------------------------------------------------
echo "PHASE 5: Concurrency Smoke Test (5x /ask)" >> "$REPORT"

FAIL_COUNT=0
for i in {1..5}; do
  (
    CODE="$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Content-Type: application/json" \
      -d '{"question":"concurrency check"}' \
      "$BACKEND/api/v1/ask" || echo "000")"
    [[ "$CODE" == "200" ]] || echo "fail"
  ) &
done

wait || true

if grep -q "fail" <<<"$(jobs -p 2>/dev/null)"; then
  echo "WARN: One or more concurrent requests failed — inspect logs" >> "$REPORT"
else
  echo "INFO: Concurrency test executed — review logs for latency/errors" >> "$REPORT"
fi

echo >> "$REPORT"

# -----------------------------------------------------------------------------
# Phase 6 — Failure Expectations (Manual / Intentional)
# -----------------------------------------------------------------------------
echo "PHASE 6: Failure Expectations (Manual Validation)" >> "$REPORT"

echo "- LLM outage:" >> "$REPORT"
echo "  Expect structured error (no crash, no hang)." >> "$REPORT"

echo "- DB outage:" >> "$REPORT"
echo "  Expect graceful failure with explicit error." >> "$REPORT"

echo "- Timeout handling:" >> "$REPORT"
echo "  Expect bounded wait + structured error." >> "$REPORT"

echo "- Circuit breaker behavior:" >> "$REPORT"
echo "  Expect repeated failures to degrade safely." >> "$REPORT"

echo >> "$REPORT"

# -----------------------------------------------------------------------------
# Final
# -----------------------------------------------------------------------------
echo "════════════════════════════════════════════════════════════" >> "$REPORT"
echo "Verification complete." >> "$REPORT"
echo "Report: $REPORT" >> "$REPORT"

echo "🛡️ Operational verification completed"
echo "📄 Report saved to: $REPORT"
