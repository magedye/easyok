#!/usr/bin/env bash
set -euo pipefail

# Verification v3 — Operational Reality (real DB/LLM). Not for CI.
BACKEND="${BACKEND:-http://localhost:8000}"
REPORT="verification_v3_$(date +%Y%m%d%H%M%S).txt"

echo "=== Verification v3 (Operational Reality) ===" > "$REPORT"
echo "Backend: $BACKEND" >> "$REPORT"
echo "Date: $(date -u)" >> "$REPORT"

echo "- Checking DB connectivity (reachability only)..." >> "$REPORT"
if nc -z "${DB_HOST:-localhost}" "${DB_PORT:-1521}" 2>/dev/null; then
  echo "PASS: DB reachable (${DB_HOST:-localhost}:${DB_PORT:-1521})" >> "$REPORT"
else
  echo "FAIL: DB unreachable" >> "$REPORT"
fi

echo "- Checking LLM connectivity..." >> "$REPORT"
if [ -n "${LLM_ENDPOINT:-}" ] && curl -s -o /dev/null -w "%{http_code}" "${LLM_ENDPOINT}" | grep -q "200"; then
  echo "PASS: LLM endpoint reachable" >> "$REPORT"
else
  echo "WARN: LLM endpoint not reachable or not set" >> "$REPORT"
fi

echo "- E2E conversation (/ask NDJSON presence)..." >> "$REPORT"
STREAM=$(curl -s -N -H "Content-Type: application/json" -d '{"question":"operational check"}' "$BACKEND/api/v1/ask" | head -n 3)
if echo "$STREAM" | grep -q '"type"'; then
  echo "PASS: NDJSON stream detected" >> "$REPORT"
else
  echo "FAIL: NDJSON stream missing" >> "$REPORT"
fi

echo "=== Verification v3 complete ===" >> "$REPORT"
echo "Report: $REPORT"
