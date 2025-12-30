import json
import os
import subprocess
import pytest

BACKEND = os.environ.get("BACKEND", "http://localhost:8000")


def backend_reachable() -> bool:
    try:
        r = subprocess.run(
            ["curl", "-s", "-f", f"{BACKEND}/openapi.json"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        return r.returncode == 0 and bool(r.stdout)
    except Exception:
        return False


def test_openapi_runtime_has_ask_path():
    """
    Contract test (context-aware):

    - If backend is NOT running:
        -> SKIP (this is NOT a failure)
    - If backend IS running:
        -> /openapi.json MUST expose /api/v1/ask

    This preserves:
    - Governance-only pytest (offline-safe)
    - Runtime contract verification when available
    """

    if not backend_reachable():
        pytest.skip("Backend not running; runtime OpenAPI check skipped")

    result = subprocess.run(
        ["curl", "-s", f"{BACKEND}/openapi.json"],
        capture_output=True,
        text=True,
        check=True,
    )

    spec = json.loads(result.stdout)
    paths = spec.get("paths", {})

    assert "/api/v1/ask" in paths, "Expected /api/v1/ask in OpenAPI runtime spec"
