from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies import require_permission, UserContext
from app.services.training_service import TrainingService
from app.services.audit_service import AuditService

router = APIRouter(tags=["training"])
service = TrainingService()
audit_service = AuditService()


class DDLRequest(BaseModel):
    ddl: str


class ManualTrainingRequest(BaseModel):
    question: str
    sql: str
    metadata: Dict[str, Any] | None = None


@router.post("/training/ddl")
async def submit_ddl(
    payload: DDLRequest,
    user: UserContext = Depends(require_permission("training:upload")),
):
    try:
        item = service.submit_training_item(
            item_type="ddl",
            payload={"ddl": payload.ddl},
            created_by=user.get("user_id"),
        )
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="training_submit",
            resource_id=str(item.id),
            payload={"type": "ddl"},
            question="",
            sql="",
            status="success",
            outcome="success",
        )
        return {"id": item.id, "status": item.status}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/training/manual")
async def submit_manual(
    payload: ManualTrainingRequest,
    user: UserContext = Depends(require_permission("training:upload")),
):
    try:
        item = service.submit_training_item(
            item_type="sql",
            payload={"question": payload.question, "sql": payload.sql, "metadata": payload.metadata or {}},
            created_by=user.get("user_id"),
        )
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="training_submit",
            resource_id=str(item.id),
            payload={"type": "sql"},
            question=payload.question,
            sql=payload.sql,
            status="success",
            outcome="success",
        )
        return {"id": item.id, "status": item.status}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/training/pending")
async def list_pending(
    user: UserContext = Depends(require_permission("training:approve")),
):
    items = service.list_pending()
    return [
        {
            "id": i.id,
            "type": i.item_type,
            "status": i.status,
            "created_at": i.created_at,
            "created_by": i.created_by,
        }
        for i in items
    ]


@router.patch("/training/approve/{item_id}")
async def approve(
    item_id: int,
    user: UserContext = Depends(require_permission("training:approve")),
):
    try:
        item = service.approve(item_id, approver=user.get("user_id"))
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="training_approve",
            resource_id=str(item.id),
            payload={"type": item.item_type},
            status="success",
            outcome="success",
        )
        return {"id": item.id, "status": item.status}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.delete("/training/purge")
async def purge(
    user: UserContext = Depends(require_permission("training:purge")),
):
    service.purge_vector_store()
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="training_purge",
        resource_id=None,
        status="success",
        outcome="success",
    )
    return {"status": "purged"}
