"""
Microsoft SQL Server provider using ODBC.

This provider connects to MSSQL using pyodbc and executes read‑only
SELECT queries.  Parameter binding is supported via the parameters
dictionary.
"""

from typing import Any, Dict, List
from dataclasses import dataclass
import pyodbc  # type: ignore

from app.core.config import Settings
from app.core.exceptions import AppException
from ..base import BaseDatabaseProvider


@dataclass
class MSSQLProvider(BaseDatabaseProvider):
    settings: Settings

    def _connection_string(self) -> str:
        return (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={self.settings.DB_HOST},{self.settings.DB_PORT};"
            f"DATABASE={self.settings.DB_NAME};"
            f"UID={self.settings.DB_USER};PWD={self.settings.DB_PASSWORD};"
            f"TrustServerCertificate=yes"
        )

    def connect(self) -> pyodbc.Connection:
        try:
            conn = pyodbc.connect(self._connection_string())
            return conn
        except Exception as exc:
            raise AppException(str(exc))

    def execute(self, sql: str, parameters: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
        try:
            conn = self.connect()
            cursor = conn.cursor()
            cursor.execute(sql, parameters or {})
            columns = [column[0] for column in cursor.description]
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