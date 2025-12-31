import json
import pathlib
import pytest
# StreamValidator enforces streaming.md as the single source of truth.
# Any violation must raise an exception.

# Ensure this import works based on the previous step. 
# If tests/utils/stream_validator.py doesn't exist yet, create it first.
from streaming.stream_validator import StreamValidator

ROOT = pathlib.Path(__file__).resolve().parent.parent

# ============================================================================
# Governance & Contract Fixtures
# ============================================================================

@pytest.fixture
def validate_stream():
    """
    Governance Fixture:
    Validates any NDJSON response against the binding contract (streaming.md).
    Usage: validator = validate_stream(response.text)
    """
    def _validate(response_text: str):
        validator = StreamValidator.from_response(response_text)
        validator.validate_all()
        return validator
    return _validate


# ============================================================================
# Protocol-Compliant Data Fixtures
# ============================================================================

@pytest.fixture(scope="session")
def ndjson_sample_ok():
    """
    Canonical SUCCESS flow.
    Compliant with Phase 4 Contract: Includes 'payload' wrapper and strict END schema.
    """
    """
Canonical SUCCESS flow.
Minimal valid stream: thinking → end (no technical/data/business chunks).
"""

    return [
        json.dumps({
            "type": "thinking", 
            "trace_id": "t1", 
            "timestamp": "2025-01-01T00:00:00Z",
            "payload": {
                "content": "ok",
                "step": "init"
            }
        }),
        json.dumps({
            "type": "end", 
            "trace_id": "t1", 
            "timestamp": "2025-01-01T00:00:01Z",
            "payload": {
                "status": "success",
                "total_chunks": 2,
                "message": "completed"
            }
        }),
    ]

@pytest.fixture(scope="session")
def ndjson_sample_error():
    """
    Canonical ERROR flow.
    Compliant with Phase 4 Contract: Flat error payload, Fail-Closed status.
    """
    return [
        json.dumps({
            "type": "thinking", 
            "trace_id": "t2", 
            "timestamp": "2025-01-01T00:00:00Z",
            "payload": {
                "content": "starting analysis"
            }
        }),
        json.dumps({
            "type": "error",
            "trace_id": "t2",
            "timestamp": "2025-01-01T00:00:00Z",
            "error_code": "POLICY_VIOLATION",
            "message": "forbidden",
            "lang": "en"
        }),
        json.dumps({
            "type": "end", 
            "trace_id": "t2", 
            "timestamp": "2025-01-01T00:00:01Z",
            "payload": {
                "status": "failed",
                "total_chunks": 3
            }
        }),
    ]

# ============================================================================
# Application Context Fixtures (Unchanged)
# ============================================================================

@pytest.fixture(scope="session")
def sample_policy_violation():
    return {
        "error_code": "POLICY_VIOLATION",
        "message": "forbidden table",
        "lang": "en",
    }

@pytest.fixture(scope="session")
def spec_paths():
    paths_file = ROOT / "openapi" / "paths.yaml"
    if paths_file.exists():
        content = paths_file.read_text(encoding="utf-8")
        return [line.strip().split(":")[0] for line in content.splitlines() if line.strip().startswith("/")]
    return []

@pytest.fixture(scope="session")
def fake_admin_context():
    return {"role": "admin", "user_id": "admin"}

@pytest.fixture(scope="session")
def fake_guest_context():
    return {"role": "guest", "user_id": "anonymous"}

@pytest.fixture(scope="session")
def local_bypass_settings():
    return {"ENV": "local", "ADMIN_LOCAL_BYPASS": "true"}
