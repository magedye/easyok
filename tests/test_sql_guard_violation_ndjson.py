import json
import pytest
from fastapi.testclient import TestClient

from main import app
from app.utils.sql_guard import SQLGuardViolation


@pytest.fixture(scope="module")
def client():
    """
    FastAPI TestClient fixture.
    Uses context manager to ensure clean startup/shutdown.
    """
    with TestClient(app) as c:
        yield c


def iter_ndjson(response):
    """
    Iterate over NDJSON response lines and yield parsed JSON objects.
    """
    for line in response.iter_lines():
        if not line:
            continue
        yield json.loads(line)


def test_sql_guard_violation_emits_error_and_terminates_stream(client, monkeypatch):
    """
    Governance test (FINAL):

    When a SQLGuardViolation occurs, the backend MUST:

    1. Emit exactly one NDJSON chunk with type == "error".
    2. Never emit sensitive data chunks:
       - data
       - technical_view
       - business_view
    3. After the error chunk, emit ONLY terminal chunks:
       - end
       - or status (if used separately)
    4. Never resume normal streaming after the error.
    """

    # Force SQLGuard to raise a governance violation
    def raise_violation(self, sql, policy=None):
        raise SQLGuardViolation(
            "SECURITY_VIOLATION: DDL/DML is not allowed"
        )

    monkeypatch.setattr(
        "app.utils.sql_guard.SQLGuard.validate_and_normalise",
        raise_violation,
    )

    response = client.post(
        "/api/v1/ask",
        json={"question": "drop table users"},
    )

    chunks = list(iter_ndjson(response))

    # Stream must emit something
    assert chunks, "NDJSON stream emitted no chunks"

    # Exactly one error chunk
    error_chunks = [c for c in chunks if c.get("type") == "error"]
    assert len(error_chunks) == 1, (
        "Exactly one error chunk must be emitted"
    )

    error_index = next(
        i for i, c in enumerate(chunks) if c.get("type") == "error"
    )

    # Forbidden chunks BEFORE error
    forbidden_before_error = {
        "data",
        "technical_view",
        "business_view",
    }

    for c in chunks[:error_index]:
        if c.get("type") in forbidden_before_error:
            pytest.fail(
                f"Governance violation: emitted '{c['type']}' "
                f"before SQLGuard error"
            )

    # After error, ONLY terminal chunks are allowed
    allowed_after_error = {
        "end",
        "status",
    }

    for c in chunks[error_index + 1:]:
        assert c.get("type") in allowed_after_error, (
            f"Governance violation: unexpected chunk after error: {c}"
        )
