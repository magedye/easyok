#!/usr/bin/env bash
set -euo pipefail
PIDFILE="./start-test-app.pid"
LOGFILE="./start-test-app.log"

if [ -f "$PIDFILE" ]; then
  PID=$(cat "$PIDFILE")
  echo "Stopping app PID: $PID"
  kill "$PID" || true
  rm -f "$PIDFILE"
else
  echo "No PID file found ($PIDFILE)"
fi

if [ -f "$LOGFILE" ]; then
  echo "Saved logs at $LOGFILE"
fi
