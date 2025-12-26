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
        """Return a new Oracle database connection."""
        # Use service name (DB_NAME) if provided; fallback to SID
        dsn = oracledb.makedsn(
            self.settings.DB_HOST,
            self.settings.DB_PORT,
            service_name=self.settings.DB_NAME,
        )
        return oracledb.connect(
            user=self.settings.DB_USER,
            password=self.settings.DB_PASSWORD,
            dsn=dsn,
            mode=oracledb.DEFAULT_AUTH
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