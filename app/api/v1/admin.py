"""
Administrative endpoints for training and audit management.

Only users with appropriate permissions (manager or admin) can access
these endpoints.  Implementation is intentionally minimal.
"""

from fastapi import APIRouter, Depends, HTTPException

from app.models.request import TrainingItem
from app.api.dependencies import require_permission
from app.core.security import Permission
from app.services.training_service import TrainingService  # type: ignore


router = APIRouter()


@router.post("/training", dependencies=[Depends(require_permission(Permission.TRAINING_UPLOAD))])
async def upload_training(item: TrainingItem):
    service = TrainingService()
    service.add_training_item(item.question, item.sql, item.metadata or {})
    return {"status": "ok", "message": "Training item received"}