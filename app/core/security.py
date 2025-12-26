"""
Security utilities and definitions.

This module defines role and permission enumerations, a mapping between
roles and permissions, and provides simple helper functions for JWT
handling.  Encryption keys should be set via environment variables or
other secure mechanisms; default values here are placeholders only.
"""

from enum import Enum
from datetime import datetime, timedelta
from typing import List
import jwt

from app.core.config import settings


class Role(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"
    GUEST = "guest"


class Permission(str, Enum):
    QUERY_EXECUTE = "query:execute"
    TRAINING_UPLOAD = "training:upload"
    TRAINING_APPROVE = "training:approve"
    TRAINING_DELETE = "training:delete"
    ADMIN_PANEL = "admin:panel"
    AUDIT_VIEW = "audit:view"


ROLE_PERMISSIONS: dict[Role, List[Permission]] = {
    Role.ADMIN: [
        Permission.QUERY_EXECUTE,
        Permission.TRAINING_UPLOAD,
        Permission.TRAINING_APPROVE,
        Permission.TRAINING_DELETE,
        Permission.ADMIN_PANEL,
        Permission.AUDIT_VIEW,
    ],
    Role.MANAGER: [
        Permission.QUERY_EXECUTE,
        Permission.TRAINING_UPLOAD,
        Permission.TRAINING_APPROVE,
        Permission.AUDIT_VIEW,
    ],
    Role.USER: [
        Permission.QUERY_EXECUTE,
        Permission.TRAINING_UPLOAD,
    ],
    Role.GUEST: [
        Permission.QUERY_EXECUTE,
    ],
}


# JWT secrets (for demonstration only; override via environment)
JWT_SECRET_KEY: str = "supersecret"
JWT_ALGORITHM: str = "HS256"
JWT_EXPIRATION_MINUTES: int = 60


def create_access_token(data: dict, expires_delta: int | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_delta or JWT_EXPIRATION_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise ValueError("Invalid token")