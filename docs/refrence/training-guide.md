Training Guide (DDL as First-Class Artifact)
=============================================

Purpose
-------
This short guide codifies the project's rules for training artifacts (SQL pairs, docs, and importantly DDL).
It describes the canonical lifecycle: READ → REVIEW → APPROVE → TRAIN and documents the new helper script to extract/ingest DDL.

**Authoritative issue brief:** `docs/issue_reports/schema-aware-training-failure.md` — a sealed, formal directive describing mandatory DDL training and guardrails required for schema-related questions.


Key Rules
---------
- DDL must be treated as a first-class training artifact. Without DDL, schema questions are blind and will produce placeholder or misleading answers.
- DDL ingestion must be explicit, auditable, and gated behind review/approval (do not rely on live DB introspection at ask time).
- The system honors the `VANNA_ALLOW_DDL` feature flag. By default ingestion is disabled (safe-by-default).

Scripts and Automation
----------------------
- `scripts/oracle/extract_and_ingest_ddl.py` — Extracts DDL from Oracle and ingests into the vector store (`ddl` collection in Chromadb).
  - Use `--dry-run` to preview.
  - Use `--overwrite` to replace existing IDs.
  - By default will refuse to write unless `VANNA_ALLOW_DDL=true` or `--force` is used.

Operational Notes
-----------------
- Extracted DDL should be reviewed before being used to train a model in production. The recommended flow:
  1. Extract (scripts/oracle/extract_and_ingest_ddl.py --owner HR --dry-run)
  2. Commit candidate DDL documents to a review queue (manual or via review UI)
  3. Approve and promote reviewed snapshots via `scripts/promote/promote_reviewed_training.py` or admin UI
  4. Run `scripts/promote/sync_vector_store.py` or `trainer` module to rebuild the vector store used by the runtime

- The script writes to Chromadb collection `ddl` with ids like `HR.table.EMPLOYEES` to prevent duplicates and enable idempotency.

Audit & Governance
------------------
- Record all ingestion runs in the training audit log (append-only) — use `training_audit_service` or the admin audit process.
- Ensure `VANNA_ALLOW_DDL=false` remains the default in `.env` to avoid accidental ingestion.

Testing
-------
- The repository includes a minimal test `tests/test_oracle_ddl_extractor.py` which verifies the guard behavior and force bypass.

FAQ
---
Q: Why not auto-bootstrap DDL on startup?
A: Auto-bootstrap can be enabled as an opt-in feature (advanced), but default behavior must be explicit ingestion and review to avoid accidental exposure and training drift.
