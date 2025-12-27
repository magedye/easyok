"""
SQL guard utilities.

This module provides functions to validate generated SQL statements,
ensure they contain only allowed operations (SELECT) and apply
dialect‑specific row limits.  It is not a full parser but offers
basic protection.  For more robust validation, consider using a SQL
parser library.
"""

import re
from typing import Optional

from app.core.config import Settings
from app.core.exceptions import InvalidQueryError


class SQLGuard:
    def __init__(self, settings: Settings):
        self.settings = settings

    def validate_and_normalise(self, sql: str) -> str:
        """
        Validate that the SQL is a single SELECT statement without
        disallowed keywords and apply row limit syntax if missing.
        """
        sql_upper = sql.strip().upper()
        if not sql_upper.startswith("SELECT"):
            raise InvalidQueryError("Only SELECT queries are allowed")
        # Disallow semicolons and multiple statements
        if ";" in sql_upper:
            raise InvalidQueryError("Multiple statements are not allowed")
        # Disallow data modification keywords
        disallowed = ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER"]
        if any(keyword in sql_upper for keyword in disallowed):
            raise InvalidQueryError("Modification queries are not allowed")
        # Add limit clause if missing
        return self._apply_limit(sql)

    def _apply_limit(self, sql: str, limit: int = 100) -> str:
        sql_upper = sql.upper()
        limit_val = self.settings.DEFAULT_ROW_LIMIT if hasattr(self.settings, "DEFAULT_ROW_LIMIT") else limit
        if self.settings.DB_TYPE.lower() == "oracle":
            if "FETCH FIRST" not in sql_upper and "ROWNUM" not in sql_upper:
                return f"{sql.rstrip()} FETCH FIRST {limit_val} ROWS ONLY"
        elif self.settings.DB_TYPE.lower() == "mssql":
            # MSSQL uses TOP; check if TOP already exists after SELECT
            if re.match(r"SELECT\s+TOP", sql_upper) is None:
                # Insert TOP after SELECT
                return sql.replace("SELECT", f"SELECT TOP {limit_val}", 1)
        elif self.settings.DB_TYPE.lower() == "postgres":
            if "LIMIT" not in sql_upper:
                return f"{sql.rstrip()} LIMIT {limit_val}"
        return sql
