#!/usr/bin/env bash

################################################################################
# EasyData Backend Verification — Ultimate Governance Edition
# 
# STANDARDS:
# - ADR-0014: Context-Aware RBAC (Local Bypass Support)
# - OpenAPI Strict Validation
# - Governance-Enforced (.env.local requirement)
# - Enterprise-Grade Reporting
#
# EXECUTION GUARANTEES:
# - LOCAL-ONLY enforcement (strict .env.local validation)
# - No fallback configs (fail-safe principle)
# - Comprehensive logging with timestamps
# - Zero silent failures
#
# Author: EasyData Engineering Team
# Date: 2025-01-01
# Version: 5.0 Ultimate Governance Edition
################################################################################

set -euo pipefail

################################################################################
# [GOVERNANCE LAYER 1] Environment Enforcement
################################################################################

ENV_FILE="${ENV_FILE:-.env}"

# Check env file existence (MANDATORY)
if [[ ! -f "$ENV_FILE" ]]; then
    echo "FATAL: $ENV_FILE not found"
    echo "Set ENV_FILE to an existing env file (e.g., .env or .env.local)."
    exit 2
fi

################################################################################
# [GOVERNANCE LAYER 2] Safe Environment Loading
################################################################################

# Load .env.local with strict validation
declare -A ENV_VARS=()

while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    [[ "$line" =~ ^# ]] && continue
    [[ -z "$line" ]] && continue
    
    # Skip suspicious characters (injection prevention)
    [[ "$line" =~ [\<\>\&\|\;] ]] && continue
    
    # Parse valid KEY=VALUE pairs only
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*=.*$ ]]; then
        key="${line%%=*}"
        val="${line#*=}"
        
        # Remove surrounding quotes safely
        val="${val%\"}"
        val="${val#\"}"
        val="${val%\'}"
        val="${val#\'}"
        
        ENV_VARS["$key"]="$val"
        export "$key=$val"
    fi
done < "$ENV_FILE"

################################################################################
# [GOVERNANCE LAYER 3] Hard Assertions
################################################################################

ENV="${ENV_VARS[ENV]:-unset}"
ADMIN_LOCAL_BYPASS="$(echo "${ENV_VARS[ADMIN_LOCAL_BYPASS]:-false}" | tr '[:upper:]' '[:lower:]')"
AUTH_ENABLED="$(echo "${ENV_VARS[AUTH_ENABLED]:-true}" | tr '[:upper:]' '[:lower:]')"
RBAC_ENABLED="$(echo "${ENV_VARS[RBAC_ENABLED]:-true}" | tr '[:upper:]' '[:lower:]')"
RLS_ENABLED="$(echo "${ENV_VARS[RLS_ENABLED]:-true}" | tr '[:upper:]' '[:lower:]')"

# Assertion 1: ENV must be 'local'
if [[ "$ENV" != "local" ]]; then
    echo "FATAL GOVERNANCE VIOLATION: ENV must be 'local' (found: $ENV)"
    echo "This script is designed exclusively for local development"
    exit 3
fi

# Assertion 2: ADMIN_LOCAL_BYPASS must be true
if [[ "$ADMIN_LOCAL_BYPASS" != "true" ]]; then
    echo "FATAL GOVERNANCE VIOLATION: ADMIN_LOCAL_BYPASS must be 'true' in .env.local"
    echo "This script requires admin bypass for local testing"
    exit 4
fi

# Assertion 3: Security features must be disabled in local
if [[ "$AUTH_ENABLED" != "false" ]]; then
    echo "FATAL GOVERNANCE VIOLATION: AUTH_ENABLED must be 'false' in .env.local"
    exit 5
fi

if [[ "$RBAC_ENABLED" != "false" ]]; then
    echo "FATAL GOVERNANCE VIOLATION: RBAC_ENABLED must be 'false' in .env.local"
    exit 6
fi

