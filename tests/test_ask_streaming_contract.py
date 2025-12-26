import json
import pytest
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


def parse_ndjson(response_text: str):
    """
    Parse NDJSON response into a list of JSON objects.
    """
    lines = [line for line in response_text.splitlines() if line.strip()]
    return [json.loads(line) for line in lines]


@pytest.mark.integration
def test_ask_endpoint_streaming_contract_no_auth():
    """
    Contract test for /api/v1/ask endpoint.

    Validates:
    - NDJSON streaming
    - Strict chunk order: data -> chart -> summary
    - Minimal schema correctness
    """

    payload = {
        "question": "How many users are there?",
        "top_k": 5
    }

    response = client.post(
        "/api/v1/ask",
        json=payload,
        headers={
            "Content-Type": "application/json"
        }
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")

    chunks = parse_ndjson(response.text)

    # ---- Contract: exact order ----
    assert len(chunks) >= 3, "Expected at least 3 NDJSON chunks"

    assert chunks[0]["type"] == "data"
    assert chunks[1]["type"] == "chart"
    assert chunks[2]["type"] == "summary"

    # ---- Contract: schema ----
    for chunk in chunks[:3]:
        assert "type" in chunk
        assert "payload" in chunk

    # ---- Contract: payload sanity ----
    assert isinstance(chunks[0]["payload"], list)      # data
    assert isinstance(chunks[1]["payload"], dict)      # chart config
    assert isinstance(chunks[2]["payload"], str)       # summary text
