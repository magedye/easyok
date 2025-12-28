All AI agents operating on the EasyData project must follow a low-variance, deterministic reasoning mode, equivalent to an effective temperature ≈ 0.1.

This implies the following mandatory behaviour:

Prefer deterministic, explicit, and reproducible outputs over creative or speculative responses.

Avoid unnecessary verbosity, stylistic variation, or exploratory suggestions.

Do not introduce assumptions, interpretations, or alternatives unless:

Explicitly requested, or

Required to resolve a documented ambiguity or conflict.

Follow existing documentation, ADRs, contracts, and configuration as written, without reinterpretation.

When multiple valid options exist, select the one that is:

Already documented, or

The most conservative and least disruptive to the existing architecture.

Do not propose architectural changes, refactors, or enhancements unless explicitly instructed to do so.

Responses must be precise, implementation-oriented, and traceable to existing project rules and documents.

The goal of this constraint is to minimize architectural drift, reduce ambiguity, and ensure consistent agent behaviour across all interactions.

# 🤖 Agents Guidelines for EasyData Development

This document provides clear instructions and best practices for any AI agent tasked with maintaining, extending, or improving the EasyData project. By following these rules, agents will produce consistent, secure, and maintainable contributions aligned with the architecture and documents supplied.

## 📂 Reference Documents

Before making changes, read and understand the following core documents in the `docs/` directory. They are your single sources of truth:

| File | Purpose |
| --- | --- |
| `master_api_contract.md` | Defines every API endpoint, request/response schema, streaming phases, and error codes. Always update this first when designing new endpoints. |
| `data_model_schema_context.md` | Describes the system and user databases, tables such as `audit_logs` and `training_data`, and how they relate to the RAG process. |
| `adr_arch_dec_record.md` | Records architectural decisions (ADR). Create a new ADR whenever you introduce a non-trivial design change. |
| `security_permissions_matrix.md` | Specifies SQL firewall rules, RBAC roles and permissions, JWT token expiry, and other security policies. |
| `software_requirements_spec.md` | Lists functional/non-functional requirements, constraints, and use cases. Always ensure new features meet these requirements. |
| `project_design_document.md` | Provides the overall architecture, layered design, workflow, and major services (e.g. `VannaService`, `OrchestrationService`). |
| `guidelines.md` | Offers high-level implementation guidelines, folder structure, configuration principles, and the final canonical structure. |

When in doubt, consult these documents. If something is missing or ambiguous, record your reasoning in a new ADR and clarify it in the appropriate document.

## 🚦 General Rules

0. **Hard Security Contract (v16.3):** All agents must treat the following as non-negotiable architecture, not guidance:

   - SQLGuard is mandatory. No SQL (LLM/Vanna/training/any source) reaches the database unless it passes `sql_guard.validate(...)`. Direct execution such as `db.execute(sql)` is forbidden and is a security bug.
   - Validation is AST-based via sqlglot (Oracle dialect). Enforcement includes statement type gating (SELECT/WITH only by default), detection of forbidden operations (DDL/DML), and table/column inspection from AST nodes.
   - SchemaAccessPolicy is binding: allowed/excluded tables and allowed/excluded columns plus active version. Any out-of-policy reference must raise `SECURITY_VIOLATION`, stop execution immediately, and be audited.
   - `/ask` is the only authorized execution path. It must stream NDJSON, emit `technical_view` first, and enforce SQLGuard unconditionally. Any alternate execution path is architecturally invalid.
   - Audit on violations is mandatory: action `Blocked_SQL_Attempt`, with question, generated SQL, and violation reason. No silent failures or placeholder responses.
   - Fail fast: on violation, stop, return structured error with `error_code: SECURITY_VIOLATION`; never attempt recovery or correction of forbidden queries.
   - Agents must not bypass SQLGuard, must not introspect live DB schema outside policy, must not generate SQL without policy awareness, and must preserve NDJSON streaming contracts while treating security failures as first-class outcomes.

1. **Contract First:** Define API request/response models in Pydantic (`models/`) and update `master_api_contract.md` before implementing an endpoint. The frontend relies on this contract to stay stable across backend changes.
2. **Structured Monolith Only:** Do not introduce microservices or random module structures. Follow the canonical project structure described in `guidelines.md` and the `project_design_document.md`.
3. **Single Source of Truth (SSOT):** Configuration values must be read from `.env` via `core/config.py`. Do not hard-code secrets, connection strings, or feature toggles anywhere else. Provide a `.env.example` for new environment variables.
4. **Python Virtual Environment (PEP 668):** Always use a project-local virtual environment at `./.venv/`.

   - Install dependencies ONLY inside the venv (`pip install -r requirements.txt` after `source .venv/bin/activate`).
   - Never run `pip install` against the system Python (do not use `--break-system-packages`).
