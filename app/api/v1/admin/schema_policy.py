from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import require_permission, UserContext
from app.core.exceptions import AppException
from app.models.schema_policy import SchemaAccessPolicyCreate

router = APIRouter(prefix="/schema-policy", tags=["admin"])

@router.post(
    "",
    dependencies=[Depends(require_permission("admin:write"))],
)
def create_schema_policy(
    payload: SchemaAccessPolicyCreate,
    user: UserContext = Depends(require_permission("admin:write")),
):
    raise HTTPException(status_code=503, detail="Schema policy management disabled at API adapter")
