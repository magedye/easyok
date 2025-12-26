#!/usr/bin/env bash

# EasyData MVP - Live Development Startup Script (Linux/macOS)
#
# Requirements implemented:
# - Backend: FastAPI via Uvicorn with --reload, bind 0.0.0.0:8000
# - Frontend: Vite dev server with HMR, bind 0.0.0.0:5173
# - Frontend env is set by this script (no manual .env edits):
#     VITE_API_BASE_URL=http://10.10.10.10:8000
# - Runs backend + frontend concurrently
# - CTRL+C stops both processes cleanly

set -euo pipefail

LAN_HOST="10.10.10.10"
BACKEND_HOST="0.0.0.0"
BACKEND_PORT="8000"
FRONTEND_HOST="0.0.0.0"
FRONTEND_PORT="5173"

export VITE_API_BASE_URL="http://${LAN_HOST}:${BACKEND_PORT}"

backend_pid=""
frontend_pid=""

cleanup() {
  # Stop both processes (best-effort) on EXIT/INT/TERM.
  if [[ -n "${backend_pid}" ]]; then
    kill -- -"${backend_pid}" 2>/dev/null || true
  fi
  if [[ -n "${frontend_pid}" ]]; then
    kill -- -"${frontend_pid}" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo "EasyData Frontend (Live): http://${LAN_HOST}:${FRONTEND_PORT}"
echo "EasyData Backend  (Live): http://${LAN_HOST}:${BACKEND_PORT}"
echo

# Ensure Vite is available (local devDependency). If not, install frontend deps.
if [[ ! -x "frontend/node_modules/.bin/vite" ]]; then
  echo "[prep] Installing frontend dependencies (npm install)"
  npm --prefix frontend install
  echo
fi

echo "[1/2] Starting Backend (Uvicorn --reload) on ${BACKEND_HOST}:${BACKEND_PORT}"
# Use `setsid` so we can stop the whole process group cleanly on CTRL+C.
setsid uvicorn app.main:app --reload --host "${BACKEND_HOST}" --port "${BACKEND_PORT}" &
backend_pid="$!"

echo "[2/2] Starting Frontend (Vite HMR) on ${FRONTEND_HOST}:${FRONTEND_PORT}"
# Export env var for Vite build-time injection (no static .env dependency).
setsid bash -lc "VITE_API_BASE_URL='${VITE_API_BASE_URL}' npm --prefix frontend run dev -- --host '${FRONTEND_HOST}' --port '${FRONTEND_PORT}'" &
frontend_pid="$!"

# Keep the script running; both processes will hot-reload on file changes.
wait
