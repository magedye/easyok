# -*- coding: utf-8 -*-
"""
Oracle database provider using the `oracledb` driver.

This provider creates a connection to an Oracle database using the
oracledb library (version 2.0.1 or later) and executes SQL queries.

IMPORTANT:
- This provider is shared across Tier-0, Tier-1, and Tier-2.
- It does NOT enforce read-only behavior.
- Governance and query restrictions are handled at higher layers.
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
        # Thin mode is default; no forced client initialization here.
        pass

    def connect(self) -> oracledb.Connection:
        """
        Return a new Oracle database connection.

        Resolution order (unchanged):
        1) ORACLE_CONNECTION_STRING
        2) Discrete DB_* variables
        """
        conn_str = getattr(self.settings, "ORACLE_CONNECTION_STRING", None)
        if conn_str:
            return self._connect_from_conn_str(conn_str)

        env_conn = self._resolve_env_connection()
        if env_conn:
            user, password, host, port, db_name, use_service = env_conn
            return self._connect_with_parts(
                user, password, host, port, db_name, use_service
            )

        raise InvalidConnectionStringError(
            "Missing Oracle connection details; set ORACLE_CONNECTION_STRING "
            "or DB_USER/DB_PASSWORD/DB_HOST/DB_PORT/DB_NAME"
        )

    def _connect_from_conn_str(self, conn_str: str) -> oracledb.Connection:
        """
        Parse and connect using a single connection string.

        Defensive cleanup is applied to tolerate env formatting issues.
        """
        clean = str(conn_str).strip().strip('"').strip("'")
        clean = clean.split()[0]

        try:
            parts = self._parse_connection_string(clean)
            return self._connect_with_parts(*parts)
        except InvalidConnectionStringError:
            raise
        except Exception as exc:
            raise AppException(f"Oracle connection failed: {exc}")

    def _resolve_env_connection(
        self,
    ) -> Optional[Tuple[str, str, str, int, str, bool]]:
        user = getattr(self.settings, "DB_USER", None) or os.environ.get("DB_USER")
        password = getattr(self.settings, "DB_PASSWORD", None) or os.environ.get("DB_PASSWORD")
        host = getattr(self.settings, "DB_HOST", None) or os.environ.get("DB_HOST")
        port_val = getattr(self.settings, "DB_PORT", None) or os.environ.get("DB_PORT")
        service = getattr(self.settings, "DB_NAME", None) or os.environ.get("DB_NAME")
        sid = os.environ.get("DB_SID")

        if not (user and password and host and port_val):
            return None

        try:
            port = int(port_val)
        except ValueError:
            raise InvalidConnectionStringError(
                f"INVALID_CONNECTION_STRING: port '{port_val}' must be an integer"
            )

        target = service or sid
        if not target:
            raise InvalidConnectionStringError(
                "INVALID_CONNECTION_STRING: missing service name or SID"
            )

        use_service = bool(service)
        return user, password, host, port, target, use_service

    def _parse_connection_string(
        self, conn_str: str
    ) -> Tuple[str, str, str, int, str, bool]:
        pattern = re.compile(
            r"(?:(?P<scheme>[a-zA-Z0-9_+\-]+)://)?"
            r"(?P<user>[^:@/]+)(?P<auth_sep>[:/])(?P<pw>[^@]+)@"
            r"(?P<host>[^:/]+):(?P<port>\d+)"
            r"(?P<sep>[:/])"
            r"(?P<name>[^/?\s]+)"
        )

        match = pattern.search(conn_str)
        if not match:
            sanitized = re.sub(r":([^@]+)@", ":****@", conn_str)
            raise InvalidConnectionStringError(
                f"INVALID_CONNECTION_STRING: could not parse '{sanitized}'"
            )

        user = match.group("user")
        password = match.group("pw")
        host = match.group("host")
        port = int(match.group("port"))
        name = match.group("name")
        use_service = match.group("sep") == "/"

        return user, password, host, port, name, use_service

    def _connect_with_parts(
        self,
        user: str,
        password: str,
        host: str,
        port: int,
        name: str,
        use_service: bool,
    ) -> oracledb.Connection:
        try:
            dsn = (
                oracledb.makedsn(host, port, service_name=name)
                if use_service
                else oracledb.makedsn(host, port, sid=name)
            )
            return oracledb.connect(user=user, password=password, dsn=dsn)

        except oracledb.Error as exc:
            err = exc.args[0]
            raise AppException(f"Oracle error ORA-{err.code}: {err.message}")
        except Exception as exc:
            raise AppException(f"Unexpected Oracle connection error: {exc}")

    def execute(
        self, sql: str, parameters: Dict[str, Any] | None = None
    ) -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = self.connect()
            with conn.cursor() as cursor:
                cursor.execute(sql, parameters or {})
                if not cursor.description:
                    return []
                columns = [col[0] for col in cursor.description]
                return [dict(zip(columns, row)) for row in cursor.fetchall()]

        finally:
            if conn:
                try:
                    conn.close()
                except Exception:
                    pass
