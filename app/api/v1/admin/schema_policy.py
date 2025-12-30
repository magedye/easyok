from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import require_permission, UserContext
from app.core.exceptions import AppException
from app.models.schema_policy import SchemaAccessPolicyCreate

from app.services.schema_policy_service import SchemaPolicyService

router = APIRouter(prefix="/schema-policy", tags=["admin"])

@router.post(
    "",
    dependencies=[Depends(require_permission("admin:write"))],
)
def create_schema_policy(
    payload: SchemaAccessPolicyCreate,
    user: UserContext = Depends(require_permission("admin:write")),
):
    schema_name = payload.schema_name or (payload.allowed_schemas[0] if payload.allowed_schemas else None)
    if not schema_name:
        raise HTTPException(status_code=400, detail="schema_name is required")

    service = SchemaPolicyService()
    try:
        if payload.active:
            policy = service.commit_policy(
                db_connection_id=None,
                schema_name=schema_name,
                allowed_tables=payload.allowed_tables,
                allowed_columns=payload.allowed_columns,
                excluded_tables=payload.excluded_tables,
                excluded_columns=payload.excluded_columns,
                created_by=user.get("user_id"),
            )
        else:
            policy = service.create_draft(
                db_connection_id=None,
                schema_name=schema_name,
                allowed_tables=payload.allowed_tables,
                allowed_columns=payload.allowed_columns,
                excluded_tables=payload.excluded_tables,
                excluded_columns=payload.excluded_columns,
                created_by=user.get("user_id"),
            )
        return {
            "id": policy.id,
            "status": policy.status,
            "schema_name": policy.schema_name,
            "version": policy.version,
        }
    except AppException as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