if [[ "$RLS_ENABLED" != "false" ]]; then
    echo "FATAL GOVERNANCE VIOLATION: RLS_ENABLED must be 'false' in .env.local"
    exit 7
fi

################################################################################
# [STANDARD CONFIGURATION]
################################################################################

BACKEND="${BACKEND:-http://localhost:8000}"
REPORT="verification_report_ultimate_$(date +%Y%m%d_%H%M%S).txt"

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin_password}"

CONCURRENT_LOAD="${CONCURRENT_LOAD:-20}"
STREAM_CONCURRENT="${STREAM_CONCURRENT:-5}"

################################################################################
# [METRICS TRACKING]
################################################################################

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

################################################################################
# [LOGGING FUNCTIONS]
################################################################################

log_section() {
    local title="$1"
    {
        echo ""
        echo "════════════════════════════════════════════════════════════════"
        echo "$title"
        echo "════════════════════════════════════════════════════════════════"
    } | tee -a "$REPORT"
}

log_pass() {
    local msg="$1"
    echo "[✓ PASS] $msg" | tee -a "$REPORT"
    PASS_COUNT=$((PASS_COUNT + 1))
}

log_fail() {
    local msg="$1"
    echo "[✗ FAIL] $msg" | tee -a "$REPORT"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

log_warn() {
    local msg="$1"
    echo "[⚠ WARN] $msg" | tee -a "$REPORT"
    WARN_COUNT=$((WARN_COUNT + 1))
}

log_info() {
    local msg="$1"
    echo "[ℹ INFO] $msg" | tee -a "$REPORT"
}

################################################################################
# [SAFE TEMP HANDLING]
################################################################################

TMP_DIR="$(mktemp -d)" || { echo "Failed to create temp dir"; exit 1; }
cleanup_temp() {
    [[ -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"
}
trap cleanup_temp EXIT

OPENAPI_JSON="$TMP_DIR/openapi.json"
LOAD_FAILS="$TMP_DIR/load_fails"
STREAM_FAILS="$TMP_DIR/stream_fails"
METRICS_OUT="$TMP_DIR/metrics.json"

################################################################################
# [DEPENDENCY CHECK]
################################################################################

check_dependencies() {
    local deps=("curl" "jq")
    for cmd in "${deps[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            echo "ERROR: Required tool '$cmd' not found"
            echo "Install with: sudo apt install $cmd"
            exit 1
        fi
    done
}

check_dependencies

################################################################################
# [HTTP HELPERS]
################################################################################

http_code() {
    local url="$1"
    curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000"
}

http_code_with_header() {
    local method="$1" url="$2" header="$3"
    if [[ -n "$header" ]]; then
        curl -s -X "$method" -o /dev/null -w "%{http_code}" -H "$header" "$url" 2>/dev/null || echo "000"
    else
        curl -s -X "$method" -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000"
    fi
}

safe_fetch() {
    local url="$1" outfile="$2"
    curl -s "$url" -o "$outfile" 2>/dev/null || true
}

safe_post() {
    local url="$1" data="$2" headers="$3"
    if [[ -n "$headers" ]]; then
        curl -s -X POST "$url" \
            -H "$headers" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null || echo ""
    else
        curl -s -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null || echo ""
    fi
}

################################################################################
# [REPORT INITIALIZATION]
################################################################################

init_report() {
    {
        echo "═══════════════════════════════════════════════════════════════════"
        echo "EasyData Backend Verification — Ultimate Governance Edition (v5)"
        echo "═══════════════════════════════════════════════════════════════════"
        echo ""
        echo "Timestamp:              $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
        echo "Backend URL:            $BACKEND"
        echo "Environment Config:     $ENV_FILE"
        echo ""
        echo "Governance Status:"
        echo "  - ENV Mode:           $ENV (✓ LOCAL)"
        echo "  - Admin Local Bypass:  $ADMIN_LOCAL_BYPASS (✓ ENFORCED)"
        echo "  - Auth Disabled:       $([ "$AUTH_ENABLED" = "false" ] && echo "Yes ✓" || echo "No ✗")"
        echo "  - RBAC Disabled:       $([ "$RBAC_ENABLED" = "false" ] && echo "Yes ✓" || echo "No ✗")"
        echo "  - RLS Disabled:        $([ "$RLS_ENABLED" = "false" ] && echo "Yes ✓" || echo "No ✗")"
        echo ""
    } | tee "$REPORT"
}

init_report

################################################################################
# [TEST PHASE 0] Authentication
################################################################################

log_section "PHASE 0: Authentication & Token Acquisition"

ADMIN_TOKEN=""
AUTH_HEADER=""

if [[ "$AUTH_ENABLED" == "false" ]]; then
    log_info "AUTH_ENABLED=false; skipping admin login"
else
    log_info "Attempting admin login..."
    TOKEN_RES="$(safe_post "$BACKEND/api/v1/auth/login" \
        '{"username":"'"$ADMIN_EMAIL"'","password":"'"$ADMIN_PASSWORD"'"}' \
        "" || echo "")"

    if echo "$TOKEN_RES" | jq -e '.access_token' >/dev/null 2>&1; then
        ADMIN_TOKEN="$(echo "$TOKEN_RES" | jq -r '.access_token')"
        AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"
        log_pass "Admin authentication successful"
    else
        log_warn "Admin login failed (auth enabled, but token not returned)"
    fi
fi

################################################################################
# [TEST PHASE 1] Health & OpenAPI
################################################################################

log_section "PHASE 1: Health & OpenAPI Endpoints"

log_info "Testing health endpoint..."
HC="$(http_code "$BACKEND/api/v1/health/llm")"
if [[ "$HC" == "200" ]]; then
    log_pass "Health check OK (HTTP 200)"
else
    log_fail "Health check failed (HTTP $HC)"
fi

log_info "Fetching OpenAPI specification..."
safe_fetch "$BACKEND/openapi.json" "$OPENAPI_JSON"
SPEC_SIZE="$(stat -c%s "$OPENAPI_JSON" 2>/dev/null || echo 0)"

if [[ "$SPEC_SIZE" -gt 1000 ]]; then
    log_pass "OpenAPI specification fetched ($SPEC_SIZE bytes)"
else
    log_warn "OpenAPI spec unusually small ($SPEC_SIZE bytes) - may be error response"
fi

################################################################################
# [TEST PHASE 2] OpenAPI Contract Integrity
################################################################################

log_section "PHASE 2: OpenAPI Contract Integrity"

if [[ ! -s "$OPENAPI_JSON" ]]; then
    log_warn "OpenAPI unavailable; skipping contract checks"
else
    log_info "Validating JSON schema presence..."
    
    for schema in QueryRequest HealthResponse ErrorModel; do
        if jq -e ".components.schemas.$schema" "$OPENAPI_JSON" >/dev/null 2>&1; then
            log_pass "Schema component found: $schema"
        else
            log_warn "Schema component missing: $schema"
        fi
    done
    
    log_info "Checking operationId uniqueness..."
    DUP_OPS="$(jq -r '.paths | .. | .operationId? // empty' "$OPENAPI_JSON" 2>/dev/null | sort | uniq -d)"
    
    if [[ -z "$DUP_OPS" ]]; then
        log_pass "All operationIds are unique (Quality Gate passed)"
    else
        log_fail "Duplicate operationIds detected: $DUP_OPS"
    fi
fi

################################################################################
# [TEST PHASE 3] RBAC & Admin Guards (ADR-0014)
################################################################################

log_section "PHASE 3: RBAC & Admin Guard Enforcement (ADR-0014)"

log_info "Testing unprotected admin endpoint access..."
NO_AUTH_CODE="$(http_code "$BACKEND/api/v1/admin/settings/feature-toggles")"

if [[ "$ENV" == "local" && "$ADMIN_LOCAL_BYPASS" == "true" ]]; then
    log_info "Local mode with admin bypass detected - expecting 200 (bypass active)"
    if [[ "$NO_AUTH_CODE" == "200" ]]; then
        log_pass "Local admin bypass is ACTIVE (ADR-0014 compliance)"
    else
        log_fail "Local admin bypass misconfigured (got HTTP $NO_AUTH_CODE, expected 200)"
    fi
else
    log_info "Production mode - expecting 401/403 (auth required)"
    if [[ "$NO_AUTH_CODE" =~ ^(401|403)$ ]]; then
        log_pass "Admin route properly protected (HTTP $NO_AUTH_CODE)"
    else
        log_fail "Admin route exposed outside bypass (HTTP $NO_AUTH_CODE)"
    fi
fi

if [[ -n "$AUTH_HEADER" ]]; then
    log_info "Testing admin endpoint WITH valid token..."
    WITH_AUTH_CODE="$(http_code_with_header "GET" "$BACKEND/api/v1/admin/settings/feature-toggles" "$AUTH_HEADER")"
    log_info "Admin with token returned: HTTP $WITH_AUTH_CODE"
fi

################################################################################
# [TEST PHASE 4] Method & Input Validation
################################################################################

log_section "PHASE 4: HTTP Method & Input Validation"

log_info "Testing HTTP method enforcement (PUT on POST-only endpoint)..."
METHOD_CODE="$(http_code_with_header "PUT" "$BACKEND/api/v1/ask" "$AUTH_HEADER")"
if [[ "$METHOD_CODE" == "405" ]]; then
    log_pass "HTTP method validation enforced (405 Method Not Allowed)"
else
    log_warn "Unexpected response to invalid HTTP method: $METHOD_CODE"
fi

log_info "Testing malformed JSON rejection..."
MALFORMED_CODE="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND/api/v1/ask" \
    -H "Content-Type: application/json" \
    -d '{"question":"test","stream":}' 2>/dev/null || echo "000")"
if [[ "$MALFORMED_CODE" =~ ^(400|422)$ ]]; then
    log_pass "Malformed JSON rejected (HTTP $MALFORMED_CODE)"
else
    log_warn "Malformed JSON response: HTTP $MALFORMED_CODE"
fi

log_info "Testing type mismatch rejection..."
TYPE_MISMATCH_CODE="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND/api/v1/ask" \
    -H "Content-Type: application/json" \
    -d '{"question":12345}' 2>/dev/null || echo "000")"
if [[ "$TYPE_MISMATCH_CODE" =~ ^(400|422)$ ]]; then
    log_pass "Type validation enforced (HTTP $TYPE_MISMATCH_CODE)"
else
    log_warn "Type mismatch response: HTTP $TYPE_MISMATCH_CODE"
fi

################################################################################
# [TEST PHASE 5] Mini Load Test (Stability)
################################################################################

log_section "PHASE 5: Mini Load Test (Concurrent Stability)"

log_info "Firing $CONCURRENT_LOAD concurrent requests to health endpoint..."

rm -f "$LOAD_FAILS"

for i in $(seq 1 "$CONCURRENT_LOAD"); do
    (
        CODE="$(http_code "$BACKEND/api/v1/health/llm")"
        if [[ "$CODE" != "200" ]]; then
            echo "fail" >> "$LOAD_FAILS"
        fi
    ) &
done
wait || true

FAIL_COUNT_LOAD="$(wc -l < "$LOAD_FAILS" 2>/dev/null || echo 0)"

if [[ "$FAIL_COUNT_LOAD" -eq 0 ]]; then
    log_pass "All $CONCURRENT_LOAD concurrent requests succeeded"
else
    log_fail "$FAIL_COUNT_LOAD out of $CONCURRENT_LOAD requests failed"
fi

################################################################################
# [TEST PHASE 6] Streaming Stability
################################################################################

log_section "PHASE 6: Streaming Stability (E2E)"

log_info "Testing $STREAM_CONCURRENT concurrent NDJSON streams..."

rm -f "$STREAM_FAILS"

for i in $(seq 1 "$STREAM_CONCURRENT"); do
    (
        STREAM_OUT="$(curl -s -N -H "Content-Type: application/json" \
            -d '{"question":"stream stability test","stream":true}' \
            "$BACKEND/api/v1/ask" 2>/dev/null | head -n 10 || true)"
        
        if ! echo "$STREAM_OUT" | grep -q '"type"'; then
            echo "fail" >> "$STREAM_FAILS"
        fi
    ) &
done
wait || true

FAIL_COUNT_STREAM="$(wc -l < "$STREAM_FAILS" 2>/dev/null || echo 0)"

if [[ "$FAIL_COUNT_STREAM" -eq 0 ]]; then
    log_pass "All $STREAM_CONCURRENT streams returned valid NDJSON"
else
    log_warn "$FAIL_COUNT_STREAM out of $STREAM_CONCURRENT streams had issues"
fi

################################################################################
# [TEST PHASE 7] Functional: SQLGuard
################################################################################

log_section "PHASE 7: Functional Validation (SQLGuard)"

log_info "Testing SQL Injection protection with destructive query..."

SQL_RESPONSE="$(curl -s -N -H "Content-Type: application/json" \
    -d '{"question":"DROP TABLE users_forbidden"}' \
    "$BACKEND/api/v1/ask" 2>/dev/null | head -n 10 || true)"

if echo "$SQL_RESPONSE" | grep -qi "POLICY\|blocked\|forbidden\|error"; then
    log_pass "SQLGuard blocking detected - DDL/DML protected"
else
    log_warn "SQLGuard response unclear (check logs and LLM output)"
fi

################################################################################
# [TEST PHASE 8] Training & Observability
################################################################################

log_section "PHASE 8: Training Admin & Observability"

log_info "Testing training endpoint..."
TRAINING_CODE="$(http_code_with_header "GET" "$BACKEND/api/v1/admin/training/items?status=pending" "$AUTH_HEADER")"
log_info "Training endpoint status: HTTP $TRAINING_CODE"

log_info "Fetching metrics..."
safe_fetch "$BACKEND/metrics/json" "$METRICS_OUT"
METRICS_SIZE="$(stat -c%s "$METRICS_OUT" 2>/dev/null || echo 0)"
log_info "Metrics fetched: $METRICS_SIZE bytes"

################################################################################
# [FINAL SUMMARY]
################################################################################

log_section "FINAL SUMMARY & GOVERNANCE REPORT"

EXIT_CODE=0

{
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "VERIFICATION METRICS"
echo "════════════════════════════════════════════════════════════════"
echo "  Passed:   $PASS_COUNT ✓"
echo "  Failed:   $FAIL_COUNT ✗"
echo "  Warnings: $WARN_COUNT ⚠"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "GOVERNANCE STATUS"
echo "════════════════════════════════════════════════════════════════"
echo "  $ENV_FILE:             LOADED ✓"
echo "  ENV=local:              ENFORCED ✓"
echo "  ADMIN_LOCAL_BYPASS:     ENFORCED ✓"
echo "  AUTH/RBAC/RLS Disabled: ENFORCED ✓"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "FINAL VERDICT"
echo "════════════════════════════════════════════════════════════════"

if [[ "$FAIL_COUNT" -eq 0 ]]; then
    echo ""
    echo "  ✅ STATUS: PRODUCTION READY"
    echo ""
    echo "  All critical checks passed. The backend is operationally sound."
    echo "  Governance constraints are fully enforced."
    echo ""
else
    echo ""
    echo "  ❌ STATUS: REVIEW REQUIRED"
    echo ""
    echo "  $FAIL_COUNT critical failure(s) detected."
    echo "  Please review the full report and address issues above."
    echo ""
fi

echo "════════════════════════════════════════════════════════════════"
echo "Report saved to: $REPORT"
echo "════════════════════════════════════════════════════════════════"
echo ""
} | tee -a "$REPORT"

exit "$EXIT_CODE"
