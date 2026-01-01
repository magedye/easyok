#!/usr/bin/env bash
set -eu
set -o pipefail

echo "===[ Governance Static Checks ]==="
rg -n "SQLGuard|generate_sql" app/api || true

echo "===[ Tier Router Contract Test Suite ]==="
OPERATION_TIER="${OPERATION_TIER:-tier2_vanna}"
python3 -m pytest tests/test_tier2_e2e.py::test_tier2_agent_loop

echo "===[ Governance Check Completed ]==="
