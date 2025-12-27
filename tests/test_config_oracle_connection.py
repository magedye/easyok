import os
import pytest

from app.core.config import Settings


def test_oracle_connection_string_sanitized(monkeypatch):
    monkeypatch.setenv("DB_PROVIDER", "oracle")
    monkeypatch.setenv(
        "ORACLE_CONNECTION_STRING",
        "oracle+oracledb://MAJED:StrongPass123@10.10.10.10:1521/XEPDB1  >>> CHANGE ME <<<",
    )

    s = Settings()
    assert s.ORACLE_CONNECTION_STRING.endswith("XEPDB1")
    assert ">>>" not in s.ORACLE_CONNECTION_STRING


def test_oracle_connection_string_quotes(monkeypatch):
    monkeypatch.setenv("DB_PROVIDER", "oracle")
    monkeypatch.setenv(
        "ORACLE_CONNECTION_STRING",
        '"oracle+oracledb://MAJED:StrongPass123@10.10.10.10:1521/XEPDB1"',
    )

    s = Settings()
    assert s.ORACLE_CONNECTION_STRING.endswith("XEPDB1")
    assert not (s.ORACLE_CONNECTION_STRING.startswith('"') or s.ORACLE_CONNECTION_STRING.endswith('"'))
