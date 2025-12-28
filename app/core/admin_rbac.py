"""
Admin RBAC: Enforce that only admin role can modify toggles.

This module defines:
1. Admin role verification
2. Immutable toggle protection
3. Audit trail requirement
"""

from typing import Optional, Callable, TypeVar
from functools import wraps
from enum import Enum

T = TypeVar('T')


class UserRole(Enum):
    """User roles in EasyData."""
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"


class RBACViolation(Exception):
    """Raised when non-admin attempts privileged action."""
    pass


class ImmutableToggleViolation(Exception):
    """Raised when attempt to modify immutable toggle."""
    pass


class MissingReasonError(Exception):
    """Raised when toggle change submitted without reason."""
    pass


# Global context for current user (normally set by auth middleware)
_current_user: Optional[dict] = None


def set_current_user(user: Optional[dict]) -> None:
    """Set current authenticated user context."""
    global _current_user
    _current_user = user


def get_current_user() -> Optional[dict]:
    """Get current authenticated user."""
    return _current_user


def get_user_role() -> Optional[UserRole]:
    """Get current user's role."""
    user = get_current_user()
    if not user:
        return None
    
    role_str = user.get("role", "guest").lower()
    try:
        return UserRole(role_str)
    except ValueError:
        return UserRole.GUEST


def is_admin() -> bool:
    """Check if current user is admin."""
    return get_user_role() == UserRole.ADMIN


def require_admin(func: Callable[..., T]) -> Callable[..., T]:
    """
    Decorator: Require admin role.
    
    Raises RBACViolation if user is not admin.
    """
    @wraps(func)
    def wrapper(*args, **kwargs) -> T:
        if not is_admin():
            user = get_current_user()
            user_id = user.get("id", "unknown") if user else "anonymous"
            raise RBACViolation(
                f"User {user_id} attempted privileged operation. Admin role required."
            )
        return func(*args, **kwargs)
    
    return wrapper


def require_reason(func: Callable[..., T]) -> Callable[..., T]:
    """
    Decorator: Require 'reason' parameter with min 10 chars.
    
    Raises MissingReasonError if reason is missing or too short.
    """
    @wraps(func)
    def wrapper(*args, **kwargs) -> T:
        reason = kwargs.get('reason', '')
        
        if not reason or len(reason) < 10:
            raise MissingReasonError(
                f"Toggle change requires reason (min 10 chars). Got: '{reason}'"
            )
        
        return func(*args, **kwargs)
    
    return wrapper


def guard_immutable_toggle(toggle_name: str, new_value: bool) -> None:
    """
    Check if toggle is immutable.
    
    Raises ImmutableToggleViolation if immutable.
    """
    from app.core.toggle_classification import is_immutable
    
    if is_immutable(toggle_name):
        raise ImmutableToggleViolation(
            f"Cannot modify immutable toggle: {toggle_name}. "
            f"This toggle is governed by architecture rules (ADR-0018)."
        )


def validate_toggle_change(toggle_name: str, old_value: bool, new_value: bool, reason: str) -> dict:
    """
    Validate a toggle change request.
    
    Returns change metadata if valid.
    Raises exception if invalid.
    """
    # Check immutable
    guard_immutable_toggle(toggle_name, new_value)
    
    # Check reason
    if not reason or len(reason) < 10:
        raise MissingReasonError(
            f"Toggle change requires reason (min 10 chars). Got: '{reason}'"
        )
    
    # Check admin
    if not is_admin():
        raise RBACViolation(
            f"User {get_current_user().get('id', 'unknown')} lacks admin role"
        )
    
    return {
        "toggle_name": toggle_name,
        "old_value": old_value,
        "new_value": new_value,
        "reason": reason,
        "user_id": get_current_user().get("id"),
        "user_role": get_user_role().value,
    }
