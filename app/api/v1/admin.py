from fastapi import APIRouter, Depends
from app.api.dependencies import require_permission, UserContext
from app.services.audit_service import AuditService

router = APIRouter(tags=["admin"]) 
audit_service = AuditService()


@router.post("/training/approve")
async def approve_training(
    training_id: str,
    user: UserContext = Depends(require_permission("training:approve")),
):
    """
    Approve training data.
    
    Requires 'training:approve' permission.
    If RBAC_ENABLED=false, all authenticated users can access.
    If AUTH_ENABLED=false, anonymous users can access.
    
    Args:
        training_id: Training data ID
        user: Authenticated user (with permission check)
    
    Returns:
        Success confirmation
    """
    audit_service.log(
        user_id=user.get("user_id", "anonymous"),
        role=user.get("role", "guest"),
        action="training_approve",
        resource_id=training_id,
        status="success",
        outcome="success",
    )
    return {
        "status": "approved",
        "training_id": training_id,
        "approved_by": user["user_id"],
    }


@router.get("/dashboard")
async def get_dashboard(
    user: UserContext = Depends(require_permission("admin:view")),
):
    """
    Get admin dashboard.
    
    Requires 'admin:view' permission.
    """
    return {
        "user": user["user_id"],
        "role": user["role"],
        "permissions": user["permissions"],
    }
