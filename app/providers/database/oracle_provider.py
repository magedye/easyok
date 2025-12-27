"""
Oracle database provider using the `oracledb` driver.

This provider creates a read‑only connection to an Oracle database
using the oracledb library (version 2.0.1 or later) and executes
SELECT queries.  Dialect‑specific features (e.g. `FETCH FIRST`) are
handled by the SQL guard utility.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass
import oracledb  # type: ignore

from app.core.config import Settings
from app.core.exceptions import AppException
from ..base import BaseDatabaseProvider


@dataclass
class OracleProvider(BaseDatabaseProvider):
    settings: Settings

    def __post_init__(self) -> None:
        # Oracledb requires init_oracle_client on Windows if not using thin mode.
        # On Linux with thin driver this is not necessary.
        pass

    def connect(self) -> oracledb.Connection:
        """Return a new Oracle database connection.

        Supports two modes:
        - A direct ORACLE_CONNECTION_STRING in settings (preferred in typical deployments)
        - Individual DB_* env style variables when available
        """
        # 1) Try direct connection string from settings
        conn_str = getattr(self.settings, "ORACLE_CONNECTION_STRING", None)
        if conn_str:
            # Try direct connect; if it fails, fall back to parsing same as the DDL extractor
            try:
                return oracledb.connect(conn_str)
            except Exception:
                # Fall through to parsing approach
                pass

            # Attempt to parse common connect-string patterns
            try:
                import re

                conn_str_clean = str(conn_str).split()[0]
                pattern = re.compile(
                    r"(?:(?:[a-zA-Z0-9_+\-]+)://)?"  # optional scheme
                    r"(?P<user>[^:]+):(?P<pw>[^@]+)@"
                    r"(?P<host>[^:/]+):(?P<port>\d+)[/\\](?P<service>\S+)"
                )
                m = pattern.search(conn_str_clean)
                if not m:
                    raise RuntimeError(f"Unrecognized ORACLE_CONNECTION_STRING format: '{conn_str_clean}'")

                user = m.group("user")
                password = m.group("pw")
                host = m.group("host")
                port = int(m.group("port"))
                service = m.group("service")

                dsn = oracledb.makedsn(host, port, service_name=service)
                return oracledb.connect(user=user, password=password, dsn=dsn)
            except Exception as exc:  # pragma: no cover - defensive
                raise RuntimeError(f"Failed to connect using ORACLE_CONNECTION_STRING: {exc}")

        # 2) Fallback to explicit DB_* fields on settings when present
        try:
            host = getattr(self.settings, "DB_HOST", None)
            port = getattr(self.settings, "DB_PORT", None)
            dbname = getattr(self.settings, "DB_NAME", None)
            user = getattr(self.settings, "DB_USER", None)
            password = getattr(self.settings, "DB_PASSWORD", None)

            if host and port and dbname and user and password:
                dsn = oracledb.makedsn(host, int(port), service_name=dbname)
                return oracledb.connect(user=user, password=password, dsn=dsn, mode=oracledb.DEFAULT_AUTH)
        except Exception:
            pass

        raise RuntimeError(
            "Missing Oracle connection details; set ORACLE_CONNECTION_STRING or DB_* env vars"
        )

    def execute(self, sql: str, parameters: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
        try:
            conn = self.connect()
            with conn.cursor() as cursor:
                cursor.execute(sql, parameters or {})
                columns = [col[0] for col in cursor.description]
                rows = []
                for row in cursor.fetchall():
                    rows.append({col: value for col, value in zip(columns, row)})
                return rows
        except Exception as exc:
            raise AppException(str(exc))
        finally:
            try:
                conn.close()
            except Exception:
                pass