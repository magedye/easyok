#!/usr/bin/env bash

# EasyData Tier 2 (Vanna) Live Startup (Backend + Frontend)
# - Backend: uvicorn main:app --reload on 0.0.0.0:8000 with OPERATION_TIER=tier2_vanna
# - Frontend: Vite dev server (frontend/) on 0.0.0.0:5175 with VITE_API_BASE_URL=http://<LAN_HOST>:8000
# - Frees ports 8000 and 5175 before starting
# - CTRL+C stops both processes cleanly

set -euo pipefail

VENV_DIR=".venv"
VENV_PY="${VENV_DIR}/bin/python"

if [[ ! -x "${VENV_PY}" ]]; then
  echo "[error] Missing Python virtual environment at ./${VENV_DIR}" >&2
  echo "Create it and install dependencies:" >&2
  echo "  python3 -m venv .venv" >&2
  echo "  source .venv/bin/activate" >&2
  echo "  pip install --upgrade pip" >&2
  echo "  pip install -r requirements.txt" >&2
  exit 1
fi

LAN_HOST="10.10.10.10"
BACKEND_HOST="0.0.0.0"
BACKEND_PORT="8000"
FRONTEND_HOST="0.0.0.0"
FRONTEND_PORT="5175"

export OPERATION_TIER="tier2_vanna"
export VITE_API_BASE_URL="http://${LAN_HOST}:${BACKEND_PORT}"

backend_pid=""
frontend_pid=""

free_port() {
  local port="$1"
  if pids=$(lsof -t -i :"${port}" 2>/dev/null); then
    echo "[prep] Freeing port ${port}"
    kill -9 ${pids} 2>/dev/null || true
  fi
}

cleanup() {
  if [[ -n "${backend_pid}" ]]; then
    kill -- -"${backend_pid}" 2>/dev/null || true
  fi
  if [[ -n "${frontend_pid}" ]]; then
    kill -- -"${frontend_pid}" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo "EasyData Tier2 Frontend: http://${LAN_HOST}:${FRONTEND_PORT}/tier2-assistant"
echo "EasyData Backend:       http://${LAN_HOST}:${BACKEND_PORT}"
echo

free_port "${BACKEND_PORT}"
free_port "${FRONTEND_PORT}"

if [[ ! -x "frontend/node_modules/.bin/vite" ]]; then
  echo "[prep] Installing frontend dependencies (npm install)"
  npm --prefix frontend install
  echo
fi

echo "[1/2] Starting Backend (Uvicorn --reload) on ${BACKEND_HOST}:${BACKEND_PORT} with OPERATION_TIER=${OPERATION_TIER}"
setsid "${VENV_PY}" -m uvicorn main:app --reload --host "${BACKEND_HOST}" --port "${BACKEND_PORT}" &
backend_pid="$!"

echo "[2/2] Starting Frontend (Vite HMR) on ${FRONTEND_HOST}:${FRONTEND_PORT}"
setsid bash -lc "VITE_API_BASE_URL='${VITE_API_BASE_URL}' npm --prefix frontend run dev -- --host '${FRONTEND_HOST}' --port '${FRONTEND_PORT}'" &
frontend_pid="$!"

wait
