import re
import pytest

FORBIDDEN = ["DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "MERGE", "ALTER", "CREATE"]


def is_sql_allowed(sql: str, allow_ddl=False, allow_dml=False):
    tokens = re.split(r"\s+", sql.upper())
    if any(tok in FORBIDDEN for tok in tokens):
        if not (allow_ddl or allow_dml):
            return False
    return True


@pytest.mark.parametrize("sql", ["SELECT * FROM users", "WITH t AS (SELECT 1) SELECT * FROM t"])
def test_select_allowed(sql):
    assert is_sql_allowed(sql) is True


@pytest.mark.parametrize("sql", ["DROP TABLE users", "DELETE FROM users", "ALTER TABLE employees ADD col NUMBER"])
def test_ddl_dml_blocked(sql):
    assert is_sql_allowed(sql) is False


def test_ddl_allowed_when_flag_true():
    assert is_sql_allowed("DROP TABLE X", allow_ddl=True) is True