5. **Lazy Loading:** Use the factory pattern in `providers/factory.py` to instantiate only the necessary providers (DB, LLM, vector store) at runtime. Avoid global imports of database drivers or heavy dependencies.
6. **Keep Services Stateless:** No service should maintain state between requests (other than database or vector store). Avoid singletons with stateful behaviour.
7. **Isolation of Concerns:**
* `core/` contains configuration, constants, exceptions, and security utilities. It must not import from `api/` or `services/`.
* `providers/` implement interfaces defined in `providers/base.py`. Each provider file should only implement one concrete provider.
* `services/` encapsulate business logic. They should not depend on FastAPI or HTTP concepts.
* `api/` contains FastAPI routes and dependency injection; it must not contain business logic.


8. **Middleware:** implements cross-cutting concerns (logging, rate limiting, performance, security) and must be toggleable via `.env`.
9. **RBAC and Security:** Enforce permissions using roles and scopes defined in `security_permissions_matrix.md`. Never bypass `require_permission` dependencies in routes. Use the SQL firewall and RLS injection described in the design document for every generated SQL.
10. **Streaming Responses:** When implementing the `/api/v1/ask` endpoint, return data via NDJSON as specified (data → chart → summary). Do not send all data at once.
11. **Circuit Breaker & Error Handling:** Use the `CircuitBreaker` utility to wrap calls to external services (LLM, databases). Centralise exception handling in `core/exceptions.py` and return unified JSON responses (status, message, data, error_code, timestamp).
12. **Testing and Documentation:** Write unit tests for critical logic. If you introduce a new pattern or complex behaviour, create an ADR in `docs/adr/` explaining your choice. Update the SRS if requirements evolve.

## 🛠️ Development Workflow for Agents

1. **Plan:** Identify which requirement you are addressing. Consult the SRS, API contract, and design document. If the change affects architecture or introduces a new provider, write an ADR (e.g. `docs/adr/ADR-00XX-new-feature.md`).
2. **Update Contracts:** If adding an endpoint, update `master_api_contract.md` with endpoint details, request/response schemas, and error codes. Define corresponding Pydantic models in `app/models/`.
3. **Implement Provider or Service:** Implement the logic in the appropriate `providers/` or `services/` module. Adhere to interfaces in `providers/base.py` and avoid circular imports.
4. **Wire Up API:** Create or modify routes under `app/api/v1/`. Use FastAPI's `Depends` for authentication, permissions, and DI. Do not put business logic in route handlers.
5. **Security & Performance:** Ensure new queries are validated via the SQL guard (`utils/sql_guard.py`). Respect RLS injection and role checks. Use streaming for long-running queries. Add rate limiting if the endpoint is expensive.
6. **Document & Test:** Document how to use the new feature in the design document if needed. Write tests (under `tests/`) and run them. Update `requirements.txt` if new dependencies are needed.
7. **Review & Commit:** Ensure code meets PEP8 and passes linters. Commit changes with descriptive messages and update any affected documentation. Provide new ADR if applicable.

## 🧑‍💻 Example Agent Task

**Goal:** Add a new endpoint to export audit logs as CSV for administrators.

**Steps:**

1. Check `security_permissions_matrix.md` to ensure only admin or manager roles have access.
2. Add an entry in `master_api_contract.md` detailing `GET /api/v1/audit/export`, including query parameters for date range and expected CSV media type.
3. Define an `AuditExportRequest` model in `app/models/request.py`.
4. Implement `AuditService.export_logs()` in `services/` to read from the System DB via SQLAlchemy and generate a CSV stream.
5. Create a route in `api/v1/admin.py` that injects user via `verify_token`, checks `Permission.AUDIT_VIEW`, calls the service, and returns a `StreamingResponse` with appropriate headers.
6. Write a new ADR if you decide to introduce a helper for streaming CSV, explaining why.
7. Update tests and documentation.

## ✅ Summary

This file guides any AI agent through the development lifecycle of EasyData. By following these practices and referring to the provided documents, agents will avoid architectural drift, implement features securely, and maintain consistency across the project.
