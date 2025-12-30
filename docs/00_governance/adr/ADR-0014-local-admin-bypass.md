# ADR-0014: Explicit Local Admin Bypass for Development

## Status
Accepted

## Context
EasyData enforces strict governance on all administrative endpoints under `/api/v1/admin/*`.
Even when authentication and RBAC are disabled for local development, administrative access
remains protected to prevent accidental or implicit privilege escalation.

During local development, engineers require controlled access to admin endpoints
without introducing security regressions.

## Decision
Introduce an explicit, environment-scoped bypass mechanism controlled by:

`ADMIN_LOCAL_BYPASS=true`

This bypass is valid ONLY when:
- `ENV=local`

The bypass does NOT:
- Trust JWTs
- Rely on `AUTH_ENABLED` or `RBAC_ENABLED`
- Apply in staging or production

Admin access remains denied by default.

## Rationale
- Prevents implicit admin access
- Preserves defense-in-depth
- Makes privilege escalation explicit and auditable
- Avoids accidental exposure in non-local environments

## Consequences
### Positive
- Safe local development
- Clear security boundaries
- No production risk

### Negative
- Requires explicit configuration
- Slightly more setup for developers

## Alternatives Considered
- Auto-admin when AUTH disabled ❌ (Rejected: unsafe)
- Dummy admin tokens ❌ (Rejected: implicit trust)
- Disable admin checks entirely ❌ (Rejected: governance violation)

## Compliance
This decision aligns with:
- Principle of Least Privilege
- Explicit Governance Controls
- Secure-by-Default Architecture
