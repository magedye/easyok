from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from typing import Iterator

from app.models.api import (
    AskRequest,
    TrainingItemRequest,
    QueryAssetCreate,
    ScheduleCreate,
    FeatureToggle,
    SandboxPromotion,
)

# --------------------------------
# Routers
# --------------------------------

ask_router = APIRouter(prefix="", tags=["Ask"])
training_router = APIRouter(prefix="/train/v1", tags=["Training"])
assets_router = APIRouter(prefix="/platform/v1/assets", tags=["Assets"])
schedule_router = APIRouter(prefix="/platform/v1", tags=["Scheduling"])
admin_router = APIRouter(prefix="/admin/v1", tags=["Admin"])
sandbox_router = APIRouter(prefix="/admin/sandbox", tags=["Sandbox"])


# --------------------------------
# Ask (NDJSON)
# --------------------------------

@ask_router.post(
    "/ask",
    status_code=status.HTTP_200_OK,
    response_class=StreamingResponse,
)
def ask_endpoint(payload: AskRequest):
    def ndjson_stream() -> Iterator[str]:
        # Placeholder only – real logic injected via Orchestrator
        yield '{"type":"error","error_code":"NOT_IMPLEMENTED","message":"Orchestrator not wired"}\n'

    return StreamingResponse(
        ndjson_stream(),
        media_type="application/x-ndjson",
    )


# --------------------------------
# Training
# --------------------------------

@training_router.post("/schema", status_code=status.HTTP_201_CREATED)
def train_schema(item: TrainingItemRequest):
    return {"status": "created"}


@training_router.post("/ddl", status_code=status.HTTP_201_CREATED)
def train_ddl(item: TrainingItemRequest):
    return {"status": "created"}


@training_router.post("/documentation", status_code=status.HTTP_201_CREATED)
def train_docs(item: TrainingItemRequest):
    return {"status": "created"}


@training_router.post("/sql", status_code=status.HTTP_201_CREATED)
def train_sql(item: TrainingItemRequest):
    return {"status": "created"}


@training_router.post("/csv", status_code=status.HTTP_201_CREATED)
def train_csv(item: TrainingItemRequest):
    return {"status": "created"}


@training_router.get("/assumptions")
def list_assumptions():
    return []


@training_router.post("/assumptions/{assumption_id}/approve")
def approve_assumption(assumption_id: str):
    return {"status": "approved"}


@training_router.post("/assumptions/{assumption_id}/reject")
def reject_assumption(assumption_id: str):
    return {"status": "rejected"}


# --------------------------------
# Assets
# --------------------------------

@assets_router.post("/queries", status_code=status.HTTP_201_CREATED)
def create_query_asset(payload: QueryAssetCreate):
    return {"status": "created"}


@assets_router.get("/queries")
def list_query_assets():
    return []


@assets_router.post("/queries/{asset_id}/share")
def share_query_asset(asset_id: str):
    return {"status": "shared"}


@assets_router.delete("/queries/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_query_asset(asset_id: str):
    return None


# --------------------------------
# Scheduling
# --------------------------------

@schedule_router.post("/schedules", status_code=status.HTTP_201_CREATED)
def create_schedule(payload: ScheduleCreate):
    return {"status": "created"}


# --------------------------------
# Admin
# --------------------------------

@admin_router.get("/audit/logs")
def get_audit_logs():
    return []


@admin_router.get("/schema/drift")
def get_schema_drifts():
    return []


@admin_router.post("/toggles")
def toggle_feature(payload: FeatureToggle):
    return {"status": "updated"}


# --------------------------------
# Sandbox
# --------------------------------

@sandbox_router.post("/promote")
def promote_sandbox_item(payload: SandboxPromotion):
    return {"status": "promoted"}
