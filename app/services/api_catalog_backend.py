from __future__ import annotations

import uuid
from typing import List, Optional, Dict, Any

from app.core.db import session_scope
from app.models.catalog import (
    ApiCatalog,
    ApiCatalogVersion,
    ApiEndpointModel,
    ApiConnectionModel,
    CatalogAuditLog,
)


def _uuid() -> str:
    return str(uuid.uuid4())


class ApiCatalogBackendService:
    """Persistent API catalog store with simple versioning."""

    def __init__(self, user_id: str = "system") -> None:
        self.user_id = user_id

    # Catalog -----------------------------------------------------------------
    def get_or_create_catalog(self) -> ApiCatalog:
        with session_scope() as session:
            catalog = session.query(ApiCatalog).first()
            if catalog:
                return catalog

            version_id = _uuid()
            version = ApiCatalogVersion(
                id=version_id,
                version_number="v1",
                status="draft",
                created_by=self.user_id,
                base_urls=[],
                endpoints=[],
                schemas={},
                connections=[],
            )
            catalog = ApiCatalog(
                id=_uuid(),
                name="Default Catalog",
                description="Auto-created catalog",
                current_version_id=version_id,
                base_urls=[],
                schemas={},
                updated_by=self.user_id,
            )
            session.add(version)
            session.add(catalog)
            session.flush()
            session.refresh(catalog)
            return catalog

    def get_catalog(self) -> Dict[str, Any]:
        catalog = self.get_or_create_catalog()
        with session_scope() as session:
            version = None
            if catalog.current_version_id:
                version = session.get(ApiCatalogVersion, catalog.current_version_id)
            return {
                "id": catalog.id,
                "name": catalog.name,
                "description": catalog.description,
                "currentVersionId": catalog.current_version_id,
                "currentVersion": self._version_to_dict(version) if version else None,
                "versions": [],
                "baseUrls": catalog.base_urls or [],
                "schemas": catalog.schemas or {},
                "updatedAt": catalog.updated_at.isoformat(),
                "updatedBy": catalog.updated_by or "system",
                "tags": catalog.tags or [],
            }

    # Versions ----------------------------------------------------------------
    def list_versions(self, limit: int = 50) -> List[Dict[str, Any]]:
        with session_scope() as session:
            versions = (
                session.query(ApiCatalogVersion)
                .order_by(ApiCatalogVersion.created_at.desc())
                .limit(limit)
                .all()
            )
            return [self._version_to_dict(v) for v in versions]

    def get_version(self, version_id: str) -> Optional[Dict[str, Any]]:
        with session_scope() as session:
            version = session.get(ApiCatalogVersion, version_id)
            return self._version_to_dict(version) if version else None

    def publish_version(self, version_id: str) -> Dict[str, Any]:
        with session_scope() as session:
            version = session.get(ApiCatalogVersion, version_id)
            if not version:
                raise ValueError("Version not found")
            version.status = "published"
            session.add(version)
            catalog = session.query(ApiCatalog).first()
            if catalog:
                catalog.current_version_id = version_id
                session.add(catalog)
            session.add(
                CatalogAuditLog(
                    user_id=self.user_id,
                    action="publish",
                    resource_type="version",
                    resource_id=version_id,
                    version_id=version_id,
                    details={"status": "published"},
                )
            )
            session.flush()
            return self._version_to_dict(version)

    # Endpoints ---------------------------------------------------------------
    def create_endpoint(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        endpoint_id = _uuid()
        with session_scope() as session:
            endpoint = ApiEndpointModel(
                id=endpoint_id,
                name=payload.get("name", ""),
                description=payload.get("description"),
                path=payload["path"],
                method=payload["method"],
                base_url_key=payload.get("baseUrlKey"),
                tags=payload.get("tags"),
                auth_required=bool(payload.get("authRequired")),
                deprecated=bool(payload.get("deprecated")),
                request_schema=payload.get("requestSchema"),
                response_schema=payload.get("responseSchema"),
                error_schema=payload.get("errorSchema"),
                examples=payload.get("examples"),
                rate_limit=payload.get("rateLimit"),
                timeout=payload.get("timeout"),
                version_id=payload.get("versionId"),
            )
            session.add(endpoint)
            session.add(
                CatalogAuditLog(
                    user_id=self.user_id,
                    action="create",
                    resource_type="endpoint",
                    resource_id=endpoint_id,
                    version_id=payload.get("versionId"),
                    details={"name": endpoint.name},
                )
            )
            session.flush()
            return self._endpoint_to_dict(endpoint)

    def update_endpoint(self, endpoint_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        with session_scope() as session:
            endpoint = session.get(ApiEndpointModel, endpoint_id)
            if not endpoint:
                raise ValueError("Endpoint not found")
            for field in [
                "name",
                "description",
                "path",
                "method",
                "base_url_key",
                "tags",
                "auth_required",
                "deprecated",
                "request_schema",
                "response_schema",
                "error_schema",
                "examples",
                "rate_limit",
                "timeout",
                "version_id",
            ]:
                if field in payload:
                    setattr(endpoint, field, payload.get(field))
            session.add(endpoint)
            session.add(
                CatalogAuditLog(
                    user_id=self.user_id,
                    action="update",
                    resource_type="endpoint",
                    resource_id=endpoint_id,
                    version_id=endpoint.version_id,
                    details={"name": endpoint.name},
                )
            )
            session.flush()
            return self._endpoint_to_dict(endpoint)

    def delete_endpoint(self, endpoint_id: str) -> None:
        with session_scope() as session:
            endpoint = session.get(ApiEndpointModel, endpoint_id)
            if not endpoint:
                return
            session.delete(endpoint)
            session.add(
                CatalogAuditLog(
                    user_id=self.user_id,
                    action="delete",
                    resource_type="endpoint",
                    resource_id=endpoint_id,
                    version_id=endpoint.version_id,
                    details={"name": endpoint.name},
                )
            )

    def list_endpoints(self) -> List[Dict[str, Any]]:
        with session_scope() as session:
            endpoints = session.query(ApiEndpointModel).all()
            return [self._endpoint_to_dict(e) for e in endpoints]

    def get_endpoint(self, endpoint_id: str) -> Optional[Dict[str, Any]]:
        with session_scope() as session:
            endpoint = session.get(ApiEndpointModel, endpoint_id)
            return self._endpoint_to_dict(endpoint) if endpoint else None

    # Connections -------------------------------------------------------------
    def create_connection(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        connection_id = _uuid()
        with session_scope() as session:
            conn = ApiConnectionModel(
                id=connection_id,
                name=payload.get("name", ""),
                description=payload.get("description"),
                base_url=payload["baseUrl"],
                auth_type=payload.get("authType", "none"),
                auth_config=payload.get("authConfig"),
                headers=payload.get("headers"),
                tags=payload.get("tags"),
                is_default=bool(payload.get("isDefault")),
                test_endpoint=payload.get("testEndpoint"),
                health_check_interval=payload.get("healthCheckInterval"),
                env=payload.get("env"),
            )
            session.add(conn)
            session.add(
                CatalogAuditLog(
                    user_id=self.user_id,
                    action="create",
                    resource_type="connection",
                    resource_id=connection_id,
                    details={"name": conn.name},
                )
            )
            session.flush()
            return self._connection_to_dict(conn)

    def update_connection(self, connection_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        with session_scope() as session:
            conn = session.get(ApiConnectionModel, connection_id)
            if not conn:
                raise ValueError("Connection not found")
            for field in [
                "name",
                "description",
                "base_url",
                "auth_type",
                "auth_config",
                "headers",
                "tags",
                "is_default",
                "test_endpoint",
                "health_check_interval",
                "env",
            ]:
                if field in payload:
                    setattr(conn, field, payload.get(field))
            session.add(conn)
            session.add(
                CatalogAuditLog(
                    user_id=self.user_id,
                    action="update",
                    resource_type="connection",
                    resource_id=connection_id,
                    details={"name": conn.name},
                )
            )
            session.flush()
            return self._connection_to_dict(conn)

    def delete_connection(self, connection_id: str) -> None:
        with session_scope() as session:
            conn = session.get(ApiConnectionModel, connection_id)
            if not conn:
                return
            session.delete(conn)
            session.add(
                CatalogAuditLog(
                    user_id=self.user_id,
                    action="delete",
                    resource_type="connection",
                    resource_id=connection_id,
                    details={"name": conn.name},
                )
            )

    def list_connections(self) -> List[Dict[str, Any]]:
        with session_scope() as session:
            conns = session.query(ApiConnectionModel).all()
            return [self._connection_to_dict(c) for c in conns]

    def get_connection(self, connection_id: str) -> Optional[Dict[str, Any]]:
        with session_scope() as session:
            conn = session.get(ApiConnectionModel, connection_id)
            return self._connection_to_dict(conn) if conn else None

    # Validation --------------------------------------------------------------
    def validate(self) -> Dict[str, Any]:
        # Minimal stub: ensure catalog exists
        self.get_or_create_catalog()
        return {"valid": True, "errors": []}

    # Helpers -----------------------------------------------------------------
    def _version_to_dict(self, version: Optional[ApiCatalogVersion]) -> Optional[Dict[str, Any]]:
        if not version:
            return None
        return {
          "id": version.id,
          "versionNumber": version.version_number,
          "createdAt": version.created_at.isoformat(),
          "createdBy": version.created_by or "system",
          "description": version.description,
          "status": version.status,
          "baseUrls": version.base_urls or [],
          "endpoints": version.endpoints or [],
          "schemas": version.schemas or {},
          "connections": version.connections or [],
          "changes": version.changes or [],
        }

    def _endpoint_to_dict(self, endpoint: ApiEndpointModel) -> Dict[str, Any]:
        return {
            "id": endpoint.id,
            "name": endpoint.name,
            "description": endpoint.description,
            "path": endpoint.path,
            "method": endpoint.method,
            "baseUrlKey": endpoint.base_url_key,
            "tags": endpoint.tags or [],
            "authRequired": endpoint.auth_required,
            "deprecated": endpoint.deprecated,
            "requestSchema": endpoint.request_schema,
            "responseSchema": endpoint.response_schema,
            "errorSchema": endpoint.error_schema,
            "examples": endpoint.examples or {},
            "rateLimit": endpoint.rate_limit,
            "timeout": endpoint.timeout,
            "versionId": endpoint.version_id,
        }

    def _connection_to_dict(self, conn: ApiConnectionModel) -> Dict[str, Any]:
        return {
            "id": conn.id,
            "name": conn.name,
            "description": conn.description,
            "baseUrl": conn.base_url,
            "authType": conn.auth_type,
            "authConfig": conn.auth_config or {},
            "headers": conn.headers or {},
            "tags": conn.tags or [],
            "isDefault": conn.is_default,
            "testEndpoint": conn.test_endpoint,
            "healthCheckInterval": conn.health_check_interval,
            "env": conn.env,
        }
