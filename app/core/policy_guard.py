from app.core.settings import settings


def enforce_environment_policy() -> None:
    """
    Enforces strict environment trust boundaries.

    RULES:
    - Dangerous flags are permitted ONLY when ENV=local
    - Any violation causes immediate startup failure
    """

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
                    "SECURITY POLICY VIOLATION",
                    f"ENV={settings.ENV}",
                    "The following dangerous flags are enabled outside ENV=local:",
                    *[f"- {v}" for v in violations],
                    "",
                    "This configuration is forbidden by governance policy.",
                ]
            )
        )
