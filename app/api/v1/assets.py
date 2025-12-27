from typing import Any, Dict, List
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies import require_permission, UserContext
from app.services.assets_service import AssetsService
from app.services.audit_service import AuditService

router = APIRouter(tags=["assets"])
service = AssetsService()
audit_service = AuditService()


class AssetCreateRequest(BaseModel):
    question: str
    sql: str
    assumptions: List[str]
    chart: Dict[str, Any]
    semantic_context: Dict[str, Any] | None = None
    success: bool = True


@router.post("/assets/queries")
async def save_asset(
    payload: AssetCreateRequest,
    user: UserContext = Depends(require_permission("asset:write")),
):
    # Only allow save if assumptions present and SQL provided
    if not payload.success:
        raise HTTPException(status_code=400, detail="Only successful queries can be saved as assets")
    if not payload.sql or not payload.assumptions:
        raise HTTPException(status_code=400, detail="SQL and assumptions are required")
    asset = service.save_asset(
        question=payload.question,
        sql=payload.sql,
        assumptions=payload.assumptions,
        chart_config=payload.chart,
        semantic_context=payload.semantic_context or {},
        created_by=user.get("user_id"),
    )
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="asset_save",
        resource_id=str(asset.id),
        payload={"question": payload.question},
        status="success",
        outcome="success",
    )
    return {"id": asset.id}


@router.get("/assets/queries")
async def list_assets(
    user: UserContext = Depends(require_permission("asset:read")),
):
    assets = service.list_assets()
    return [
        {
            "id": a.id,
            "question": a.question,
            "sql": a.sql,
            "assumptions": json.loads(a.assumptions or "[]"),
            "chart_config": json.loads(a.chart_config or "{}"),
            "semantic_context": json.loads(a.semantic_context or "{}"),
            "created_at": a.created_at,
        }
        for a in assets
    ]


@router.delete("/assets/queries/{asset_id}")
async def delete_asset(
    asset_id: int,
    user: UserContext = Depends(require_permission("asset:delete")),
):
    service.delete_asset(asset_id)
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="asset_delete",
        resource_id=str(asset_id),
        status="success",
        outcome="success",
    )
    return {"status": "deleted"}
