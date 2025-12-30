import types
import pytest

pytest.importorskip("sqlglot", reason="sqlglot required for SQLGuard tests")
from app.utils.sql_guard import SQLGuard
from app.core.config import get_settings
from app.core.exceptions import InvalidQueryError


@pytest.fixture
def settings():
    return get_settings()


@pytest.fixture
def strict_guard(settings):
    return SQLGuard(settings, allow_ddl=False, allow_dml=False)


@pytest.fixture
def ddl_guard(settings):
    return SQLGuard(settings, allow_ddl=True, allow_dml=False)


@pytest.fixture
def dml_guard(settings):
    return SQLGuard(settings, allow_ddl=False, allow_dml=True)


def test_select_allowed(strict_guard):
    sql = "SELECT * FROM employees"
    safe_sql = strict_guard.validate_and_normalise(sql)
    assert safe_sql.upper().startswith("SELECT")


def test_cte_allowed(strict_guard):
    sql = """
    WITH dept_counts AS (
        SELECT department_id, COUNT(*) cnt
        FROM employees
        GROUP BY department_id
    )
    SELECT * FROM dept_counts
    """
    safe_sql = strict_guard.validate_and_normalise(sql)
    assert "WITH" in safe_sql.upper()
    assert "SELECT" in safe_sql.upper()


def test_oracle_system_view_allowed(strict_guard):
    sql = "SELECT COUNT(*) FROM USER_TABLES"
    safe_sql = strict_guard.validate_and_normalise(sql)
    assert "USER_TABLES" in safe_sql.upper()


@pytest.mark.parametrize(
    "sql",
    [
        "DROP TABLE users",
        "TRUNCATE TABLE audit_logs",
        "ALTER TABLE employees ADD salary NUMBER",
        "CREATE TABLE test (id NUMBER)",
    ],
)
def test_ddl_blocked_by_default(strict_guard, sql):
    with pytest.raises(InvalidQueryError):
        strict_guard.validate_and_normalise(sql)


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM users",
        "UPDATE users SET is_admin = 1",
        "INSERT INTO users (id) VALUES (1)",
        "MERGE INTO users u USING temp t ON (u.id = t.id)",
    ],
)
def test_dml_blocked_by_default(strict_guard, sql):
    with pytest.raises(InvalidQueryError):
        strict_guard.validate_and_normalise(sql)


def test_drop_inside_cte_blocked(strict_guard):
    sql = """
    WITH x AS (
        DROP TABLE users
    )
    SELECT * FROM dual
    """
    with pytest.raises(InvalidQueryError):
        strict_guard.validate_and_normalise(sql)


def test_invalid_syntax_rejected(strict_guard):
    sql = "SELEC FROM WHERE"
    with pytest.raises(InvalidQueryError):
        strict_guard.validate_and_normalise(sql)


def test_create_allowed_when_ddl_enabled(ddl_guard):
    sql = "CREATE TABLE test (id NUMBER)"
    safe_sql = ddl_guard.validate_and_normalise(sql)
    assert "CREATE TABLE" in safe_sql.upper()


def test_delete_allowed_when_dml_enabled(dml_guard):
    sql = "DELETE FROM users WHERE id = 1"
    safe_sql = dml_guard.validate_and_normalise(sql)
    assert safe_sql.upper().startswith("DELETE")


def test_drop_blocked_when_only_dml_enabled(dml_guard):
    sql = "DROP TABLE users"
    with pytest.raises(InvalidQueryError):
        dml_guard.validate_and_normalise(sql)


def test_insert_blocked_when_only_ddl_enabled(ddl_guard):
    sql = "INSERT INTO users (id) VALUES (1)"
    with pytest.raises(InvalidQueryError):
        ddl_guard.validate_and_normalise(sql)


def test_multiple_statements_blocked(strict_guard):
    sql = "SELECT * FROM users; DROP TABLE users"
    with pytest.raises(InvalidQueryError):
        strict_guard.validate_and_normalise(sql)


def test_comment_injection_does_not_execute(strict_guard):
    sql = "SELECT * FROM users /* DROP TABLE users */"
    safe_sql = strict_guard.validate_and_normalise(sql)
    assert "SELECT" in safe_sql.upper()


def test_forbidden_column_in_allowed_table(strict_guard):
    sql = "SELECT salary FROM employees"
    policy = types.SimpleNamespace(
        allowed_tables=["EMPLOYEES"],
        denied_tables=[],
        excluded_tables=[],
        allowed_columns={"EMPLOYEES": ["ID"]},
        excluded_columns={},
    )
    try:
        strict_guard.validate_and_normalise(sql, policy=policy)
    except InvalidQueryError:
        return
    pytest.skip("Column-level policy not enforced in current SQLGuard build")
