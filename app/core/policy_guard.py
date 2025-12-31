from app.core.settings import settings
import logging

logger = logging.getLogger(__name__)


def _assert_jwt_secrets_configured() -> None:
    """
    Assert that JWT secrets are configured when AUTH_ENABLED=true.
    
    This is called during startup before any JWT operations occur.
    
    RULES (Phase 1 — Authentication):
    - If AUTH_ENABLED=true, JWT_SECRET_KEY MUST be set
    - If AUTH_ENABLED=true, JWT_ISSUER and JWT_AUDIENCE must be set
    
    Raises:
        RuntimeError: If JWT secrets missing when AUTH_ENABLED=true
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


def enforce_environment_policy() -> None:
    """
    Enforces strict environment trust boundaries.

    RULES:
    - Dangerous flags are permitted ONLY when ENV=local
    - Any violation causes immediate startup failure
    - JWT secrets must be validated before any app initialization
    """

    # Phase 0: Validate JWT configuration FIRST (before any other checks)
    _assert_jwt_secrets_configured()

    if settings.ENV == "local":
        return

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
