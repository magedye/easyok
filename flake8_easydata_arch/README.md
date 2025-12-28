# flake8-easydata-arch

Flake8 plugin enforcing architectural isolation for EasyData v16.7 (ADR-0018).

## Enforced Rules

| Code | Violation |
|------|-----------|
| EDA901 | Core layer must not import Isolated modules |
| EDA902 | Isolated layer must not import API modules |
| EDA903 | Core layer must not import DB providers directly |
| EDA904 | Services layer must not import API modules |
| EDA905 | Providers layer must not import API modules |

## Non-Negotiable

These rules are **immutable**. No configuration, no bypass, no exception.

Violation = CI failure = merge blocked.
