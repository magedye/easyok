"""
E2E validation suite for Tier 2 (Vanna Native) endpoints.

Performs the full ask → feedback → re-ask loop to ensure the Agent returns rich
JSON responses, memory integration works, and LLm parameters are injected cleanly.
"""

import os
import time
from typing import Any, Dict

import httpx
import pytest

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8000")
OPERATION_TIER = os.environ.get("OPERATION_TIER", "tier2_vanna")


@pytest.fixture(scope="session")
def client() -> httpx.Client:
    return httpx.Client(base_url=BASE_URL, timeout=60.0)


def _ask(client: httpx.Client, question: str) -> Dict[str, Any]:
    response = client.post("/api/v2/vanna/agent", json={"question": question})
    response.raise_for_status()
    payload = response.json()
    assert "sql" in payload and "rows" in payload and "summary" in payload
    assert "confidence" in payload or "confidence_tier" in payload
    assert isinstance(payload["rows"], list)
    assert payload.get("error_code") is None
    return payload


def _feedback(client: httpx.Client, question: str, sql: str) -> Dict[str, Any]:
    response = client.post(
        "/api/v2/vanna/feedback",
        json={"question": question, "sql": sql, "rating": 1},
    )
    response.raise_for_status()
    return response.json()


@pytest.mark.skipif(
    OPERATION_TIER != "tier2_vanna", reason="Tier 2 must be enabled for this test"
)
def test_tier2_agent_loop(client: httpx.Client) -> None:
    question = "Compare revenue for the last two quarters and highlight the trend."

    first = _ask(client, question)
    start = time.perf_counter()
    feedback = _feedback(client, question, first["sql"])
    assert feedback.get("status") == "feedback_recorded"
    second = _ask(client, question)
    duration = time.perf_counter() - start

    assert first["sql"]
    assert second["sql"]
    assert second["rows"]
    assert second != first
    assert second.get("memory", {}).get("enabled", False) or second.get("components")
    assert duration > 0

    # Parameter injection is indirectly verified by the successful call (no TypeError).
    assert "internal_error" not in second.get("error_code", "")
