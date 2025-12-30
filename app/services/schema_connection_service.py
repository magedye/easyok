"""
Schema Connection Registry (in-memory, auditable).

Stores connection metadata for the Schema Scope Wizard. Secrets are never
returned. Validation enforces Oracle-style connection strings and raises
InvalidConnectionStringError on malformed input. This is intentionally simple
and side-effect free (no live DB connections).
"""

from __future__ import annotations

import uuid
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from app.core.exceptions import InvalidConnectionStringError
from app.services.audit_service import AuditService


_CONNECTIONS: Dict[str, "SchemaConnection"] = {}


def _mask_conn(conn_str: str) -> str:
    """Mask password in user/password@host:port/service or :sid formats."""
    try:
        pattern = re.compile(
            r"(?:(?:[a-zA-Z0-9_+\-]+)://)?"  # optional scheme
            r"(?P<user>[^:@/]+):(?P<pw>[^@]+)@"
            r"(?:/{2})?"
            r"(?P<host>[^:/]+):(?P<port>\d+)"
            r"(?P<sep>[:/])"
            r"(?P<name>[^/?]+)"
        )
        m = pattern.match(conn_str)
        if not m:
            return "***"
        user = m.group("user")
        host = m.group("host")
        port = m.group("port")
        sep = m.group("sep")
        name = m.group("name")
        return f"{user}/***@{host}:{port}{sep}{name}"
    except Exception:
        return "***"


def _validate_conn_str(conn_str: str) -> None:
    pattern = re.compile(
        r"(?:(?:[a-zA-Z0-9_+\-]+)://)?"  # optional scheme
        r"(?P<user>[^:@/]+):(?P<pw>[^@]+)@"
        r"(?:/{2})?"
        r"(?P<host>[^:/]+):(?P<port>\d+)"
        r"(?P<sep>[:/])"
        r"(?P<name>[^/?]+)"
        r"$"
    )
    if not pattern.match(conn_str.strip()):
        raise InvalidConnectionStringError()


@dataclass
class SchemaConnection:
    id: str
    name: str
    connection_string: str = field(repr=False)
    description: str | None = None
    created_by: str | None = None
    created_role: str | None = None
    tags: list[str] | None = None

    def safe_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "connectionStringMasked": _mask_conn(self.connection_string),
            "tags": self.tags or [],
        }


class SchemaConnectionService:
    def __init__(self) -> None:
        self.audit = AuditService()

    def create(self, *, name: str, connection_string: str, description: str | None, tags: list[str] | None, user: dict) -> dict:
        _validate_conn_str(connection_string)
        conn_id = uuid.uuid4().hex
        conn = SchemaConnection(
            id=conn_id,
            name=name.strip(),
            description=(description or "").strip() or None,
            connection_string=connection_string.strip(),
            created_by=user.get("user_id"),
            created_role=user.get("role"),
            tags=tags or [],
        )
        _CONNECTIONS[conn_id] = conn
        self.audit.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="schema_connection_created",
            resource_id=conn_id,
            payload={"name": conn.name},
            outcome="success",
        )
        return conn.safe_dict()

    def list(self) -> List[dict]:
        return [c.safe_dict() for c in _CONNECTIONS.values()]

    def get(self, conn_id: str) -> Optional[dict]:
        conn = _CONNECTIONS.get(conn_id)
        return conn.safe_dict() if conn else None

    def delete(self, conn_id: str, user: dict) -> None:
        if conn_id in _CONNECTIONS:
            _CONNECTIONS.pop(conn_id)
            self.audit.log(
                user_id=user.get("user_id", "anonymous"),
                role=user.get("role", "guest"),
                action="schema_connection_deleted",
                resource_id=conn_id,
                outcome="success",
            )

    def test(self, conn_id: str, user: dict) -> dict:
        conn = _CONNECTIONS.get(conn_id)
        if not conn:
            return {"status": "not_found"}
        try:
            _validate_conn_str(conn.connection_string)
            status = "ok"
        except InvalidConnectionStringError as exc:
            status = "invalid"
            self.audit.log(
                user_id=user.get("user_id", "anonymous"),
                role=user.get("role", "guest"),
                action="schema_connection_test_failed",
                resource_id=conn_id,
                payload={"error": str(exc)},
                status="failed",
                outcome="failed",
            )
            raise

        self.audit.log(
            user_id=user.get("user_id", "anonymous"),
            role=user.get("role", "guest"),
            action="schema_connection_tested",
            resource_id=conn_id,
            payload={"status": status},
            outcome="success",
        )
        return {"status": status, "connectionId": conn_id}
