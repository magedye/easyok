import os
import pytest

if not os.environ.get("RUN_INTEGRATION_TESTS"):
    pytest.skip("Integration test requires RUN_INTEGRATION_TESTS=1", allow_module_level=True)

fastapi = pytest.importorskip("fastapi")
TestClient = fastapi.testclient.TestClient
main = pytest.importorskip("main")


def test_health_tag_unique_in_openapi():
    client = TestClient(main.app)
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
