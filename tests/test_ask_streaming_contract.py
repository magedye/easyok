import json
import os
import pytest

# Integration-only: requires live FastAPI app/runtime
if not os.environ.get("RUN_INTEGRATION_TESTS"):
    pytest.skip("Integration test requires RUN_INTEGRATION_TESTS=1", allow_module_level=True)

fastapi = pytest.importorskip("fastapi")
TestClient = fastapi.testclient.TestClient
main = pytest.importorskip("main")
client = TestClient(main.app)


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
    - Strict chunk order: technical_view -> data -> chart -> summary
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
    assert len(chunks) >= 4, "Expected at least 4 NDJSON chunks"

    assert chunks[0]["type"] == "technical_view"
    assert chunks[1]["type"] == "data"
    assert chunks[2]["type"] == "chart"
    assert chunks[3]["type"] == "summary"

    # ---- Contract: schema ----
    for chunk in chunks[:4]:
        assert "type" in chunk
        assert "payload" in chunk

    # ---- Contract: payload sanity ----
    assert isinstance(chunks[0]["payload"], dict)      # technical_view
    assert isinstance(chunks[0]["payload"].get("sql"), str)
    assert isinstance(chunks[0]["payload"].get("assumptions"), list)
    assert isinstance(chunks[0]["payload"].get("is_safe"), bool)

    assert isinstance(chunks[1]["payload"], list)      # data

    assert isinstance(chunks[2]["payload"], dict)      # chart
    assert chunks[2]["payload"].get("chart_type") in {"bar", "line", "pie"}
    assert isinstance(chunks[2]["payload"].get("x"), str)
    assert isinstance(chunks[2]["payload"].get("y"), str)

    assert isinstance(chunks[3]["payload"], str)       # summary text
