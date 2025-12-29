#!/usr/bin/env bash

# EasyData v16.7.x - Authoritative Startup Script
# Implements Self-Enforcing Architecture (Track A, B, C, D)

set -euo pipefail

# --- Configurations ---
VENV_DIR=".venv"
VENV_PY="${VENV_DIR}/bin/python"

LAN_HOST="${LAN_HOST:-10.10.10.10}"
BACKEND_PORT="8000"
FRONTEND_PORT="5173"

# --- Governance Environment Variables ---
export EASYDATA_GOVERNANCE_MODE="${EASYDATA_GOVERNANCE_MODE:-STRICT}"
export VITE_API_BASE_URL="http://${LAN_HOST}:${BACKEND_PORT}"

# Enable OTEL only if SigNoz collector is reachable
if nc -z localhost 4317 2>/dev/null; then
  export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
fi

# --- Cleanup Logic ---
backend_pid=""
frontend_pid=""

cleanup() {
  echo -e "\n[stop] Shutting down EasyData Governed Monolith..."
  [[ "${backend_pid}" =~ ^[0-9]+$ ]] && kill -- -"${backend_pid}" 2>/dev/null || true
  [[ "${frontend_pid}" =~ ^[0-9]+$ ]] && kill -- -"${frontend_pid}" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# --- Phase 1: Environment & Virtual Environment Check ---
if [[ ! -x "${VENV_PY}" ]]; then
  echo "[error] Missing Virtual Environment at ./${VENV_DIR}" >&2
  exit 1
fi

# --- Phase 2: Track A - Static Architectural Enforcement ---
echo "[track-a] Running Architectural Linting (flake8-easydata-arch)..."
if ! "${VENV_PY}" -m flake8 app/ --select=EDA9; then
  echo "❌ ARCHITECTURE BREACH: Core/API isolation violated. Startup aborted." >&2
  exit 1
fi
echo "✅ Architecture Verified."

# --- Phase 3: Frontend Dependency Check ---
if [[ ! -x "frontend/node_modules/.bin/vite" ]]; then
  echo "[prep] Installing frontend dependencies..."
  npm --prefix frontend install
fi

echo -e "\nEasyData v16.7 Governed Status:"
echo "-----------------------------------"
echo "Frontend: http://${LAN_HOST}:${FRONTEND_PORT}"
echo "Backend:  ${VITE_API_BASE_URL}"
echo "Governance: ENABLED (Track A,B,C,D Active)"
echo "-----------------------------------\n"

# --- Phase 4: Concurrent Execution (Track B & C) ---

echo "[1/2] Starting Backend (Uvicorn - Tier 0 Fortress Mode)..."
setsid "${VENV_PY}" -m uvicorn app.main:app \
  --reload \
  --host 0.0.0.0 \
  --port "${BACKEND_PORT}" \
  --log-level info &
backend_pid="$!"

echo "[2/2] Starting Frontend (Vite - Causal Cockpit Mode)..."
setsid bash -lc "VITE_API_BASE_URL='${VITE_API_BASE_URL}' npm --prefix frontend run dev -- --host 0.0.0.0 --port '${FRONTEND_PORT}'" &
frontend_pid="$!"

wait
