"""
AST-based SQLGuard using sqlglot for semantic validation.
Final, governance-locked version.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Set, Tuple

import sqlglot
from sqlglot import exp
from sqlglot.errors import ParseError

from app.core.config import Settings
from app.core.exceptions import InvalidQueryError


class SQLGuardViolation(InvalidQueryError):
    """
    Raised when SQL violates security, governance, or schema access rules.

    This exception is:
    - Semantically distinct from general query errors
    - Explicitly catchable by NDJSON streaming handlers
    - Treated as a hard security violation (403-equivalent)
    """
    pass


class SQLGuard:
    """
    Final gatekeeper before SQL execution.

    Responsibilities:
    - Parse SQL into AST (sqlglot)
    - Enforce statement-type restrictions (SELECT-only by default)
    - Block forbidden DDL/DML unless explicitly allowed
    - Enforce SchemaAccessPolicy (tables / columns)
    - Apply deterministic row limits

    This component is GOVERNANCE-CRITICAL.
    """

    def __init__(
        self,
        settings: Settings,
        allow_ddl: bool = False,
        allow_dml: bool = False,
    ):
        self.settings = settings
        self.allow_ddl = allow_ddl
        self.allow_dml = allow_dml
        self.dialect = "oracle"

        self.forbidden_expressions = {
            exp.Drop,
            exp.TruncateTable,
            exp.Delete,
            exp.Update,
            exp.Insert,
            exp.Merge,
            exp.Alter,
            exp.Create,
        }

        self.last_tables: Set[str] = set()
        self.last_columns: Set[Tuple[str, str]] = set()

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def validate_and_normalise(self, sql: str, policy: Any = None) -> str:
        """
        Validate SQL against governance and policy rules
        and return a normalised, safe SQL string.

        Raises:
            SQLGuardViolation: on any security / policy violation
            InvalidQueryError: on malformed SQL
        """
        if ";" in sql.strip().rstrip(";"):
            raise SQLGuardViolation(
                "SECURITY_VIOLATION: multiple SQL statements are not allowed"
            )

        tree = self._parse(sql)
        self._enforce_statement_type(tree)
        self._block_forbidden(tree)

        tables, columns = self._extract_entities(tree)
        self.last_tables = tables
        self.last_columns = columns

        if policy:
            self._enforce_policy(tables, columns, policy)

        normalised = tree.sql(dialect=self.dialect)
        normalised = self._apply_limit(normalised)

        return normalised

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    def _parse(self, sql: str) -> exp.Expression:
        try:
            return sqlglot.parse_one(sql, read=self.dialect)
        except ParseError as exc:
            raise InvalidQueryError(
                f"SECURITY_VIOLATION: parse_error {exc}"
            ) from exc

    def _enforce_statement_type(self, tree: exp.Expression) -> None:
        root = tree
        if isinstance(root, exp.With):
            root = root.this

        if isinstance(root, exp.Select):
            return

        if isinstance(root, exp.Create) and self.allow_ddl:
            return

        if isinstance(
            root, (exp.Insert, exp.Update, exp.Delete, exp.Merge)
        ) and self.allow_dml:
            return

        raise SQLGuardViolation(
            f"SECURITY_VIOLATION: Statement type '{type(root).__name__}' not allowed"
        )

    def _block_forbidden(self, tree: exp.Expression) -> None:
        for node in tree.walk():
            if type(node) in self.forbidden_expressions and not self._is_allowed_exception(node):
                raise SQLGuardViolation(
                    f"SECURITY_VIOLATION: Forbidden SQL operation {type(node).__name__}"
                )

    def _is_allowed_exception(self, node: exp.Expression) -> bool:
        if isinstance(node, exp.Create) and self.allow_ddl:
            return True
        if isinstance(node, (exp.Insert, exp.Update, exp.Delete, exp.Merge)) and self.allow_dml:
            return True
        return False

    def _extract_entities(
        self,
        tree: exp.Expression,
    ) -> Tuple[Set[str], Set[Tuple[str, str]]]:
        tables: Set[str] = set()
        columns: Set[Tuple[str, str]] = set()

        for t in tree.find_all(exp.Table):
            table_name = ".".join(
                part for part in [t.db, t.name] if part
            ).upper()
            if table_name:
                tables.add(table_name.split(".")[-1])

        for c in tree.find_all(exp.Column):
            tbl = (c.table or "").upper()
            col = c.name.upper()
            if col:
                columns.add((tbl, col))

        return tables, columns

    def _enforce_policy(
        self,
        tables: Set[str],
        columns: Set[Tuple[str, str]],
        policy: Any,
    ) -> None:
        allowed_tables = set(policy.allowed_tables or [])
        denied_tables = set(policy.denied_tables or []) | set(
            policy.excluded_tables or []
        )

        allowed_columns: Dict[str, List[str]] = {
            k.upper(): [c.upper() for c in v]
            for k, v in (policy.allowed_columns or {}).items()
        }
        excluded_columns: Dict[str, List[str]] = {
            k.upper(): [c.upper() for c in v]
            for k, v in (policy.excluded_columns or {}).items()
        }

        for tbl in tables:
            if denied_tables and tbl in denied_tables:
                raise SQLGuardViolation(
                    "SECURITY_VIOLATION: table not allowed by policy"
                )
            if allowed_tables and tbl not in {t.upper() for t in allowed_tables}:
                raise SQLGuardViolation(
                    "SECURITY_VIOLATION: table not allowed by policy"
                )

        for tbl, col in columns:
            if tbl:
                if tbl in excluded_columns and col in excluded_columns[tbl]:
                    raise SQLGuardViolation(
                        "SECURITY_VIOLATION: column not allowed by policy"
                    )
                if allowed_columns.get(tbl) and col not in allowed_columns[tbl]:
                    raise SQLGuardViolation(
                        "SECURITY_VIOLATION: column not allowed by policy"
                    )

    def _apply_limit(self, sql: str, limit: int = 100) -> str:
        sql_upper = sql.upper()
        limit_val = getattr(self.settings, "DEFAULT_ROW_LIMIT", limit)
        db_type = getattr(self.settings, "DB_TYPE", "oracle").lower()

        if db_type == "oracle":
            if "FETCH FIRST" not in sql_upper and "ROWNUM" not in sql_upper:
                return f"{sql.rstrip()} FETCH FIRST {limit_val} ROWS ONLY"

        elif db_type == "mssql":
            if re.match(r"SELECT\s+TOP", sql_upper) is None:
                return re.sub(
                    r"^SELECT",
                    f"SELECT TOP {limit_val}",
                    sql,
                    count=1,
                    flags=re.IGNORECASE,
                )

        elif db_type == "postgres":
            if "LIMIT" not in sql_upper:
                return f"{sql.rstrip()} LIMIT {limit_val}"

        return sql