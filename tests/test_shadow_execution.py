import importlib.util
import pytest

sqlglot_available = importlib.util.find_spec("sqlglot") is not None
if not sqlglot_available:
    pytest.skip("sqlglot not available; skipping sandbox tests", allow_module_level=True)

from app.services.shadow_execution_service import ShadowExecutionService


def test_shadow_blocks_ddl():
    svc = ShadowExecutionService()
    res = svc.run("DROP TABLE users")
    assert res.status == "blocked"
    assert res.row_count == 0
    assert res.rows == []
    assert res.reason is not None


def test_shadow_executes_select_with_limits():
    svc = ShadowExecutionService()
    res = svc.run("SELECT 1")
    assert res.status == "executed"
    assert res.row_count == 0  # no-op driver returns empty set
    assert res.rows == []
    assert res.reason is None
