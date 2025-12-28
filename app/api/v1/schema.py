from typing import List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import require_permission, UserContext
from app.services.schema_policy_service import SchemaPolicyService
from app.services.vanna_service import VannaService

router = APIRouter(tags=["schema"])
policy_service = SchemaPolicyService()
vanna = VannaService()


@router.get("/schema/{connection_id}/inspect")
async def inspect_schema(
    connection_id: str,
    user: UserContext = Depends(require_permission("query:execute")),
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
                f"SELECT COLUMN_NAME, DATA_TYPE FROM ALL_TAB_COLUMNS WHERE OWNER = '{owner}' AND TABLE_NAME = '{name}'"
            )
            out.append(
                {
                    "schema": owner,
                    "table": name,
                    "columns": cols or [],
                }
            )
        return {"metadata": out}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/schema/policy/draft")
async def create_policy_draft(
    payload: Dict[str, Any],
    user: UserContext = Depends(require_permission("training:upload")),
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


@router.patch("/schema/policy/{policy_id}")
async def update_policy_draft(
    policy_id: str,
    payload: Dict[str, Any],
    user: UserContext = Depends(require_permission("training:upload")),
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
    user: UserContext = Depends(require_permission("training:approve")),
):
    try:
        policy = policy_service.activate(policy_id, approver=user.get("user_id"))
        return {"id": policy.id, "status": policy.status}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
