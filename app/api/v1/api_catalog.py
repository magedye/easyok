from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import require_permission, UserContext
from app.services.api_catalog_backend import ApiCatalogBackendService

router = APIRouter(prefix="/admin/api-catalog", tags=["api-catalog"])


def service(user: UserContext) -> ApiCatalogBackendService:
    return ApiCatalogBackendService(user_id=user.get("user_id", "system"))


@router.get("")
async def get_catalog(user: UserContext = Depends(require_permission("admin:view"))):
    return service(user).get_catalog()


@router.get("/versions")
async def get_versions(
    limit: int = Query(50, le=200),
    user: UserContext = Depends(require_permission("admin:view")),
):
    return {"versions": service(user).list_versions(limit=limit)}


@router.get("/versions/{version_id}")
async def get_version(
    version_id: str, user: UserContext = Depends(require_permission("admin:view"))
):
    version = service(user).get_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.post("/versions/{version_id}/publish")
async def publish_version(
    version_id: str, user: UserContext = Depends(require_permission("admin:view"))
):
    return service(user).publish_version(version_id)


@router.get("/versions/{version_id}/preview")
async def preview_version(
    version_id: str, user: UserContext = Depends(require_permission("admin:view"))
):
    version = service(user).get_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.post("/validate")
async def validate_catalog(user: UserContext = Depends(require_permission("admin:view"))):
    return service(user).validate()


@router.post("/endpoints")
async def create_endpoint(
    payload: dict,
    user: UserContext = Depends(require_permission("admin:view")),
):
    return service(user).create_endpoint(payload)


@router.put("/endpoints/{endpoint_id}")
async def update_endpoint(
    endpoint_id: str,
    payload: dict,
    user: UserContext = Depends(require_permission("admin:view")),
):
    return service(user).update_endpoint(endpoint_id, payload)


@router.delete("/endpoints/{endpoint_id}")
async def delete_endpoint(
    endpoint_id: str, user: UserContext = Depends(require_permission("admin:view"))
):
    service(user).delete_endpoint(endpoint_id)
    return {"status": "deleted"}


@router.get("/endpoints")
async def list_endpoints(user: UserContext = Depends(require_permission("admin:view"))):
    return {"endpoints": service(user).list_endpoints()}


@router.get("/endpoints/{endpoint_id}")
async def get_endpoint(
    endpoint_id: str, user: UserContext = Depends(require_permission("admin:view"))
):
    ep = service(user).get_endpoint(endpoint_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return ep


@router.post("/connections")
async def create_connection(
    payload: dict,
    user: UserContext = Depends(require_permission("admin:view")),
):
    return service(user).create_connection(payload)


@router.put("/connections/{connection_id}")
async def update_connection(
    connection_id: str,
    payload: dict,
    user: UserContext = Depends(require_permission("admin:view")),
):
    return service(user).update_connection(connection_id, payload)


@router.delete("/connections/{connection_id}")
async def delete_connection(
    connection_id: str, user: UserContext = Depends(require_permission("admin:view"))
):
    service(user).delete_connection(connection_id)
    return {"status": "deleted"}


@router.get("/connections")
async def list_connections(user: UserContext = Depends(require_permission("admin:view"))):
    return {"connections": service(user).list_connections()}


@router.get("/connections/{connection_id}")
async def get_connection(
    connection_id: str, user: UserContext = Depends(require_permission("admin:view"))
):
    conn = service(user).get_connection(connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn


@router.post("/connections/{connection_id}/test")
async def test_connection(
    connection_id: str, user: UserContext = Depends(require_permission("admin:view"))
):
    # Basic stub: simply confirm resource exists
    conn = service(user).get_connection(connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"status": "ok", "connectionId": connection_id}
