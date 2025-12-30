#!/usr/bin/env bash

################################################################################
# EasyData Pre-Flight Check — Governance Gate
#
# PURPOSE:
# Hard-stop execution if runtime or environment state is invalid.
# This script MUST run before any verification or test suite.
#
# DESIGN PRINCIPLES:
# - Fail-fast
# - No network spam
# - No false positives
# - Governance-first
#
# AUTHOR: EasyData Engineering
# VERSION: 1.0 (Binding)
################################################################################

set -euo pipefail

echo "═══════════════════════════════════════════════════════════════════"
echo "EasyData Pre-Flight Check — Governance Gate"
echo "═══════════════════════════════════════════════════════════════════"

###############################################################################
# 1) Load Environment
###############################################################################

ENV_FILE="${ENV_FILE:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ FATAL: ENV file not found: $ENV_FILE"
    exit 10
fi

# Load env safely
set -a
source "$ENV_FILE"
set +a

###############################################################################
# 2) Mandatory Identity Checks
###############################################################################

if [[ "${ENV:-}" != "local" ]]; then
    echo "❌ FATAL: ENV must be 'local' for local execution (found: ${ENV:-unset})"
    exit 11
fi

if [[ "${ADMIN_LOCAL_BYPASS:-false}" != "true" ]]; then
    echo "❌ FATAL: ADMIN_LOCAL_BYPASS must be true in local mode"
    exit 12
fi

###############################################################################
# 3) Training / Governance Consistency
###############################################################################

TRAINING_ENFORCED="${TRAINING_READINESS_ENFORCED:-true}"
TRAINING_PILOT="${ENABLE_TRAINING_PILOT:-false}"
AUDIT_ENABLED="${ENABLE_AUDIT_LOGGING:-false}"

if [[ "$TRAINING_PILOT" == "true" ]]; then
    if [[ "$AUDIT_ENABLED" != "true" ]]; then
        echo "❌ FATAL: ENABLE_TRAINING_PILOT=true requires ENABLE_AUDIT_LOGGING=true"
        exit 13
    fi

    if [[ "$TRAINING_ENFORCED" != "true" ]]; then
        echo "❌ FATAL: Training pilot enabled but TRAINING_READINESS_ENFORCED=false"
        exit 14
    fi
else
    # Non-training local dev
    if [[ "$TRAINING_ENFORCED" == "true" ]]; then
        echo "❌ FATAL: TRAINING_READINESS_ENFORCED=true while ENABLE_TRAINING_PILOT=false"
        echo "→ This will cause startup crash"
        exit 15
    fi
fi

###############################################################################
# 4) Backend Availability Check
###############################################################################

BACKEND_HOST="${BACKEND_HOST:-localhost}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
BACKEND_URL="http://${BACKEND_HOST}:${BACKEND_PORT}"

echo "ℹ Checking backend availability at $BACKEND_URL ..."

if ! curl -s --max-time 2 "$BACKEND_URL/api/v1/health/llm" >/dev/null; then
    echo "❌ FATAL: Backend is not reachable at $BACKEND_URL"
    echo "→ Start the backend before running verification"
    exit 16
fi

###############################################################################
# 5) Optional Telemetry Sanity (Noise Prevention)
###############################################################################

if [[ "${ENABLE_TELEMETRY:-false}" == "true" ]]; then
    echo "⚠ WARN: ENABLE_TELEMETRY=true in local mode"
    echo "→ This may cause noisy logs (recommended: false for local)"
fi

###############################################################################
# 6) Final Verdict
###############################################################################

echo "═══════════════════════════════════════════════════════════════════"
echo "✅ PRE-FLIGHT PASSED"
echo "Environment is consistent."
echo "Backend is reachable."
echo "Governance constraints satisfied."
echo "You may proceed to verification."
echo "═══════════════════════════════════════════════════════════════════"

exit 0

#to run
# ./scripts/preflight_check.sh && ./scripts/verify_backend.sh
