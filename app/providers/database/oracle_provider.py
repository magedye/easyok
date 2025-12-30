"""
Oracle database provider using the `oracledb` driver.

This provider creates a read‑only connection to an Oracle database
using the oracledb library (version 2.0.1 or later) and executes
SELECT queries.  Dialect‑specific features (e.g. `FETCH FIRST`) are
handled by the SQL guard utility.
"""

from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
import os
import re
import oracledb  # type: ignore

from app.core.config import Settings
from app.core.exceptions import AppException, InvalidConnectionStringError
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
            return self._connect_from_conn_str(conn_str)

        # 2) Fallback to explicit DB_* or generic env fields when present
        env_conn = self._resolve_env_connection()
        if env_conn:
            user, password, host, port, db_name, use_service = env_conn
            return self._connect_with_parts(user, password, host, port, db_name, use_service)

        raise InvalidConnectionStringError(
            "Missing Oracle connection details; set ORACLE_CONNECTION_STRING or DB_USER/DB_PASSWORD/DB_HOST/DB_PORT/DB_NAME"
        )

    def _connect_from_conn_str(self, conn_str: str) -> oracledb.Connection:
        """Parse and connect using a single connection string."""
        conn_str_clean = str(conn_str).strip().split()[0]
        try:
            parts = self._parse_connection_string(conn_str_clean)
            return self._connect_with_parts(*parts)
        except InvalidConnectionStringError:
            raise
        except Exception as exc:  # pragma: no cover - defensive
            raise AppException(str(exc))

    def _resolve_env_connection(self) -> Optional[Tuple[str, str, str, int, str, bool]]:
        """Resolve connection pieces from settings or environment variables."""
        user = getattr(self.settings, "DB_USER", None) or os.environ.get("DB_USER") or os.environ.get("USER")
        password = getattr(self.settings, "DB_PASSWORD", None) or os.environ.get("DB_PASSWORD") or os.environ.get("PASSWORD")
        host = getattr(self.settings, "DB_HOST", None) or os.environ.get("DB_HOST") or os.environ.get("HOST")
        port_val = getattr(self.settings, "DB_PORT", None) or os.environ.get("DB_PORT") or os.environ.get("PORT")
        service = getattr(self.settings, "DB_NAME", None) or os.environ.get("DB_NAME") or os.environ.get("SERVICE")
        sid = os.environ.get("DB_SID") or os.environ.get("SID")

        if not (user and password and host and port_val):
            return None

        try:
            port = int(port_val)
        except Exception:
            raise InvalidConnectionStringError("INVALID_CONNECTION_STRING: port must be an integer")

        target = service or sid
        if not target:
            raise InvalidConnectionStringError("INVALID_CONNECTION_STRING: missing service or SID")

        use_service = bool(service)
        return user, password, host, port, target, use_service

    def _parse_connection_string(self, conn_str: str) -> Tuple[str, str, str, int, str, bool]:
        """
        Parse common Oracle connection strings:
        - user/password@host:port/service
        - user/password@host:port:sid
        - oracle+oracledb://user:password@host:port/service
        """
        pattern = re.compile(
            r"(?:(?:[a-zA-Z0-9_+\-]+)://)?"  # optional scheme
            r"(?P<user>[^:@/]+):(?P<pw>[^@]+)@"
            r"(?:/{2})?"  # optional double slash after @
            r"(?P<host>[^:/]+):(?P<port>\\d+)"
            r"(?P<sep>[:/])"
            r"(?P<name>[^/?]+)"
            r"$"
        )
        m = pattern.match(conn_str)
        if not m:
            raise InvalidConnectionStringError(
                "INVALID_CONNECTION_STRING: expected user/password@host:port/service or user/password@host:port:sid"
            )

        user = m.group("user")
        password = m.group("pw")
        host = m.group("host")
        port = int(m.group("port"))
        name = m.group("name")
        use_service = m.group("sep") == "/"
        return user, password, host, port, name, use_service

    def _connect_with_parts(
        self, user: str, password: str, host: str, port: int, name: str, use_service: bool
    ) -> oracledb.Connection:
        try:
            dsn = (
                oracledb.makedsn(host, port, service_name=name)
                if use_service
                else oracledb.makedsn(host, port, sid=name)
            )
            return oracledb.connect(user=user, password=password, dsn=dsn)
        except InvalidConnectionStringError:
            raise
        except Exception as exc:
            raise AppException(str(exc))

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
