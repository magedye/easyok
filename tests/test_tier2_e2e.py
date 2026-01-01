"""
E2E smoke tests for Tier 2 (Vanna Native) endpoints.

These tests expect the backend to be running (default http://localhost:8000)
and OPERATION_TIER set to tier2_vanna. They exercise the ask-feedback-reask loop
and ensure the response shape follows the Tier 2 contract.
"""

import os
from typing import Any, Dict

import httpx
import pytest


BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8000")
TIER = os.environ.get("OPERATION_TIER", "tier2_vanna")


@pytest.fixture(scope="session")
def client() -> httpx.Client:
    return httpx.Client(base_url=BASE_URL, timeout=30)


def _ask_question(client: httpx.Client, question: str) -> Dict[str, Any]:
    response = client.post("/api/v2/vanna/agent", json={"question": question})
    response.raise_for_status()
    return response.json()


def _submit_feedback(client: httpx.Client, question: str, sql: str) -> Dict[str, Any]:
    payload = {"question": question, "sql": sql, "rating": 1}
    response = client.post("/api/v2/vanna/feedback", json=payload)
    response.raise_for_status()
    return response.json()


@pytest.mark.skipif(TIER != "tier2_vanna", reason="Tier 2 must be enabled for this test")
def test_tier2_agent_loop(client: httpx.Client) -> None:
    question = "List the top 3 customers by revenue in the past month."

    first = _ask_question(client, question)
    assert isinstance(first, dict)
    assert "sql" in first and "rows" in first and "summary" in first
    assert "confidence" in first or "confidence_tier" in first
    assert isinstance(first["rows"], list)

    feedback = _submit_feedback(client, question, first["sql"])
    assert feedback.get("status") == "feedback_recorded"

    second = _ask_question(client, question)
    assert "sql" in second and isinstance(second["rows"], list)
    # The second response should still be rich JSON and optionally include memory indicators
    assert second != first
