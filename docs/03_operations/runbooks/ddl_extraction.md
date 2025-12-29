DDL Extraction Quickstart
=========================

This short quickstart shows how to use the Oracle DDL extractor script.

Prerequisites
-------------
- Set Oracle connection environment variables (`DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`) or `ORACLE_CONNECTION_STRING`.
- Install dependencies: `pip install -r requirements.txt` (use `./.venv` as described in `docs/development_setup.md`).
- Ensure `chromadb` is installed and available to accept documents.

Preview (Dry Run)
-----------------
```bash
# Activate virtualenv
source .venv/bin/activate
VANNA_ALLOW_DDL=true python scripts/oracle/extract_and_ingest_ddl.py --owner HR --dry-run
```

Ingest (Safe Mode)
------------------
The script respects the `VANNA_ALLOW_DDL` env (default false). To allow ingestion:

```bash
# Activate virtualenv
source .venv/bin/activate
VANNA_ALLOW_DDL=true python scripts/oracle/extract_and_ingest_ddl.py --owner HR
```

# CI / container note
If you run in CI or a container without a virtualenv, bypass the check explicitly:
```bash
python scripts/oracle/extract_and_ingest_ddl.py --owner HR --skip-venv-check
```
Force (Bypass guard) — use with care
-----------------------------------
```bash
python scripts/oracle/extract_and_ingest_ddl.py --owner HR --force
```

Notes
-----
- The script adds DDL documents to Chromadb collection `ddl` with ids like `HR.table.EMPLOYEES` for idempotency.
- Use `--overwrite` to replace existing documents.
- After ingestion, follow the project's review/approve flow documented in `docs/refrence/training-guide.md`.
