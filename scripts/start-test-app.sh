#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
START_CMD="${START_CMD:-./start.sh}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-60}"
LOGFILE="./start-test-app.log"
PIDFILE="./start-test-app.pid"

# Helper: determine port from BASE_URL or START_PORT env override
get_port() {
  if [ -n "${START_PORT:-}" ]; then
    echo "$START_PORT"
    return
  fi
  # Strip scheme and path
  hostport=$(echo "$BASE_URL" | sed -E 's#https?://##; s#/.*$##')
  if echo "$hostport" | grep -q ':'; then
    echo "$hostport" | awk -F: '{print $2}'
  else
    # default to 3000 for test environments when not specified
    echo 3000
  fi
}

PORT=$(get_port)

echo "Starting test app with: $START_CMD (checking port $PORT)" | tee -a "$LOGFILE"

# If something is already listening on the port, kill it (user requested automatic stop)
find_and_kill_on_port() {
  local port=$1
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  else
    pids=$(ss -ltnp 2>/dev/null | grep -E ":${port}\b" | sed -n 's/.*pid=\([0-9]\+\),.*/\1/p' || true)
  fi

  if [ -n "$pids" ]; then
    echo "Port $port is in use by PIDs: $pids" | tee -a "$LOGFILE"
    for pid in $pids; do
      if [ "$pid" -ne $$ ]; then
        echo "Killing process $pid listening on port $port" | tee -a "$LOGFILE"
        kill "$pid" || kill -9 "$pid" || true
      fi
    done
    # Wait briefly for the port to be freed
    sleep 1
    # Confirm port is freed
    if command -v lsof >/dev/null 2>&1; then
      if lsof -t -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "Failed to free port $port after kill" | tee -a "$LOGFILE"
        return 1
      fi
    else
      if ss -ltnp 2>/dev/null | grep -q ":${port}\b"; then
        echo "Failed to free port $port after kill" | tee -a "$LOGFILE"
        return 1
      fi
    fi
  else
    echo "No process found listening on port $port" | tee -a "$LOGFILE"
  fi
  return 0
}

# Try to free port if needed
if ! find_and_kill_on_port "$PORT"; then
  echo "Unable to free the port $PORT; aborting start" | tee -a "$LOGFILE"
  exit 1
fi

# Start the app in background and capture PID so it persists after this script exits
nohup bash -lc "$START_CMD" >> "$LOGFILE" 2>&1 &
APP_PID=$!
echo "$APP_PID" > "$PIDFILE"
echo "Started app PID: $APP_PID (logs: $LOGFILE)"

# After starting, wait for any known candidate endpoints to become responsive
CANDIDATES=("${BASE_URL}" "http://localhost:8000" "http://localhost:3000" "http://localhost:5173")
SELECTED_BASEURL_FILE="./start-test-app.baseurl"

echo "Waiting for a responsive endpoint among candidates: ${CANDIDATES[*]} (timeout ${WAIT_TIMEOUT}s)" | tee -a "$LOGFILE"
end_time=$((SECONDS + WAIT_TIMEOUT))
while [ $SECONDS -lt $end_time ]; do
  for candidate in "${CANDIDATES[@]}"; do
    if curl -sSf "$candidate" > /dev/null 2>&1; then
      echo "Found responsive endpoint: $candidate" | tee -a "$LOGFILE"
      echo "$candidate" > "$SELECTED_BASEURL_FILE"
      # Export for subshells if needed (logging only)
      export BASE_URL="$candidate"
      echo "App responded successfully at $candidate" | tee -a "$LOGFILE"
      exit 0
    fi
  done

  # If the port becomes occupied by another process, attempt to free it and restart the app
  if ss -ltnp 2>/dev/null | grep -q ":${PORT}\b"; then
    echo "Detected port $PORT is occupied while waiting; attempting to free it" | tee -a "$LOGFILE"
    find_and_kill_on_port "$PORT" || true
  fi
  sleep 1
done

echo "Timeout waiting for any responsive endpoint among candidates" | tee -a "$LOGFILE"
# Dump last lines of logs to help debugging
tail -n 200 "$LOGFILE" || true
exit 1
