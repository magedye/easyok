"""
Contract test for the Tier 0 NDJSON streaming endpoint.

Validates the strict chunk order: thinking → technical_view → data → business_view → end.
"""

import os

import httpx
import pytest
import json

BASE_URL = os.environ.get("E2E_BASE_URL", "http://localhost:8000")
OPERATION_TIER = os.environ.get("OPERATION_TIER", "tier2_vanna")


@pytest.mark.skipif(
    OPERATION_TIER != "tier0_fortress",
    reason="NDJSON contract is enforced only when tier0_fortress is active.",
)
def test_ndjson_sequence() -> None:
    with httpx.Client(base_url=BASE_URL, timeout=60.0) as client:
        response = client.stream(
            "POST",
            "/api/v1/ask",
            json={"question": "List total orders yesterday", "top_k": 5},
        )
        sequence = []
        for chunk in response.iter_lines():
            if not chunk:
                continue
            decoded = chunk.decode("utf-8")
            data = json.loads(decoded)
            sequence.append(data.get("type"))
            if data.get("type") == "end":
                break
        assert sequence[:5] == [
            "thinking",
            "technical_view",
            "data_chunk",
            "business_view",
            "end",
        ]
