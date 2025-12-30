from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import require_permission, UserContext
from app.services.schema_policy_service import SchemaPolicyService
from app.services.vanna_service import VannaService
from app.services.audit_service import AuditService
from app.services.schema_connection_service import SchemaConnectionService
from app.core.exceptions import AppException
from app.core.config import get_settings
from app.utils.sql_guard import SQLGuard, SQLGuardViolation

router = APIRouter(tags=["schema"])
policy_service = SchemaPolicyService()
vanna = VannaService()
audit_service = AuditService()
connection_service = SchemaConnectionService()
settings = get_settings()
sql_guard = SQLGuard(settings)


@router.get("/schema/discover")
async def discover_schema(
    user: UserContext = Depends(require_permission("admin:view")),
):
    """
    Read-only discovery of schemas/tables/columns (no caching, no training side effects).
    """
    try:
        schemas = []
        owners = vanna.db.execute("SELECT DISTINCT OWNER FROM ALL_TABLES")
        for o in owners or []:
            owner = o.get("OWNER")
            tables = vanna.db.execute(
                f"SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = '{owner}' FETCH FIRST 200 ROWS ONLY"
            )
            table_entries = []
            for t in tables or []:
                name = t.get("TABLE_NAME")
                cols = vanna.db.execute(
                    f"SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS WHERE OWNER = '{owner}' AND TABLE_NAME = '{name}'"
                )
                table_entries.append({"table": name, "columns": cols or []})
            schemas.append({"schema": owner, "tables": table_entries})
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="policy_preview",
            resource_id=None,
            payload={"schemas_count": len(schemas)},
            status="completed",
            outcome="success",
        )
        return {"schemas": schemas}
    except AppException as exc:
        raise exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


def _sanitize_identifier(identifier: str) -> str:
    ident = (identifier or "").strip()
    if not ident:
        raise HTTPException(status_code=400, detail="Identifier is required")
    import re
    if not re.match(r"^[A-Za-z0-9_\\$]+$", ident):
        raise HTTPException(status_code=400, detail="Invalid identifier")
    return ident.upper()


@router.get("/schema/{connection_id}/tables")
async def list_tables(
    connection_id: str,
    user: UserContext = Depends(require_permission("schema:connections")),
):
    """List tables for the given connection (read-only)."""
    try:
        tables = vanna.db.execute("SELECT OWNER, TABLE_NAME FROM ALL_TABLES FETCH FIRST 500 ROWS ONLY")
        out = [
            {
                "schema": t.get("OWNER"),
                "name": t.get("TABLE_NAME"),
            }
            for t in tables or []
        ]
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="schema_tables_listed",
            resource_id=connection_id,
            payload={"count": len(out)},
            outcome="success",
        )
        return {"tables": out}
    except AppException as exc:
        raise exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/schema/{connection_id}/tables/{table}/columns")
async def list_columns(
    connection_id: str,
    table: str,
    user: UserContext = Depends(require_permission("schema:connections")),
):
    """List columns for a given table (read-only)."""
    tbl = _sanitize_identifier(table)
    try:
        rows = vanna.db.execute(
            f"SELECT OWNER, TABLE_NAME, COLUMN_NAME, DATA_TYPE, NULLABLE FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = '{tbl}' FETCH FIRST 500 ROWS ONLY"
        )
        out = [
            {
                "name": r.get("COLUMN_NAME"),
                "type": r.get("DATA_TYPE"),
                "nullable": r.get("NULLABLE") == "Y",
                "schema": r.get("OWNER"),
                "table": r.get("TABLE_NAME"),
            }
            for r in rows or []
        ]
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="schema_columns_listed",
            resource_id=connection_id,
            payload={"table": tbl, "count": len(out)},
            outcome="success",
        )
        return {"columns": out}
    except AppException as exc:
        raise exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/schema/{connection_id}/tables/{table}/sample")
