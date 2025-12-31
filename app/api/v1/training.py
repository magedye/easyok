from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies import require_permission, UserContext
from app.services.training_service import TrainingService
from app.services.audit_service import AuditService
from app.core.db import session_scope
from app.models.internal import TrainingItem, TrainingStaging
from app.models.enums.training_status import TrainingStatus

router = APIRouter(tags=["training"])
service = TrainingService()
audit_service = AuditService()


class DDLRequest(BaseModel):
    ddl: str


class ManualTrainingRequest(BaseModel):
    question: str
    sql: str
    metadata: Dict[str, Any] | None = None


@router.post("/training/ddl", status_code=201)
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


@router.post("/training/manual", status_code=201)
async def submit_manual(
    payload: ManualTrainingRequest,
    user: UserContext = Depends(require_permission("training:upload")),
):
    try:
        normalized_sql = payload.sql
        item = service.submit_training_item(
            item_type="sql",
            payload={"question": payload.question, "sql": normalized_sql, "metadata": payload.metadata or {}},
            created_by=user.get("user_id"),
        )
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="training_submit",
            resource_id=str(item.id),
            payload={"type": "sql"},
            question=payload.question,
            sql=normalized_sql,
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


@router.patch("/training/reject/{item_id}")
async def reject(
    item_id: int,
    user: UserContext = Depends(require_permission("training:approve")),
):
    with session_scope() as session:
        item = session.get(TrainingItem, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Training item not found")
        item.status = TrainingStatus.rejected.value
        session.add(item)
        session.flush()
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="training_reject",
        resource_id=str(item_id),
        payload={"status": TrainingStatus.rejected.value},
        status="success",
        outcome="success",
    )
    return {"id": item_id, "status": TrainingStatus.rejected.value}


@router.get("/training/history")
async def training_history(
    user: UserContext = Depends(require_permission("training.read")),
):
    with session_scope() as session:
        items: List[TrainingItem] = (
            session.query(TrainingItem).order_by(TrainingItem.created_at.desc()).all()
        )
    out = []
    for i in items:
        out.append(
            {
                "id": i.id,
                "type": i.item_type,
                "status": i.status,
                "created_at": i.created_at,
                "approved_at": getattr(i, "approved_at", None),
                "approved_by": getattr(i, "approved_by", None),
            }
        )
    return {"items": out}


@router.post("/training/rollback")
async def training_rollback(
    user: UserContext = Depends(require_permission("training:rollback")),
):
    """
    Emergency rollback for vector corruption. Uses purge as a minimal reversible action.
    """
    service.purge_vector_store()
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="training_rollback",
        resource_id=None,
        payload={"restored_version": "not_available"},
        status="completed",
        outcome="success",
    )
    return {"status": "ok", "restored_version": "not_available"}


ASSUMPTION_MARKER = "__assumption__"


@router.get("/train/assumptions")
async def list_assumptions(
    user: UserContext = Depends(require_permission("assumptions.review")),
):
    with session_scope() as session:
        rows = (
            session.query(TrainingStaging)
            .filter(TrainingStaging.question == ASSUMPTION_MARKER)
            .order_by(TrainingStaging.created_at.desc())
            .all()
        )
    assumptions = [
        {
            "id": r.id,
            "text": r.assumptions,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in rows
    ]
    return {"assumptions": assumptions}


@router.post("/train/assumptions/approve")
async def approve_assumption(
    payload: Dict[str, Any],
    user: UserContext = Depends(require_permission("assumptions.approve")),
):
    assumption_id = payload.get("id") or payload.get("assumption_id")
    if not assumption_id:
        raise HTTPException(status_code=400, detail="assumption_id is required")
    with session_scope() as session:
        r = session.get(TrainingStaging, assumption_id)
        if not r or r.question != ASSUMPTION_MARKER:
            raise HTTPException(status_code=404, detail="Assumption not found")
        r.status = TrainingStatus.approved.value
        session.add(r)
        session.flush()
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="assumption_approved",
        resource_id=str(assumption_id),
        payload={"status": TrainingStatus.approved.value},
        status="success",
        outcome="success",
    )
    return {"status": TrainingStatus.approved.value, "assumption_id": assumption_id}


@router.post("/train/assumptions/reject")
async def reject_assumption(
    payload: Dict[str, Any],
    user: UserContext = Depends(require_permission("assumptions.approve")),
):
    assumption_id = payload.get("id") or payload.get("assumption_id")
    reason = (payload.get("reason") or "").strip()
    if not assumption_id:
        raise HTTPException(status_code=400, detail="assumption_id is required")
    if not reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required")
    with session_scope() as session:
        r = session.get(TrainingStaging, assumption_id)
        if not r or r.question != ASSUMPTION_MARKER:
            raise HTTPException(status_code=404, detail="Assumption not found")
        r.status = TrainingStatus.rejected.value
        r.rejection_reason = reason
        session.add(r)
        session.flush()
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="assumption_rejected",
        resource_id=str(assumption_id),
        payload={"reason": reason},
        status="success",
        outcome="success",
    )
    return {"status": TrainingStatus.rejected.value, "assumption_id": assumption_id, "reason": reason}
