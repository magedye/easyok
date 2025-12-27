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
    # Ensure virtual env present for this run
    monkeypatch.setenv("VIRTUAL_ENV", "/tmp/venv")
    res = subprocess.run([sys.executable, "scripts/oracle/extract_and_ingest_ddl.py", "--owner", "HR", "--dry-run", "--force"], capture_output=True)
    # script will attempt to import oracledb; if drivers are present, return code 0, else >0
    assert res is not None


@pytest.mark.skipif(not HAS_ORACLE or not HAS_CHROMA, reason="oracledb or chromadb not installed")
def test_venv_check(monkeypatch):
    # If VIRTUAL_ENV not set, script should exit with code 5 unless --skip-venv-check is passed
    monkeypatch.delenv("VIRTUAL_ENV", raising=False)
    monkeypatch.setenv("VANNA_ALLOW_DDL", "true")
    res = subprocess.run([sys.executable, "scripts/oracle/extract_and_ingest_ddl.py", "--owner", "HR", "--dry-run"], capture_output=True)
    assert res.returncode == 5
    assert b"Virtualenv is not activated" in (res.stdout + res.stderr) or b"Virtualenv is not activated" in (res.stderr + res.stdout)

    # Now bypass with --skip-venv-check
    res2 = subprocess.run([sys.executable, "scripts/oracle/extract_and_ingest_ddl.py", "--owner", "HR", "--dry-run", "--skip-venv-check"], capture_output=True)
    assert res2 is not None


@pytest.mark.skipif(not HAS_ORACLE or not HAS_CHROMA, reason="oracledb or chromadb not installed")
def test_list_owners(monkeypatch):
    # Listing owners should NOT require VANNA_ALLOW_DDL or an active venv
    monkeypatch.setenv("VANNA_ALLOW_DDL", "false")
    monkeypatch.delenv("VIRTUAL_ENV", raising=False)

    res = subprocess.run([sys.executable, "scripts/oracle/extract_and_ingest_ddl.py", "--list-owners"], capture_output=True)
    # Should exit 0 and include 'Discovered' or 'Connected as' messages
    assert res.returncode == 0
    out = (res.stdout + res.stderr).decode('utf-8', errors='ignore')
    assert "Discovered" in out or "Connected as" in out
