from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.core.db import session_scope
from app.models.internal import SchemaAccessPolicy
from app.services.audit_service import AuditService


class SchemaPolicyService:
    def __init__(self) -> None:
        self.audit_service = AuditService()

    def create_draft(
        self,
        *,
        db_connection_id: Optional[str],
        schema_name: str,
        allowed_tables: Optional[List[str]] = None,
        allowed_columns: Optional[Dict[str, List[str]]] = None,
        denied_tables: Optional[List[str]] = None,
        created_by: Optional[str] = None,
    ) -> SchemaAccessPolicy:
        policy = SchemaAccessPolicy(
            id=str(uuid.uuid4()),
            db_connection_id=db_connection_id,
            schema_name=schema_name.upper(),
            allowed_tables=allowed_tables or [],
            allowed_columns=allowed_columns or {},
            denied_tables=denied_tables or [],
            status="draft",
            created_by=created_by,
            created_at=datetime.utcnow(),
        )
        with session_scope() as session:
            session.add(policy)
            session.flush()
            session.refresh(policy)
            return policy

    def update_draft(
        self,
        policy_id: str,
        *,
        allowed_tables: Optional[List[str]] = None,
        allowed_columns: Optional[Dict[str, List[str]]] = None,
        denied_tables: Optional[List[str]] = None,
    ) -> SchemaAccessPolicy:
        with session_scope() as session:
            policy = session.get(SchemaAccessPolicy, policy_id)
            if not policy or policy.status != "draft":
                raise ValueError("Draft policy not found")
            if allowed_tables is not None:
                policy.allowed_tables = allowed_tables
            if allowed_columns is not None:
                policy.allowed_columns = allowed_columns
            if denied_tables is not None:
                policy.denied_tables = denied_tables
            session.add(policy)
            session.flush()
            session.refresh(policy)
            return policy

    def activate(self, policy_id: str, approver: Optional[str] = None) -> SchemaAccessPolicy:
        with session_scope() as session:
            policy = session.get(SchemaAccessPolicy, policy_id)
            if not policy or policy.status != "draft":
                raise ValueError("Policy not found or not in draft state")
            # revoke existing active policies for same schema/connection
            session.query(SchemaAccessPolicy).filter(
                SchemaAccessPolicy.status == "active",
                SchemaAccessPolicy.schema_name == policy.schema_name,
            ).update({"status": "revoked"})
            policy.status = "active"
            policy.approved_by = approver
            policy.approved_at = datetime.utcnow()
            session.add(policy)
            session.flush()
            session.refresh(policy)
            self.audit_service.log(
                user_id=approver or "anonymous",
                role="admin",
                action="Policy_Activation",
                resource_id=policy.id,
                payload={
                    "schema": policy.schema_name,
                    "allowed_tables": policy.allowed_tables,
                    "allowed_columns": policy.allowed_columns,
                    "denied_tables": policy.denied_tables,
                },
                status="completed",
                outcome="success",
            )
            return policy

    def get_active(self) -> Optional[SchemaAccessPolicy]:
        with session_scope() as session:
            return (
                session.query(SchemaAccessPolicy)
                .filter(SchemaAccessPolicy.status == "active")
                .order_by(SchemaAccessPolicy.created_at.desc())
                .first()
            )
