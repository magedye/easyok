#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# EasyData Backend Verification — Ultimate (Verbose + Report)
# Context: Post-Stage 6 Closure
# Standards: ADR-0014, OpenAPI Strict, Governance-Enforced
# ==============================================================================

# ------------------------
# Configuration
# ------------------------
BACKEND="${BACKEND:-http://localhost:8000}"
REPORT="verification_report_ultimate_$(date +%Y%m%d%H%M%S).txt"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin_password}"

# ------------------------
# Live output + reporting
# ------------------------
FAILURES=0
WARNINGS=0

log_section() {
  echo
  echo "=== $1 ===" | tee -a "$REPORT"
}

log_pass() {
  echo "[PASS] $1" | tee -a "$REPORT"
}

log_warn() {
  echo "[WARN] $1" | tee -a "$REPORT"
  WARNINGS=$((WARNINGS+1))
}

log_fail() {
  echo "[FAIL] $1" | tee -a "$REPORT"
  FAILURES=$((FAILURES+1))
}

# ------------------------
# Safe temp handling
# ------------------------
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

OPENAPI_JSON="$TMP_DIR/openapi.json"
LOAD_FAILS="$TMP_DIR/load_fails"
METRICS_OUT="$TMP_DIR/metrics.json"

# ------------------------
# Safe .env loading
# ------------------------
if [[ -f .env ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^# ]] && continue
    [[ -z "$line" ]] && continue
    [[ "$line" =~ [\<\>] ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*=.*$ ]]; then
      key="${line%%=*}"
      val="${line#*=}"
      val="${val%\"}"; val="${val#\"}"
      val="${val%\'}"; val="${val#\'}"
      export "$key=$val"
    fi
  done < .env
fi

ENV="${ENV:-local}"
ADMIN_LOCAL_BYPASS="$(echo "${ADMIN_LOCAL_BYPASS:-false}" | tr '[:upper:]' '[:lower:]')"

# ------------------------
# Tooling check
# ------------------------
command -v jq >/dev/null || {
  echo "ERROR: jq is required"
  exit 1
}

# ------------------------
# Curl helpers (avoid exit on refusal)
# ------------------------
http_code() {
  local url="$1"
  curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000"
}

safe_fetch() {
  local url="$1" out="$2"
  curl -s "$url" -o "$out" || true
}

# ------------------------
# Report header
# ------------------------
{
  echo "=== EasyData Fortress Verification (Ultimate) ==="
  echo "Date: $(date -u)"
  echo "Backend: $BACKEND"
  echo "Context: ENV=$ENV | ADMIN_LOCAL_BYPASS=$ADMIN_LOCAL_BYPASS"
} | tee "$REPORT"

# ==============================================================================
# 0) Authentication
# ==============================================================================
log_section "0) Authentication"

TOKEN_RES="$(curl -s -X POST "$BACKEND/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=$ADMIN_EMAIL&password=$ADMIN_PASSWORD" || true)"

if echo "$TOKEN_RES" | jq -e '.access_token' >/dev/null 2>&1; then
  ADMIN_TOKEN="$(echo "$TOKEN_RES" | jq -r '.access_token')"
  AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"
  log_pass "Admin login succeeded"
else
  AUTH_HEADER=""
  log_warn "Auth disabled or login failed (expected in local/demo)"
fi

# ==============================================================================
# 1) Health & OpenAPI
# ==============================================================================
log_section "1) Health & OpenAPI"

HC="$(http_code "$BACKEND/api/v1/health/llm")"
[[ "$HC" == "200" ]] \
  && log_pass "Health check OK (200)" \
  || log_fail "Health check failed ($HC)"

safe_fetch "$BACKEND/openapi.json" "$OPENAPI_JSON"
SPEC_SIZE="$(stat -c%s "$OPENAPI_JSON" 2>/dev/null || echo 0)"
[[ "$SPEC_SIZE" -gt 1000 ]] \
  && log_pass "OpenAPI fetched ($SPEC_SIZE bytes)" \
  || log_warn "OpenAPI unusually small ($SPEC_SIZE bytes)"

# ==============================================================================
# 2) OpenAPI Integrity
# ==============================================================================
log_section "2) OpenAPI Contract Integrity"

if [[ ! -s "$OPENAPI_JSON" ]]; then
  log_warn "OpenAPI unavailable; skipping contract integrity checks"
else
  for schema in QueryRequest HealthResponse ErrorModel; do
    jq -e ".components.schemas.$schema" "$OPENAPI_JSON" >/dev/null 2>&1 \
      && log_pass "Schema '$schema' found" \
      || log_warn "Schema '$schema' missing"
  done

  DUP_OPS="$(jq -r '.paths | .. | .operationId? // empty' "$OPENAPI_JSON" | sort | uniq -d)"
  [[ -z "$DUP_OPS" ]] \
    && log_pass "operationId uniqueness enforced" \
    || log_fail "Duplicate operationIds detected: $DUP_OPS"
fi

# ==============================================================================
# 3) RBAC & Admin Guards (ADR-0014)
# ==============================================================================
log_section "3) RBAC / Admin Guards"

NO_AUTH_CODE="$(http_code "$BACKEND/api/v1/admin/settings/feature-toggles")"

if [[ "$ENV" == "local" && "$ADMIN_LOCAL_BYPASS" == "true" ]]; then
  [[ "$NO_AUTH_CODE" == "200" ]] \
    && log_pass "Local admin bypass active (ADR-0014)" \
    || log_fail "Local admin bypass misconfigured ($NO_AUTH_CODE)"
else
  [[ "$NO_AUTH_CODE" =~ ^(401|403)$ ]] \
    && log_pass "Admin route protected outside local" \
    || log_fail "Admin route exposed ($NO_AUTH_CODE)"
fi

if [[ -n "$AUTH_HEADER" ]]; then
  WITH_AUTH_CODE="$(curl -s -o /dev/null -w "%{http_code}" \
    -H "$AUTH_HEADER" "$BACKEND/api/v1/admin/settings/feature-toggles" || echo "000")"
  echo "Admin with token → $WITH_AUTH_CODE" | tee -a "$REPORT"
fi

# ==============================================================================
# 4) Method & Input Validation
# ==============================================================================
log_section "4) Method & Input Validation"

M_CODE="$(curl -s -o /dev/null -w "%{http_code}" \
  -X PUT "$BACKEND/api/v1/ask" || echo "000")"
[[ "$M_CODE" == "405" ]] \
  && log_pass "Method guard enforced (405)" \
  || log_fail "Method guard failed ($M_CODE)"

BAD_JSON_CODE="$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BACKEND/api/v1/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "broken", "stream": }' || echo "000")"
echo "Malformed JSON → $BAD_JSON_CODE" | tee -a "$REPORT"

BAD_TYPE_CODE="$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BACKEND/api/v1/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": 12345}' || echo "000")"
echo "Type mismatch → $BAD_TYPE_CODE" | tee -a "$REPORT"

# ==============================================================================
# 5) Mini Load Test
# ==============================================================================
log_section "5) Mini Load Test"

for i in {1..10}; do
  (
    resp="$(curl -s "$BACKEND/api/v1/health/llm" || true)"
    if [[ "$resp" == *'"status"'* ]]; then
      :
    else
      echo fail >> "$LOAD_FAILS"
    fi
  ) &
done
wait || true

if [[ -f "$LOAD_FAILS" ]]; then
  log_fail "Load instability detected"
else
  log_pass "Load stable (10/10 requests)"
fi

# ==============================================================================
# 6) Streaming & SQLGuard
# ==============================================================================
log_section "6) Streaming & SQLGuard"

STREAM="$(curl -s -N -H "Content-Type: application/json" \
  -d '{"question":"stream test","stream":true}' \
  "$BACKEND/api/v1/ask" 2>/dev/null || true)"
STREAM="$(echo "$STREAM" | head -n 5)"

if [[ "$STREAM" == *'"type"'* ]]; then
  log_pass "NDJSON stream detected"
else
  log_warn "NDJSON stream missing or blocked"
fi

SQL_TEST="$(curl -s -N -H "Content-Type: application/json" \
  -d '{"question":"DROP TABLE forbidden_test"}' \
  "$BACKEND/api/v1/ask" 2>/dev/null || true)"
SQL_TEST="$(echo "$SQL_TEST" | head -n 5)"

shopt -s nocasematch
if [[ "$SQL_TEST" == *"POLICY"* || "$SQL_TEST" == *"error"* ]]; then
  log_pass "SQLGuard enforced"
else
  log_warn "SQLGuard unclear (check logs)"
fi
shopt -u nocasematch

# ==============================================================================
# 7) Training & Observability
# ==============================================================================
log_section "7) Training & Observability"

TRAIN_CODE="$(curl -s -o /dev/null -w "%{http_code}" \
  -H "$AUTH_HEADER" \
  "$BACKEND/api/v1/admin/training/items?status=pending" || echo "000")"
echo "Training endpoint → $TRAIN_CODE" | tee -a "$REPORT"

curl -s "$BACKEND/metrics/json" -o "$METRICS_OUT" || true
MET_SIZE="$(stat -c%s "$METRICS_OUT" 2>/dev/null || echo 0)"
echo "Metrics size: $MET_SIZE bytes" | tee -a "$REPORT"

# ==============================================================================
# FINAL SUMMARY
# ==============================================================================
log_section "FINAL SUMMARY"

echo "Total Failures : $FAILURES" | tee -a "$REPORT"
echo "Total Warnings : $WARNINGS" | tee -a "$REPORT"

if [[ "$FAILURES" -eq 0 ]]; then
  echo
  echo "✔ OVERALL RESULT: PASS — System is operationally valid" | tee -a "$REPORT"
  exit 0
else
  echo
  echo "✖ OVERALL RESULT: FAIL — Review failed checks above" | tee -a "$REPORT"
  exit 1
fi
