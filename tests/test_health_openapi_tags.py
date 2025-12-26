from fastapi.testclient import TestClient
from main import app


def test_health_tag_unique_in_openapi():
    client = TestClient(app)
    openapi = client.get("/openapi.json").json()

    # Ensure we have a single 'health' tag and no 'Health' duplicate
    tags = [t["name"] for t in openapi.get("tags", [])]
    assert tags.count("health") == 1
    assert "Health" not in tags

    # Ensure the path is present and tagged correctly
    paths = openapi.get("paths", {})
    assert "/api/v1/health/llm" in paths
    op_tags = paths["/api/v1/health/llm"]["get"].get("tags", [])
    assert op_tags == ["health"]