async def sample_table(
    connection_id: str,
    table: str,
    user: UserContext = Depends(require_permission("schema:connections")),
    limit: int = 20,
):
    """Return a small sample of rows for a given table (hard row cap)."""
    tbl = _sanitize_identifier(table)
    row_cap = min(limit or 20, settings.DEFAULT_ROW_LIMIT)
    try:
        sql = f"SELECT * FROM {tbl} FETCH FIRST {row_cap} ROWS ONLY"
        policy = policy_service.get_active()
        normalized_sql = sql_guard.validate_and_normalise(sql, policy=policy)
        rows = vanna.db.execute(normalized_sql)
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="schema_table_sampled",
            resource_id=connection_id,
            payload={"table": tbl, "rows": len(rows or [])},
            outcome="success",
        )
        return {"rows": rows or [], "row_count": len(rows or [])}
    except SQLGuardViolation as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except AppException as exc:
        raise exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/schema/connections")
async def create_schema_connection(
    payload: Dict[str, Any],
    user: UserContext = Depends(require_permission("schema:connections")),
):
    """
    Create a schema connection entry. Secrets are stored masked; responses never return raw credentials.
    """
    try:
        conn = connection_service.create(
            name=payload.get("name", ""),
            connection_string=payload.get("connection_string") or payload.get("connectionString") or "",
            description=payload.get("description"),
            tags=payload.get("tags") or [],
            user=user,
        )
        return conn
    except AppException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/schema/connections")
async def list_schema_connections(
    user: UserContext = Depends(require_permission("schema:connections")),
):
    return {"connections": connection_service.list()}


@router.get("/schema/connections/{connection_id}")
async def get_schema_connection(
    connection_id: str,
    user: UserContext = Depends(require_permission("schema:connections")),
):
    conn = connection_service.get(connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn


@router.post("/schema/connections/{connection_id}/test")
async def test_schema_connection(
    connection_id: str,
    user: UserContext = Depends(require_permission("schema:connections")),
):
    try:
        return connection_service.test(connection_id, user)
    except AppException as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/schema/connections/{connection_id}")
async def delete_schema_connection(
    connection_id: str,
    user: UserContext = Depends(require_permission("schema:connections")),
):
    connection_service.delete(connection_id, user)
    return {"status": "deleted"}


@router.get("/schema/{connection_id}/inspect")
async def inspect_schema(
    connection_id: str,
    user: UserContext = Depends(require_permission("schema:connections")),
):
    """Return metadata only (tables/columns) without data rows."""
    try:
        # For now, use active DB connection; ignore connection_id
        tables = vanna.db.execute("SELECT OWNER, TABLE_NAME FROM ALL_TABLES FETCH FIRST 200 ROWS ONLY")
        out: List[Dict[str, Any]] = []
        for t in tables or []:
            owner = t.get("OWNER")
            name = t.get("TABLE_NAME")
            cols = vanna.db.execute(
                f"SELECT COLUMN_NAME, DATA_TYPE, NULLABLE FROM ALL_TAB_COLUMNS WHERE OWNER = '{owner}' AND TABLE_NAME = '{name}'"
            )
            out.append(
                {
                    "schema": owner,
                    "table": name,
                    "columns": [
                        {"name": c.get("COLUMN_NAME"), "type": c.get("DATA_TYPE"), "nullable": c.get("NULLABLE") == "Y"}
                        for c in cols or []
                    ],
                }
            )
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="schema_inspect",
            resource_id=connection_id,
            payload={"tables": len(out)},
            status="completed",
            outcome="success",
        )
        return {"metadata": out}
    except AppException as exc:
        raise exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/schema/policy/draft")
async def create_policy_draft(
    payload: Dict[str, Any],
    user: UserContext = Depends(require_permission("schema.policy")),
):
    try:
        policy = policy_service.create_draft(
            db_connection_id=payload.get("db_connection_id"),
            schema_name=(payload.get("schema_name") or "").upper(),
            allowed_tables=payload.get("allowed_tables") or [],
            allowed_columns=payload.get("allowed_columns") or {},
            denied_tables=payload.get("denied_tables") or [],
            created_by=user.get("user_id"),
        )
        return {"id": policy.id, "status": policy.status}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def _policy_summary(payload: Dict[str, Any]) -> Dict[str, Any]:
    allowed_tables = payload.get("allowed_tables") or payload.get("allowedTables") or []
    denied_tables = payload.get("denied_tables") or payload.get("deniedTables") or payload.get("excluded_tables") or []
    allowed_columns = payload.get("allowed_columns") or payload.get("allowedColumns") or {}
    denied_columns = payload.get("denied_columns") or payload.get("deniedColumns") or {}
    return {
        "allowed_tables_count": len(allowed_tables),
        "denied_tables_count": len(denied_tables),
        "allowed_columns_count": sum(len(v or []) for v in allowed_columns.values()),
        "denied_columns_count": sum(len(v or []) for v in denied_columns.values()),
    }


