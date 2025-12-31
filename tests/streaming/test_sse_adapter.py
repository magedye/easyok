import os
import json
import pytest

# Integration tests require RUN_INTEGRATION_TESTS
if not os.environ.get("RUN_INTEGRATION_TESTS"):
    pytest.skip("Integration test requires RUN_INTEGRATION_TESTS=1", allow_module_level=True)

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient

main = pytest.importorskip("main")

try:
    client = TestClient(main.app)
except TypeError:
    pytest.skip("TestClient incompatible with installed httpx/starlette", allow_module_level=True)


def parse_sse_events(text: str):
    """Return list of (event, data) tuples from SSE text."""
    events = []
    for block in text.split("\n\n"):
        if not block.strip():
            continue
        lines = block.splitlines()
        event = None
        data_lines = []
        for line in lines:
            if line.startswith("event:"):
                event = line.split("event:", 1)[1].strip()
            elif line.startswith("data:"):
                data_lines.append(line.split("data:", 1)[1].strip())
        data = "\n".join(data_lines)
        events.append((event, data))
    return events


@pytest.mark.integration
def test_chat_stream_success_flow():
    response = client.get("/chat/stream?question=How+many+users")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = parse_sse_events(response.text)
    # Expect at least auth, thinking, technical_view, data (optional), summary, done
    event_names = [e for e, _ in events]
    assert event_names[0] == "auth"
    assert "thinking" in event_names
    assert "technical_view" in event_names
    assert "done" in event_names


@pytest.mark.integration
def test_chat_stream_blocked_flow(monkeypatch):
    # Monkeypatch orchestrator to return a blocked response
    import app.api.v1.chat as chat_mod

    class FakeOrch:
        async def prepare(self, *, question, user_context, top_k=5):
            return {"is_safe": False, "error": "blocked", "confidence_tier": "TIER_0_FORTRESS"}

    monkeypatch.setattr(chat_mod, "orchestrator", FakeOrch())

    response = client.get("/chat/stream?question=DROP+TABLE+users")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = parse_sse_events(response.text)
    # Should emit an error then a done (fail-closed)
    names = [e for e, _ in events]
    assert "error" in names
    # done must be present and follow error
    assert names[-1] == "done"
    # Ensure error payload contains governance code
    error_payload = json.loads([d for e, d in events if e == "error"][0])
    assert error_payload.get("code") == "GOVERNANCE_BLOCKED"
