from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Boolean, JSON, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.models.internal import Base


class ApiCatalog(Base):
    __tablename__ = "api_catalog"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    current_version_id = Column(String(64), ForeignKey("api_catalog_versions.id"), nullable=True)
    base_urls = Column(JSON, nullable=True)  # list[BaseUrlConfig]
    schemas = Column(JSON, nullable=True)  # Record<string, JsonSchema>
    tags = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)
    updated_by = Column(String(255), nullable=True)

    current_version = relationship("ApiCatalogVersion", foreign_keys=[current_version_id])


class ApiCatalogVersion(Base):
    __tablename__ = "api_catalog_versions"

    id = Column(String(64), primary_key=True)
    version_number = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(32), default="draft")  # draft | preview | published
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(255), nullable=True)
    base_urls = Column(JSON, nullable=True)
    endpoints = Column(JSON, nullable=True)  # list[ApiEndpoint]
    schemas = Column(JSON, nullable=True)  # Record<string, JsonSchema>
    connections = Column(JSON, nullable=True)  # legacy support list[ApiConnection]
    changes = Column(JSON, nullable=True)


class ApiEndpointModel(Base):
    __tablename__ = "api_catalog_endpoints"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    path = Column(String(512), nullable=False)
    method = Column(String(10), nullable=False)
    base_url_key = Column(String(255), nullable=True)
    tags = Column(JSON, nullable=True)
    auth_required = Column(Boolean, default=False)
    deprecated = Column(Boolean, default=False)
    request_schema = Column(JSON, nullable=True)
    response_schema = Column(JSON, nullable=True)
    error_schema = Column(JSON, nullable=True)
    examples = Column(JSON, nullable=True)
    rate_limit = Column(JSON, nullable=True)
    timeout = Column(Integer, nullable=True)
    version_id = Column(String(64), ForeignKey("api_catalog_versions.id"), nullable=True)


class ApiConnectionModel(Base):
    __tablename__ = "api_catalog_connections"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    base_url = Column(String(1024), nullable=False)
    auth_type = Column(String(32), default="none")
    auth_config = Column(JSON, nullable=True)
    headers = Column(JSON, nullable=True)
    tags = Column(JSON, nullable=True)
    is_default = Column(Boolean, default=False)
    test_endpoint = Column(String(512), nullable=True)
    health_check_interval = Column(Integer, nullable=True)
    env = Column(String(32), nullable=True)


class CatalogAuditLog(Base):
    __tablename__ = "api_catalog_audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False)
    action = Column(String(32), nullable=False)  # create/update/delete/publish/preview
    resource_type = Column(String(32), nullable=False)  # endpoint/connection/version
    resource_id = Column(String(64), nullable=False)
    version_id = Column(String(64), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String(32), default="success")
    details = Column(JSON, nullable=True)