def _policy_to_dict(policy) -> Dict[str, Any]:
    return {
        "id": policy.id,
        "connection_id": policy.db_connection_id,
        "schema_name": policy.schema_name,
        "allowed_tables": policy.allowed_tables or [],
        "denied_tables": policy.denied_tables or [],
        "allowed_columns": policy.allowed_columns or {},
        "denied_columns": policy.excluded_columns or {},
        "status": policy.status,
        "version_id": policy.version,
        "created_by": policy.created_by,
        "created_at": policy.created_at.isoformat() if policy.created_at else None,
    }


@router.post("/schema/policy/wizard/preview")
async def policy_wizard_preview(
    payload: Dict[str, Any],
    user: UserContext = Depends(require_permission("schema.policy")),
):
    """Preview a draft policy: counts and warnings only."""
    summary = _policy_summary(payload)
    warnings: list[str] = []
    if summary["allowed_tables_count"] == 0:
        warnings.append("No allowed tables specified.")
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="policy_wizard_preview",
        resource_id=None,
        payload=summary,
        outcome="success",
    )
    return {"summary": summary, "warnings": warnings}


@router.post("/schema/policy/wizard/commit", status_code=201)
async def policy_wizard_commit(
    payload: Dict[str, Any],
    user: UserContext = Depends(require_permission("schema.policy")),
):
    """Commit a draft policy for later activation."""
    try:
        policy = policy_service.create_draft(
            db_connection_id=payload.get("connection_id") or payload.get("connectionId"),
            schema_name=(payload.get("schema_name") or payload.get("schemaName") or "").upper(),
            allowed_tables=payload.get("allowed_tables") or payload.get("allowedTables") or [],
            allowed_columns=payload.get("allowed_columns") or payload.get("allowedColumns") or {},
            denied_tables=payload.get("denied_tables") or payload.get("deniedTables") or [],
            excluded_tables=payload.get("denied_tables") or payload.get("deniedTables") or [],
            excluded_columns=payload.get("denied_columns") or payload.get("deniedColumns") or {},
            created_by=user.get("user_id"),
        )
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="policy_wizard_commit",
            resource_id=policy.id,
            payload={"schema": policy.schema_name, "connection_id": policy.db_connection_id},
            outcome="success",
        )
        return _policy_to_dict(policy)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/schema/policy/{policy_id}")
async def update_policy_draft(
    policy_id: str,
    payload: Dict[str, Any],
    user: UserContext = Depends(require_permission("schema.policy")),
):
    try:
        policy = policy_service.update_draft(
            policy_id,
            allowed_tables=payload.get("allowed_tables"),
            allowed_columns=payload.get("allowed_columns"),
            denied_tables=payload.get("denied_tables"),
        )
        return {"id": policy.id, "status": policy.status}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/schema/policy/{policy_id}/activate")
async def activate_policy(
    policy_id: str,
    user: UserContext = Depends(require_permission("schema.policy.activate")),
):
    try:
        policy = policy_service.activate(policy_id, approver=user.get("user_id"))
        return {"id": policy.id, "status": policy.status}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/schema/policy/commit")
async def commit_policy(
    payload: Dict[str, Any],
    user: UserContext = Depends(require_permission("schema.policy.activate")),
):
    """
    Commit a schema policy version (admin-only). No training side effects.
    """
    try:
        policy = policy_service.commit_policy(
            db_connection_id=payload.get("db_connection_id"),
            schema_name=(payload.get("schema_name") or "").upper(),
            allowed_tables=payload.get("allowed_tables") or [],
            allowed_columns=payload.get("allowed_columns") or {},
            excluded_tables=payload.get("excluded_tables") or [],
            excluded_columns=payload.get("excluded_columns") or {},
            created_by=user.get("user_id"),
        )
        return {"id": policy.id, "status": policy.status, "version": policy.version}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
