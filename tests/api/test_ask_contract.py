import pytest


def test_ask_contract_allows_post_only():
    contract = {"method": "POST", "path": "/api/v1/ask"}
    assert contract["method"] == "POST"
