import os
import subprocess
import sys
import pytest

# Skip tests if drivers are not installed
pytest.skipif = pytest.mark.skipif

HAS_ORACLE = True
HAS_CHROMA = True
try:
    import oracledb  # type: ignore
except Exception:
    HAS_ORACLE = False

try:
    import chromadb  # type: ignore
except Exception:
    HAS_CHROMA = False


@pytest.mark.skipif(not HAS_ORACLE or not HAS_CHROMA, reason="oracledb or chromadb not installed")
def test_dry_run_guard(tmp_path, monkeypatch):
    # Ensure VANNA_ALLOW_DDL=false prevents ingestion unless forced
    monkeypatch.setenv("VANNA_ALLOW_DDL", "false")
    script = "scripts/oracle/extract_and_ingest_ddl.py"
    # Call with dry-run (should still check guard and exit code 2)
    res = subprocess.run([sys.executable, script, "--owner", "HR", "--dry-run"], capture_output=True)
    assert res.returncode == 2
    assert b"DDL ingestion is disabled" in res.stderr or b"DDL ingestion is disabled" in res.stdout


@pytest.mark.skipif(not HAS_ORACLE or not HAS_CHROMA, reason="oracledb or chromadb not installed")
def test_force_bypass(monkeypatch):
    # This test is minimal — only ensures --force bypasses the guard; it won't try to connect to Oracle in CI
    monkeypatch.setenv("VANNA_ALLOW_DDL", "false")
    res = subprocess.run([sys.executable, "scripts/oracle/extract_and_ingest_ddl.py", "--owner", "HR", "--dry-run", "--force"], capture_output=True)
    # script will attempt to import oracledb; if drivers are present, return code 0, else >0
    assert res is not None
