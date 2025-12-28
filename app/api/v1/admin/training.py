from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from opentelemetry import trace

from app.api.dependencies import require_permission, UserContext
from app.models.enums.training_status import TrainingStatus
from app.services.audit_service import AuditService
from app.services.training_item_service import TrainingItemService


router = APIRouter(prefix="/admin/training", tags=["admin-training"])
service = TrainingItemService()
audit_service = AuditService()
tracer = trace.get_tracer(__name__)


@router.get("/pending")
async def list_pending(user: UserContext = Depends(require_permission("training:approve"))):
    items = service.list_pending()
    return [
        {
            "id": i.id,
            "question": i.question,
            "sql": i.sql,
            "assumptions": i.assumptions,
            "schema_version": i.schema_version,
            "policy_version": i.policy_version,
            "created_at": i.created_at,
            "created_by": i.created_by,
            "status": i.status,
        }
        for i in items
    ]


@router.patch("/approve/{staging_id}")
async def approve_item(
    staging_id: int,
    user: UserContext = Depends(require_permission("training:approve")),
):
    try:
        item = service.approve(staging_id=staging_id, admin_id=user.get("user_id"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    with tracer.start_as_current_span(
        "training_item.approved",
        attributes={
            "training.status": TrainingStatus.approved.value,
            "schema.version": item.schema_version,
            "policy.version": item.policy_version,
        },
    ):
        audit_service.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="training_item.approved",
            resource_id=str(item.id),
            status="success",
            outcome="success",
            payload={
                "schema_version": item.schema_version,
                "policy_version": item.policy_version,
                "staging_id": staging_id,
            },
        )

    return {"training_item_id": item.id, "status": TrainingStatus.approved.value}


@router.patch("/reject/{staging_id}")
async def reject_item(
    staging_id: int,
    payload: dict,
    user: UserContext = Depends(require_permission("training:approve")),
):
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required")
    try:
        service.reject(staging_id=staging_id, admin_id=user.get("user_id"), reason=reason)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="training_item.rejected",
        resource_id=str(staging_id),
        status="success",
        outcome="success",
        payload={"reason": reason},
    )

    return {"status": TrainingStatus.rejected.value, "staging_id": staging_id}
