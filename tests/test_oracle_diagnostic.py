# -*- coding: utf-8 -*-
"""
Oracle diagnostic tests (integration-style) for EasyData

- Reads configuration from `app.core.config.settings` (SSOT)
- Uses read-only metadata queries and `FETCH FIRST` syntax
- Skips automatically when prerequisites (driver or settings) are missing

These tests are meant to be opt-in integration checks. They will not fail CI
when Oracle is not configured; instead they will be skipped with clear reasons.
"""
import os
import pathlib
import pytest
import traceback
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Load env vars from .env so diagnostics reflect configured credentials
try:  # pragma: no cover - optional dependency
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
except Exception:
    pass

# Skip entire module if pydantic (and pydantic-settings) are not available
pytest.importorskip("pydantic", reason="Pydantic not installed; skipping Oracle diagnostics")

from app.core.config import settings


def _has_oracle_driver() -> bool:
    try:
        import oracledb  # type: ignore
        return True
    except Exception:
        return False


def _get_connection_args():
    """Return dict with connection args or None if not available.

    Order of precedence:
    1. Explicit DB_* env vars (DB_USER/DB_PASSWORD/DB_HOST/DB_PORT/DB_NAME)
    2. ORACLE_CONNECTION_STRING in Settings
    3. DATA_ORACLE_DSN / DATA_ORACLE_USER / DATA_ORACLE_PASSWORD (convenience for local dev)
    """
    # 1) Explicit DB_* env vars (preferred)
    env_user = os.environ.get("DB_USER")
    env_pass = os.environ.get("DB_PASSWORD")
    env_host = os.environ.get("DB_HOST")
    env_port = os.environ.get("DB_PORT")
    env_name = os.environ.get("DB_NAME")
    if env_user and env_pass and env_host and env_port and env_name:
        return {
            "user": env_user,
            "password": env_pass,
            "host": env_host,
            "port": int(env_port),
            "service_name": env_name,
        }

    # 2) ORACLE_CONNECTION_STRING in Settings (may be sanitized by Settings)
    if getattr(settings, "ORACLE_CONNECTION_STRING", None):
        return {"connection_string": settings.ORACLE_CONNECTION_STRING}

    # 3) DATA_ORACLE_DSN convenience env var (format: host:port/service)
    data_dsn = os.environ.get("DATA_ORACLE_DSN")
    data_user = os.environ.get("DATA_ORACLE_USER")
    data_pw = os.environ.get("DATA_ORACLE_PASSWORD")
    if data_dsn and data_user and data_pw:
        # Parse HOST:PORT/SERVICE
        try:
            host_port, service = data_dsn.split("/", 1)
            host, port = host_port.split(":", 1)
            return {
                "user": data_user,
                "password": data_pw,
                "host": host,
                "port": int(port),
                "service_name": service,
            }
        except Exception:
            # Malformed DSN — fall through to None
            return None

    # Nothing found
    return None


@pytest.mark.skipif(not _has_oracle_driver(), reason="oracledb driver not installed")
def test_oracle_settings_present():
    """Ensure that project settings indicate Oracle is the selected DB and/or connection data exists."""
    # If the project is not configured to use Oracle, skip the test
    if getattr(settings, "DB_PROVIDER", None) and settings.DB_PROVIDER != "oracle":
        pytest.skip("DB_PROVIDER is not 'oracle', skipping Oracle diagnostics")

    conn_args = _get_connection_args()
    if not conn_args:
        pytest.skip(
            "No Oracle connection settings found in `settings` or environment; set ORACLE_CONNECTION_STRING or DB_* env vars to enable this test"
        )

    # If we reached here, we have enough configuration to attempt a connection
    assert conn_args is not None


@pytest.mark.skipif(not _has_oracle_driver(), reason="oracledb driver not installed")
def test_oracle_connect_and_metadata():
    """Attempt to connect and run safe metadata queries (read-only)."""
    import oracledb  # type: ignore

    conn_args = _get_connection_args()
    if not conn_args:
        pytest.skip("No Oracle connection settings found; skipping connection test")

    try:
        if "connection_string" in conn_args:
            # When ORACLE_CONNECTION_STRING is a full connect string
            conn = oracledb.connect(conn_args["connection_string"])
        else:
            # Build dsn and connect safely
            dsn = oracledb.makedsn(
                conn_args["host"], conn_args["port"], service_name=conn_args["service_name"]
            )
            conn = oracledb.connect(
                user=conn_args["user"],
                password=conn_args["password"],
                dsn=dsn,
            )

        # Ensure connection is open
        assert conn is not None

        cur = conn.cursor()
        cur.execute("SELECT table_name FROM user_tables FETCH FIRST 5 ROWS ONLY")
        tables = [r[0] for r in cur.fetchall()]

        # If connection works but no tables, warn but pass the test (user may have no objects)
        if not tables:
            pytest.skip("Connected to Oracle but no user tables found or insufficient permissions")

        # Check first table columns and sample row (read-only)
        first_table = tables[0]
        cur.execute(f"SELECT column_name, data_type FROM user_tab_columns WHERE table_name=UPPER(:t)", {"t": first_table})
        cols = cur.fetchall()
        assert cols, "No columns found for table; unexpected schema state"

        # Safe sample read
        cur.execute(f"SELECT * FROM {first_table} FETCH FIRST 1 ROWS ONLY")
        sample = cur.fetchone()
        # sample may be None if row-level security denies access; handle gracefully
        # Test passes if we reached and executed read-only queries
        assert True

    except Exception as exc:  # pragma: no cover - integration behavior
        traceback.print_exc()
        pytest.fail(f"Oracle diagnostic failed: {exc}")
    finally:
        try:
            conn.close()  # type: ignore
        except Exception:
            pass
