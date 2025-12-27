Oracle DDL Extractor
=====================

Purpose
-------
Small utility to extract schema DDL from an Oracle database and ingest it into a vector store (Chromadb) under the collection `ddl`.

Quick Usage
-----------
- Activate venv and Preview (dry-run):
  ```bash
  source .venv/bin/activate
  VANNA_ALLOW_DDL=true python scripts/oracle/extract_and_ingest_ddl.py --owner HR --dry-run
  ```

- Activate venv and ingest into Chromadb:
  ```bash
  source .venv/bin/activate
  VANNA_ALLOW_DDL=true python scripts/oracle/extract_and_ingest_ddl.py --owner HR
  ```

- In CI or containers where a venv is not used, bypass the venv check explicitly:
  ```bash
  python scripts/oracle/extract_and_ingest_ddl.py --owner HR --skip-venv-check
  ```

Security and Governance
-----------------------
- By default ingestion is disabled via environment variable `VANNA_ALLOW_DDL=false`.
- The script will refuse to run unless `VANNA_ALLOW_DDL` is true or `--force` is passed (use with care).
- The pipeline expects DDL to be reviewed/approved according to `docs/refrence/training-guide.md` (READ → REVIEW → APPROVE → TRAIN).
- This script performs read-only queries on Oracle; ingestion occurs in the vector store only.

Environment
-----------
Required (one of the following):
- Set explicit DB connection variables: `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME` (service name)
- or set `ORACLE_CONNECTION_STRING` with format like: `oracle+oracledb://user:pass@host:port/service`

Optional/Control:
- `VANNA_ALLOW_DDL` - must be `true` to allow ingestion (or pass --force)

Notes
-----
- The script adds documents to a Chromadb collection named `ddl` using ids of the form `OWNER.table.<TABLE_NAME>`.
- Use `--overwrite` to replace existing documents with the same id.
- It supports `--limit` to limit the number of tables processed (helpful in testing).

Reference
---------
Follow the project's training policy in `docs/refrence/training-guide.md` and record any ingested changes in your review workflow before promoting into production training runs.
