import json
import os
import pytest

# Integration-only: requires live FastAPI app/runtime
if not os.environ.get("RUN_INTEGRATION_TESTS"):
    pytest.skip(
        "Integration test requires RUN_INTEGRATION_TESTS=1",
        allow_module_level=True,
    )

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

main = pytest.importorskip("main")

try:
    client = TestClient(main.app)
except TypeError:
    pytest.skip(
        "TestClient incompatible with installed httpx/starlette",
        allow_module_level=True,
    )


def parse_ndjson(response_text: str):
    """Parse NDJSON response into a list of JSON objects."""
    lines = [line for line in response_text.splitlines() if line.strip()]
    return [json.loads(line) for line in lines]


@pytest.mark.integration
def test_ask_endpoint_streaming_contract_no_auth():
    """
    NDJSON Streaming Contract Test (Canonical)

    Validates:
    - NDJSON streaming format
    - Canonical chunk order per streaming.md
    - Mandatory thinking (first) and end (last)
    - Trace ID consistency
    - Payload presence
    """

    payload = {
        "question": "How many users are there?",
        "top_k": 5,
    }

    response = client.post(
        "/api/v1/ask",
        json=payload,
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")

    chunks = parse_ndjson(response.text)

    # ---- Contract: stream must emit data ----
    assert chunks, "NDJSON stream emitted no chunks"

    # ---- Contract: first and last chunks ----
    assert chunks[0]["type"] == "thinking", (
        "First chunk must be 'thinking'"
    )
    assert chunks[-1]["type"] == "end", (
        "Last chunk must be 'end'"
    )

    # ---- Contract: base schema ----
    for chunk in chunks:
        assert "type" in chunk
        assert "trace_id" in chunk
        assert "timestamp" in chunk
        assert "payload" in chunk

    # ---- Contract: trace_id consistency ----
    trace_ids = {chunk["trace_id"] for chunk in chunks}
    assert len(trace_ids) == 1, "All chunks must share the same trace_id"

    # ---- Contract: valid transitions ----
    valid_types = {
        "thinking",
        "technical_view",
        "data",
        "business_view",
        "error",
        "end",
    }

    for chunk in chunks:
        assert chunk["type"] in valid_types, (
            f"Invalid chunk type: {chunk['type']}"
        )

    # ---- Contract: no chunks after end ----
    end_index = next(
        i for i, c in enumerate(chunks) if c["type"] == "end"
    )
    assert end_index == len(chunks) - 1, (
        "No chunks are allowed after 'end'"
    )

    # ---- Contract: error handling (if present) ----
    error_chunks = [c for c in chunks if c["type"] == "error"]
    if error_chunks:
        assert len(error_chunks) == 1, (
            "At most one error chunk is allowed"
        )
        error_index = chunks.index(error_chunks[0])
        assert chunks[error_index + 1]["type"] == "end", (
            "Error must be followed immediately by end"
        )
        assert chunks[-1]["payload"].get("status") == "failed", (
            "End status must be 'failed' after error"
        )
