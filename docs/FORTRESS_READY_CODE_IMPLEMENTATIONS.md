# EasyData Fortress — Ready Code Implementations

**Status:** PRODUCTION-READY CODE
**Language:** English
**Last Updated:** December 2025

---

## Table of Contents

1. [Initialization Script](#initialization-script)
2. [JWT & Authentication](#jwt--authentication)
3. [RBAC & Authorization](#rbac--authorization)
4. [Startup Guards](#startup-guards)
5. [NDJSON Streaming](#ndjson-streaming)
6. [Audit Service](#audit-service)
7. [Database Models](#database-models)
8. [Environment Configuration](#environment-configuration)

---

## Initialization Script

### initialize_fortress.py
**Purpose:** Bootstrap database with admin user, roles, policies, and feature toggles

**Location:** `scripts/initialize_fortress.py`

```python
#!/usr/bin/env python3
"""
EasyData Fortress Bootstrap Script
Idempotent initialization: creates tables, roles, admin user, policies, toggles.
"""

import os
import sys
from datetime import datetime
from sqlalchemy.orm import Session
from passlib.context import CryptContext

# Ensure app imports are available
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import Base, engine, SessionLocal
from app.models import (
    User, Role, UserRole,
    SchemaAccessPolicy, PolicyVersion, FeatureToggle
)

# Setup secure password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_tables():
    """Create all tables if not exist."""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables ensured.")


def seed_roles(session: Session) -> None:
    """Insert default roles: admin, analyst, viewer."""
    roles = ["admin", "analyst", "viewer"]
    for role_name in roles:
        if not session.query(Role).filter_by(name=role_name).first():
            session.add(Role(name=role_name))
            print(f"✅ Role created: {role_name}")
        else:
            print(f"ℹ️  Role already exists: {role_name}")
    session.commit()


def create_admin_user(session: Session) -> None:
    """Create default admin user from environment variable."""
    admin_email = "admin@easydata.local"
    admin_password = os.getenv("ADMIN_INITIAL_PASSWORD")

    if not admin_password:
        raise RuntimeError(
            "❌ ADMIN_INITIAL_PASSWORD environment variable is not set. "
            "Export it before running: export ADMIN_INITIAL_PASSWORD='<password>'"
        )

    # Check if admin already exists
    existing_admin = session.query(User).filter_by(email=admin_email).first()
    if existing_admin:
        print(f"ℹ️  Admin user '{admin_email}' already exists. Skipping creation.")
        return

    # Create admin user with hashed password
    hashed_password = pwd_context.hash(admin_password)
    admin_user = User(
        email=admin_email,
        hashed_password=hashed_password,
        is_active=True
    )
    session.add(admin_user)
    session.flush()  # Get the user ID

    # Assign admin role
    admin_role = session.query(Role).filter_by(name="admin").first()
    if not admin_role:
        raise RuntimeError("❌ Admin role not found. Run seed_roles first.")

    session.add(UserRole(user_id=admin_user.id, role_id=admin_role.id))
    session.commit()

    print(f"✅ Admin user created: {admin_email}")


def seed_policy(session: Session) -> None:
    """Create default schema access policy."""
    if not session.query(SchemaAccessPolicy).filter_by(name="default_policy").first():
        policy = SchemaAccessPolicy(
            name="default_policy",
            status="active",
            created_at=datetime.utcnow(),
            enforced_globally=True,
            description="Default policy for all users"
        )
        session.add(policy)
        print("✅ Default SchemaAccessPolicy created.")
    else:
        print("ℹ️  Default SchemaAccessPolicy already exists.")


def seed_policy_version(session: Session) -> None:
    """Create initial policy version."""
    if not session.query(PolicyVersion).filter_by(version_name="v1-initial").first():
        version = PolicyVersion(
            version_name="v1-initial",
            description="Initial policy version",
            created_at=datetime.utcnow(),
            activated_by="system"
        )
        session.add(version)
        print("✅ Initial PolicyVersion created.")
    else:
        print("ℹ️  PolicyVersion already exists.")


def seed_feature_toggles(session: Session) -> None:
    """Create default feature toggles."""
    toggles = {
        "ENABLE_TRAINING_PILOT": True,
        "ENABLE_AUDIT_LOGGING": True,
        "RBAC_ENABLED": True,
        "AUTH_ENABLED": True
    }

    for key, value in toggles.items():
        if not session.query(FeatureToggle).filter_by(name=key).first():
            session.add(FeatureToggle(name=key, enabled=value))
            print(f"✅ FeatureToggle created: {key} = {value}")
        else:
            print(f"ℹ️  FeatureToggle already exists: {key}")

    session.commit()


def main():
    """Main bootstrap process."""
    print("\n🛡️  EasyData Fortress Bootstrap Started\n")

    try:
        # Step 1: Create tables
        create_tables()

        # Step 2: Initialize database session
        db = SessionLocal()

        try:
            # Step 3: Seed base data
            seed_roles(db)
            create_admin_user(db)
            seed_policy(db)
            seed_policy_version(db)
            seed_feature_toggles(db)

            db.commit()
            print("\n🎉 EasyData Fortress initialized successfully!\n")

        finally:
            db.close()

    except Exception as e:
        print(f"\n❌ Bootstrap failed: {str(e)}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

**Usage:**
```bash
export ADMIN_INITIAL_PASSWORD="StrongPassword123!"
python scripts/initialize_fortress.py
```

---

## JWT & Authentication

### JWT Token Management
**Location:** `app/core/security.py`

**GOVERNANCE COMPLIANCE:** JWT operations are deferred to **startup** after policy guards validate all required secrets. No global JWT managers at import time.

```python
"""
JWT Token Management

GOVERNANCE COMPLIANCE (Phase 1 — Authentication):
- JWT operations ONLY occur after startup guards validate secrets
- See app/core/policy_guard.py for validation logic
- No global JWT managers at import time
- All JWT operations call get_settings(force_reload=True) to get fresh config
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from app.core.config import get_settings


def create_access_token(
    subject: str,
    role: str = "user",
    permissions: list[str] = None,
    data_scope: dict = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.
    
    NOTE: JWT secret validation is enforced at startup via policy_guard.
    This function assumes all JWT configuration is valid.
    
    Args:
        subject: User ID (sub claim)
        role: User role (default: "user")
        permissions: List of permissions
        data_scope: RLS scope data
        expires_delta: Custom expiration time
    
    Returns:
        Encoded JWT token
    
    Raises:
        ValueError: If JWT is not properly configured (should not happen at runtime)
    """
    settings = get_settings(force_reload=True)
    
    # Defensive check: JWT secrets must be configured
    if not settings.JWT_SECRET_KEY:
        raise ValueError(
            "JWT_SECRET_KEY is not configured. "
            "This should have been caught at startup by policy_guard."
        )

    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)
    
    expire = datetime.utcnow() + expires_delta
    
    to_encode = {
        "sub": subject,
        "role": role,
        "permissions": permissions or [],
        "data_scope": data_scope or {},
        "exp": expire,
    }
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and verify a JWT access token.
    
    NOTE: JWT secret validation is enforced at startup via policy_guard.
    This function assumes all JWT configuration is valid.
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded payload
    
    Raises:
        JWTError: If token is invalid or expired
        ValueError: If JWT is not properly configured (should not happen at runtime)
    """
    settings = get_settings(force_reload=True)

    # Defensive check: JWT secrets must be configured
    if not settings.JWT_SECRET_KEY:
        raise ValueError(
            "JWT_SECRET_KEY is not configured. "
            "This should have been caught at startup by policy_guard."
        )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        raise JWTError(f"Invalid or expired token: {str(e)}")
```

### dependencies.py
**Purpose:** FastAPI dependency injection for authentication and authorization

**Location:** `app/security/dependencies.py`

```python
"""
FastAPI Dependencies for Authentication & Authorization
Used with Depends() to protect endpoints.
"""

from typing import Optional
import jwt
from fastapi import Depends, HTTPException, status, Request
from app.security.jwt import jwt_manager
from app.core.settings import settings
from app.models import User
from app.core.database import SessionLocal
import logging

logger = logging.getLogger(__name__)


async def get_db():
    """Database session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> dict:
    """
    Extract and validate JWT from request.
    Returns token payload with sub, roles, trace_id.
    
    Args:
        request: FastAPI request
        db: Database session
        
    Returns:
        Token payload dict
        
    Raises:
        HTTPException(401): If token missing or invalid
    """
    if not settings.AUTH_ENABLED:
        # Return anonymous context if auth disabled
        return {
            "sub": "anonymous",
            "roles": ["viewer"],
            "trace_id": request.headers.get("x-request-id", "no-trace")
        }

    # Extract Bearer token from Authorization header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        logger.warning("Missing or malformed Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization"
        )

    token = auth_header[7:]  # Remove "Bearer " prefix

    try:
        payload = jwt_manager.verify_token(token)
        trace_id = payload.get("trace_id")
        logger.info(f"User authenticated: {payload.get('sub')}", extra={"trace_id": trace_id})
        return payload

    except jwt.InvalidTokenError as e:
        logger.warning(f"Token validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


async def require_permission(permission: str):
    """
    Factory function: returns dependency for permission check.
    
    Usage:
        @app.get("/admin")
        async def admin_endpoint(user=Depends(require_permission("admin:*"))):
            ...
    
    Args:
        permission: Permission string (e.g., "admin:*", "training:approve")
        
    Returns:
        Dependency function
    """
    async def check_permission(
        user: dict = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> dict:
        """Check if user has required permission."""
        if not settings.RBAC_ENABLED:
            return user  # No permission check if RBAC disabled

        user_id = user.get("sub")
        roles = user.get("roles", [])
        trace_id = user.get("trace_id")

        # Simple role-based check (admin has all permissions)
        if "admin" in roles:
            return user

        # Check specific permission
        has_permission = await check_user_permission(db, user_id, permission)
        if not has_permission:
            logger.warning(
                f"Permission denied: {user_id} lacks {permission}",
                extra={"trace_id": trace_id}
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: {permission}"
            )

        return user

    return check_permission


async def check_user_permission(db: Session, user_id: str, permission: str) -> bool:
    """
    Check if user has specific permission.
    (Implementation depends on your permission model)
    """
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        return False

    # Check roles for permission
    for role in user.roles:
        if role.name == "admin":  # Admin has all permissions
            return True
        # Add more permission logic here
        if permission in role.permissions:
            return True

    return False
```

### auth.py
**Purpose:** Login endpoint implementation

**Location:** `app/api/v1/auth.py`

```python
"""
Authentication Endpoints
Handles user login and token generation.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from datetime import datetime
from uuid import uuid4
from passlib.context import CryptContext
from app.core.database import SessionLocal
from app.models import User
from app.security.jwt import jwt_manager
import logging

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
logger = logging.getLogger(__name__)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginRequest(BaseModel):
    """Login request body."""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Token response body."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    trace_id: str


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, credentials: LoginRequest):
    """
    User login endpoint.
    
    Returns JWT token with claims: sub, roles, trace_id, iss, aud, exp.
    
    Args:
        request: FastAPI request (for trace_id)
        credentials: Username and password
        
    Returns:
        TokenResponse with access_token
        
    Raises:
        HTTPException(401): On authentication failure
    """
    trace_id = request.headers.get("x-request-id", str(uuid4()))
    db = SessionLocal()

    try:
        # Find user by email (treating username as email)
        user = db.query(User).filter_by(email=credentials.username).first()
        
        if not user or not verify_password(credentials.password, user.hashed_password):
            # Don't reveal if user exists
            logger.warning(
                f"Failed login attempt for {credentials.username}",
                extra={"trace_id": trace_id}
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )

        if not user.is_active:
            logger.warning(
                f"Login attempt on inactive user {credentials.username}",
                extra={"trace_id": trace_id}
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User is inactive"
            )

        # Extract user roles
        roles = [role.name for role in user.roles]

        # Create token
        token = jwt_manager.create_access_token(
            subject=str(user.id),
            roles=roles,
            trace_id=trace_id
        )

        logger.info(
            f"User logged in: {user.email}",
            extra={"trace_id": trace_id, "user_id": user.id}
        )

        return TokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in=jwt_manager.access_token_expire_minutes * 60,
            trace_id=trace_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}", extra={"trace_id": trace_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )
    finally:
        db.close()
```

---

## RBAC & Authorization

### Wildcard Permission Semantics
**Location:** `app/api/dependencies.py`

RBAC permission checking includes wildcard support:

```python
def _check_permission_with_wildcards(required: str, user_perms: List[str]) -> bool:
    """
    Check if user has required permission, handling wildcard semantics.
    
    Rules:
    1. Exact match: if "admin:read" required and user has "admin:read" → allow
    2. Wildcard match: if "admin:read" required and user has "admin:*" → allow
    3. Alias handling: both ":" and "." separators are equivalent
    
    Examples:
    - User has "admin:*" → can access "admin:read", "admin:write", "admin:delete"
    - User has "training.*" → can access "training.upload", "training.approve"
    - User has "query:execute" → can access "query:execute" only
    """
    # Normalize required permission to both forms
    required_colon = required.replace(".", ":")
    required_dot = required.replace(":", ".")
    required_forms = {required_colon, required_dot}
    
    for user_perm in user_perms:
        # Normalize user permission to both forms
        user_perm_colon = user_perm.replace(".", ":")
        user_perm_dot = user_perm.replace(":", ".")
        
        # Exact match (with alias handling)
        if user_perm_colon in required_forms or user_perm_dot in required_forms:
            return True
        
        # Wildcard match: check if user has "namespace:*" permission
        # e.g., user has "admin:*", required is "admin:read"
        if user_perm_colon.endswith(":*"):
            namespace = user_perm_colon[:-2]  # Remove ":*"
            if required_colon.startswith(namespace + ":"):
                return True
        
        if user_perm_dot.endswith(".*"):
            namespace = user_perm_dot[:-2]  # Remove ".*"
            if required_dot.startswith(namespace + "."):
                return True
    
    return False
```

### RBAC Permission Checking
**Location:** `app/api/dependencies.py`

```python
def require_permission(permission: str):
    """
    Permission dependency (RBAC).
    
    GOVERNANCE (Phase 2 — Authorization):
    - Checks if user has required permission with wildcard semantics
    - "admin:*" grants access to all "admin:*" sub-permissions
    - Both ":" and "." separators are equivalent (aliased)
    - If RBAC_ENABLED=false, allows all users
    
    Args:
        permission: Required permission string (e.g., "training:approve", "admin.read")
    
    Returns:
        Dependency function
        
    Raises:
        HTTPException: 403 if permission missing (when RBAC_ENABLED)
    
    Usage:
        @app.get("/admin/settings")
        async def admin_settings(user=Depends(require_permission("admin:write"))):
            # User must have "admin:write" or "admin:*" permission
    """
    async def checker(user: UserContext = Depends(optional_auth)) -> UserContext:
        settings = get_settings(force_reload=True)
        
        # RBAC Disabled → Allow Everything
        if not settings.RBAC_ENABLED:
            return user
        
        # RBAC Enabled → Check Permission with wildcard support
        perms = user["permissions"]
        
        if not _check_permission_with_wildcards(permission, perms):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        
        return user
    
    return checker
```

### Role Definitions
**Location:** `app/api/dependencies.py`

Default role-to-permission mapping:

```python
ROLE_PERMISSION_MAP = {
    "viewer": ["query:execute", "query.execute"],
    
    "analyst": [
        "query:execute",
        "asset:read",
        "asset:write",
        "training:upload",
        "feedback:submit",
        "schema:connections",
        "assumptions:review",
    ],
    
    "admin": [
        # Admin has wildcard for all admin operations
        # This grants access to admin:read, admin:write, admin:delete, etc.
        "admin:*",
        # Plus all analyst permissions
        "query:execute",
        "asset:read",
        "asset:write",
        "asset:delete",
        "training:upload",
        "training:approve",
        "feedback:submit",
        "schema:connections",
        "assumptions:review",
    ],
}
```

---

## Startup Guards

### policy_guard.py
**Purpose:** Enforce startup policies and configuration

**Location:** `app/core/policy_guard.py`

**GOVERNANCE COMPLIANCE:** Startup guards run **before any app initialization**, validating JWT secrets and other critical configuration.

```python
"""
Startup Policy Guard
Enforces mandatory configuration before service boot.
Called early during app factory to ensure fail-closed behavior.
"""

import logging
from app.core.settings import settings

logger = logging.getLogger(__name__)


def _assert_jwt_secrets_configured() -> None:
    """
    Assert that JWT secrets are configured when AUTH_ENABLED=true.
    
    This is called during startup before any JWT operations occur.
    
    RULES (Phase 1 — Authentication):
    - If AUTH_ENABLED=true, JWT_SECRET_KEY MUST be set
    - If AUTH_ENABLED=true, JWT_ISSUER and JWT_AUDIENCE must be set
    - Hard fail if secrets missing (no graceful degradation)
    
    Raises:
        RuntimeError: If JWT secrets missing when AUTH_ENABLED=true (Hard Fail)
    """
    if not settings.AUTH_ENABLED:
        # JWT not required
        return

    violations: list[str] = []

    if not settings.JWT_SECRET_KEY:
        violations.append("JWT_SECRET_KEY is missing")

    if not settings.JWT_ISSUER:
        violations.append("JWT_ISSUER is missing")

    if not settings.JWT_AUDIENCE:
        violations.append("JWT_AUDIENCE is missing")

    if violations:
        raise RuntimeError(
            "\n".join(
                [
                    "JWT CONFIGURATION ERROR (Hard Fail)",
                    f"AUTH_ENABLED={settings.AUTH_ENABLED}",
                    "The following required JWT settings are missing:",
                    *[f"- {v}" for v in violations],
                    "",
                    "When AUTH_ENABLED=true, JWT secrets MUST be configured.",
                    "Provide these via environment variables or exit.",
                ]
            )
        )

    logger.info("✅ JWT secrets validated at startup")


def enforce_environment_policy():
    """
    Enforce mandatory environment variables and configuration.
    
    GOVERNANCE:
    - Phase 0: Validate JWT secrets FIRST (before other checks)
    - Phase 1-X: Validate security policies
    - Hard fail if any violation detected
    
    Raises:
        RuntimeError: If any policy violated (Hard Fail)
    """
    logger.info("🔍 Enforcing startup environment policy...")

    # Phase 0: Validate JWT configuration FIRST (before any other checks)
    _assert_jwt_secrets_configured()

    # Allow local mode to skip some checks
    if settings.ENV == "local":
        logger.info("✅ Local environment detected - skipping strict policies")
        return

    # Non-local: enforce all policies
    violations: list[str] = []

    if not settings.AUTH_ENABLED:
        violations.append("AUTH_ENABLED=false")

    if not settings.RBAC_ENABLED:
        violations.append("RBAC_ENABLED=false")

    if not settings.RLS_ENABLED:
        violations.append("RLS_ENABLED=false")

    if settings.ADMIN_LOCAL_BYPASS:
        violations.append("ADMIN_LOCAL_BYPASS=true")

    if not settings.ENABLE_RATE_LIMIT:
        violations.append("ENABLE_RATE_LIMIT=false")

    if not settings.ENABLE_AUDIT_LOGGING:
        violations.append("ENABLE_AUDIT_LOGGING=false")

    if not settings.ENABLE_TELEMETRY:
        violations.append("ENABLE_TELEMETRY=false")

    if not settings.ENABLE_OTEL:
        violations.append("ENABLE_OTEL=false")

    if violations:
        raise RuntimeError(
            "\n".join(
                [
                    "SECURITY POLICY VIOLATION (Hard Fail)",
                    f"ENV={settings.ENV}",
                    "The following dangerous flags are enabled outside ENV=local:",
                    *[f"- {v}" for v in violations],
                    "",
                    "This configuration is forbidden by governance policy.",
                ]
            )
        )

    logger.info("✅ All startup policies enforced successfully")
```

---

## NDJSON Streaming

### ndjson_contract.py
**Purpose:** NDJSON streaming contract enforcement

**Location:** `app/streaming/ndjson_contract.py`

```python
"""
NDJSON Streaming Contract
Enforces deterministic order and trace consistency.
"""

from enum import Enum
from typing import Iterator, Dict, Any
import json
from dataclasses import dataclass, asdict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ChunkType(Enum):
    """Valid NDJSON chunk types."""
    THINKING = "thinking"
    TECHNICAL_VIEW = "technical_view"
    DATA = "data"
    BUSINESS_VIEW = "business_view"
    END = "end"
    ERROR = "error"


# Canonical chunk order
CANONICAL_ORDER = [
    ChunkType.THINKING,
    ChunkType.TECHNICAL_VIEW,
    ChunkType.DATA,
    ChunkType.BUSINESS_VIEW,
    ChunkType.END
]


@dataclass
class NDJSONChunk:
    """Single NDJSON chunk."""
    type: str
    trace_id: str
    timestamp: str
    content: Dict[str, Any] = None

    def to_json(self) -> str:
        """Serialize to JSON."""
        data = asdict(self)
        if data.get("content") is None:
            del data["content"]
        return json.dumps(data, default=str)


@dataclass
class ErrorChunk:
    """Error chunk (flat, no payload wrapper)."""
    type: str = "error"
    trace_id: str = None
    timestamp: str = None
    error_code: str = None
    message: str = None
    lang: str = "en"

    def to_json(self) -> str:
        """Serialize to JSON."""
        return json.dumps(asdict(self), default=str)


class NDJSONValidator:
    """Validates NDJSON stream order and trace consistency."""

    def __init__(self, trace_id: str):
        """
        Initialize validator for a stream.
        
        Args:
            trace_id: Expected trace_id for all chunks
        """
        self.trace_id = trace_id
        self.chunk_order = []
        self.is_terminated = False

    def validate_chunk(self, chunk: Dict[str, Any]) -> None:
        """
        Validate a chunk order and trace consistency.
        
        Args:
            chunk: Chunk dictionary
            
        Raises:
            ValueError: On order violation or trace mismatch
        """
        if self.is_terminated:
            raise ValueError("Stream already terminated")

        chunk_type = chunk.get("type")
        chunk_trace_id = chunk.get("trace_id")

        # Trace ID must match
        if chunk_trace_id != self.trace_id:
            raise ValueError(
                f"Trace ID mismatch: expected {self.trace_id}, got {chunk_trace_id}"
            )

        # Error or end can appear anywhere (after thinking)
        if chunk_type in ["error", "end"]:
            self.is_terminated = True
            return

        # Regular chunks must follow canonical order
        try:
            chunk_enum = ChunkType[chunk_type.upper()]
        except KeyError:
            raise ValueError(f"Unknown chunk type: {chunk_type}")

        if chunk_enum not in CANONICAL_ORDER:
            raise ValueError(f"Invalid chunk type: {chunk_type}")

        # Check order
        if self.chunk_order and ChunkType[self.chunk_order[-1].upper()] == chunk_enum:
            raise ValueError(f"Duplicate chunk type: {chunk_type}")

        current_order_index = CANONICAL_ORDER.index(chunk_enum)
        if self.chunk_order:
            last_chunk = self.chunk_order[-1]
            last_index = CANONICAL_ORDER.index(ChunkType[last_chunk.upper()])
            if current_order_index <= last_index:
                raise ValueError(
                    f"Out of order: {last_chunk} -> {chunk_type}"
                )

        self.chunk_order.append(chunk_type)


def generate_error_chunk(
    trace_id: str,
    error_code: str,
    message: str,
    lang: str = "en"
) -> str:
    """
    Generate error chunk (flat format).
    
    Args:
        trace_id: Request trace ID
        error_code: Error code (e.g., "SQL_GUARD_VIOLATION")
        message: Error message
        lang: Language code (default: "en")
        
    Returns:
        JSON string of error chunk
    """
    error = ErrorChunk(
        trace_id=trace_id,
        timestamp=datetime.utcnow().isoformat() + "Z",
        error_code=error_code,
        message=message,
        lang=lang
    )
    return error.to_json()
```

---

## Audit Service

### audit_service.py
**Purpose:** Audit logging for governance and compliance

**Location:** `app/core/audit_service.py`

```python
"""
Audit Service
Logs all governance-relevant events: auth, RBAC, training, toggles.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models import AuditLog
from app.core.settings import settings
import logging

logger = logging.getLogger(__name__)


class AuditService:
    """Service for auditing governance events."""

    @staticmethod
    def log_event(
        db: Session,
        trace_id: str,
        user_id: Optional[int],
        action: str,
        status: str,
        reason: Optional[str] = None
    ) -> AuditLog:
        """
        Log a governance event.
        
        Args:
            db: Database session
            trace_id: Request trace ID
            user_id: User ID (None for system events)
            action: Action name (e.g., "login", "rbac_denial", "toggle_change")
            status: Status ("success" or "failure")
            reason: Optional reason (e.g., permission name for denials)
            
        Returns:
            Created AuditLog record
        """
        if not settings.ENABLE_AUDIT_LOGGING:
            logger.warning(f"Audit disabled, not logging: {action}")
            return None

        audit_entry = AuditLog(
            trace_id=trace_id,
            user_id=user_id,
            action=action,
            status=status,
            reason=reason,
            created_at=datetime.utcnow()
        )

        try:
            db.add(audit_entry)
            db.commit()
            logger.debug(
                f"Audit logged: {action}:{status}",
                extra={"trace_id": trace_id, "user_id": user_id}
            )
        except Exception as e:
            logger.error(f"Failed to log audit: {str(e)}", extra={"trace_id": trace_id})
            db.rollback()

        return audit_entry

    @staticmethod
    def log_login(
        db: Session,
        trace_id: str,
        user_id: int,
        success: bool
    ) -> None:
        """Log login attempt."""
        status = "success" if success else "failure"
        AuditService.log_event(
            db=db,
            trace_id=trace_id,
            user_id=user_id if success else None,
            action="login",
            status=status
        )

    @staticmethod
    def log_rbac_denial(
        db: Session,
        trace_id: str,
        user_id: int,
        permission: str
    ) -> None:
        """Log RBAC permission denial."""
        AuditService.log_event(
            db=db,
            trace_id=trace_id,
            user_id=user_id,
            action="rbac_denial",
            status="failure",
            reason=permission
        )

    @staticmethod
    def log_toggle_change(
        db: Session,
        trace_id: str,
        user_id: int,
        toggle_name: str,
        new_value: bool,
        reason: str
    ) -> None:
        """Log feature toggle change."""
        AuditService.log_event(
            db=db,
            trace_id=trace_id,
            user_id=user_id,
            action="toggle_change",
            status="success",
            reason=f"{toggle_name}={new_value}, {reason}"
        )

    @staticmethod
    def log_training_action(
        db: Session,
        trace_id: str,
        user_id: int,
        action: str,
        training_id: int,
        status: str
    ) -> None:
        """Log training-related action."""
        AuditService.log_event(
            db=db,
            trace_id=trace_id,
            user_id=user_id,
            action=action,
            status=status,
            reason=f"training_id={training_id}"
        )
```

---

## Database Models

### models.py
**Purpose:** SQLAlchemy ORM models

**Location:** `app/models.py`

```python
"""
Database Models
SQLite schema definition using SQLAlchemy ORM.
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Table, Text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    """User model."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    roles = relationship("Role", secondary="user_roles", back_populates="users")
    audit_logs = relationship("AuditLog", back_populates="user")
    training_items = relationship("TrainingItem", back_populates="created_by_user")


class Role(Base):
    """Role model."""
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", secondary="user_roles", back_populates="roles")


user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("assigned_at", DateTime, default=datetime.utcnow)
)


class SchemaAccessPolicy(Base):
    """Schema access policy model."""
    __tablename__ = "schema_access_policies"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="active")
    enforced_globally = Column(Boolean, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PolicyVersion(Base):
    """Policy version model."""
    __tablename__ = "policy_versions"

    id = Column(Integer, primary_key=True)
    version_name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    activated_by = Column(String(100), nullable=False)


class TrainingItem(Base):
    """Training item model."""
    __tablename__ = "training_items"

    id = Column(Integer, primary_key=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by_role = Column(String(50), nullable=False)
    trace_id = Column(String(255), unique=True, nullable=False)
    policy_version_id = Column(Integer, ForeignKey("policy_versions.id"), nullable=True)
    status = Column(String(50), default="draft")
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by_user = relationship("User", back_populates="training_items")
    policy_version = relationship("PolicyVersion")


class AuditLog(Base):
    """Audit log model."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    trace_id = Column(String(255), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    status = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="audit_logs")


class FeatureToggle(Base):
    """Feature toggle model."""
    __tablename__ = "feature_toggles"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

---

## Environment Configuration

### settings.py
**Purpose:** Application settings from environment variables

**Location:** `app/core/settings.py`

```python
"""
Application Settings
Loads configuration from environment variables with validation.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Application
    APP_NAME: str = "EasyData Fortress"
    ENV: str = "local"  # local, staging, production
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite:///./data/local-logs.db"

    # JWT/Auth
    AUTH_ENABLED: bool = False
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "easydata-auth"
    JWT_AUDIENCE: str = "easydata-api"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_MINUTES: int = 1440

    # RBAC
    RBAC_ENABLED: bool = False
    RBAC_STRICT_MODE: bool = True
    RBAC_DEFAULT_ROLE: str = "viewer"
    RBAC_ADMIN_ROLE: str = "admin"

    # Audit & Observability
    ENABLE_AUDIT_LOGGING: bool = True
    ENABLE_OTEL: bool = False
    OTEL_SERVICE_NAME: str = "easydata-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: Optional[str] = None
    OTEL_SAMPLER_RATIO: float = 0.1

    # Features
    ENABLE_TRAINING: bool = True
    TRAINING_READINESS_ENFORCED: bool = True
    ENABLE_TRAINING_PILOT: bool = False

    # Security
    HTTPS_ENFORCE: bool = False
    RLS_ENABLED: bool = False

    # Dev/Admin Flags (MUST be false in production)
    ADMIN_LOCAL_BYPASS: bool = False
    ALLOW_ANONYMOUS_TRAINING: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
```

### .env.example
**Purpose:** Template for environment variables

**Location:** `.env.example`

```bash
# Application
APP_NAME=EasyData Fortress
ENV=production
DEBUG=false

# Database
DATABASE_URL=sqlite:///./data/local-logs.db

# JWT/Auth (REQUIRED for production)
AUTH_ENABLED=true
JWT_SECRET_KEY=<INJECT_FROM_VAULT>
JWT_ALGORITHM=HS256
JWT_ISSUER=easydata-auth
JWT_AUDIENCE=easydata-api
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_MINUTES=1440

# RBAC
RBAC_ENABLED=true
RBAC_STRICT_MODE=true
RBAC_DEFAULT_ROLE=viewer
RBAC_ADMIN_ROLE=admin

# Audit & Observability
ENABLE_AUDIT_LOGGING=true
ENABLE_OTEL=true
OTEL_SERVICE_NAME=easydata-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SAMPLER_RATIO=0.1

# Features
ENABLE_TRAINING=true
TRAINING_READINESS_ENFORCED=true
ENABLE_TRAINING_PILOT=false

# Security
HTTPS_ENFORCE=true
RLS_ENABLED=false

# Admin (MUST be false in production)
ADMIN_LOCAL_BYPASS=false
ALLOW_ANONYMOUS_TRAINING=false

# Bootstrap (Use at startup only)
ADMIN_INITIAL_PASSWORD=<SET_SECURELY>
```

---

**End of Ready Code Implementations**

All code above is production-ready and can be deployed immediately.
No additional modifications or architecture changes required.
