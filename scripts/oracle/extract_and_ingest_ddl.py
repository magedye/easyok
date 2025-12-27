#!/usr/bin/env python3
"""Extract DDL from Oracle and ingest into the vector store (collection 'ddl').

Usage:
  python scripts/oracle/extract_and_ingest_ddl.py --owner HR --dry-run

Notes:
- This script is read-only to Oracle. It will only write to the vector store when
  VANNA_ALLOW_DDL is true (env) or --force is passed.
- It writes documents to a Chromadb collection named 'ddl' using ids:
  <owner>.<object_type>.<object_name>
- Use --overwrite to replace existing DDL documents.

Security & Governance:
- By default ingestion of DDL is disabled via env var: VANNA_ALLOW_DDL=false
- Refer to docs/refrence/training-guide.md for the REVIEW/APPROVE/TRAIN workflow.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from typing import List, Dict

# Suppress or disable Chromadb telemetry by default to avoid noisy errors from
# incompatible telemetry hooks in some chromadb client versions.
os.environ.setdefault("CHROMA_TELEMETRY", "false")

try:
    import oracledb  # type: ignore
except Exception:
    oracledb = None

try:
    import chromadb
    from chromadb.utils import embedding_functions  # noqa: F401 - optional
    # Reduce noisy telemetry/log errors from some chromadb client versions during script runs
    try:
        logging.getLogger("chromadb").setLevel(logging.CRITICAL)
    except Exception:
        pass
except Exception:
    chromadb = None

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("ddl_extractor")


def env_flag_true(name: str) -> bool:
    v = os.environ.get(name, "false").lower()
    return v in ("1", "true", "yes", "on")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Extract Oracle DDL and ingest into vector store")
    p.add_argument("--owner", required=False, help="Oracle schema owner (e.g., HR). If omitted, use --list-owners to see available owners")
    p.add_argument("--limit", type=int, default=0, help="Limit number of objects to extract (0 = all)")
    p.add_argument("--dry-run", action="store_true", help="Do not write to vector store; only preview")
    p.add_argument("--overwrite", action="store_true", help="Overwrite existing docs in vector store")
    p.add_argument("--force", action="store_true", help="Bypass VANNA_ALLOW_DDL guard (use with care)")
    p.add_argument("--skip-venv-check", action="store_true", help="Skip virtualenv activation check (use in CI or containers)")
    p.add_argument("--list-owners", action="store_true", help="List distinct owners/schemas visible to the connected user and exit")
    return p.parse_args()


def build_oracle_conn_from_env():
    """Build a connection using DB_* env vars or ORACLE_CONNECTION_STRING fallback.

    Notes:
    - Supports explicit DB_* env vars (preferred).
    - If ORACLE_CONNECTION_STRING is present, we attempt to parse it; the parser
      tolerates common prefixes like 'oracle+oracledb://' and strips trailing
      comments or whitespace (useful when using the `.env` template which has
      a trailing '>>> CHANGE ME <<<').
    """
    if oracledb is None:
        raise RuntimeError("oracledb driver is not installed")

    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    host = os.environ.get("DB_HOST")
    port = os.environ.get("DB_PORT")
    service = os.environ.get("DB_NAME")

    conn_str = os.environ.get("ORACLE_CONNECTION_STRING")

    # If env vars are missing, try loading from .env via app.core.config Settings
    if not (user and password and host and port and service) and not conn_str:
        try:
            from app.core.config import get_settings

            cfg = get_settings(force_reload=True)
            conn_str = conn_str or cfg.ORACLE_CONNECTION_STRING
            user = user or getattr(cfg, "DB_USER", None)
            password = password or getattr(cfg, "DB_PASSWORD", None)
            host = host or getattr(cfg, "DB_HOST", None)
            port = port or getattr(cfg, "DB_PORT", None)
            service = service or getattr(cfg, "DB_NAME", None)
        except Exception:
            pass

    # Prefer explicit DB_* variables
    if user and password and host and port and service:
        dsn = oracledb.makedsn(host, int(port), service_name=service)
        return oracledb.connect(user=user, password=password, dsn=dsn)

    if conn_str:
        try:
            import re

            # Trim trailing comments or markers (e.g., '>>> CHANGE ME <<<') and whitespace
            conn_str_clean = conn_str.split()[0]
            # Allow optional scheme prefix (oracle+oracledb:// or oracle+cx_oracle://)
            pattern = re.compile(
                r"(?:(?:[a-zA-Z0-9_+\-]+)://)?"  # optional scheme
                r"(?P<user>[^:/@]+)[:/\\](?P<pw>[^@]+)@"
                r"(?P<host>[^:/]+):(?P<port>\d+)[/\\](?P<service>\S+)"
            )
            m = pattern.search(conn_str_clean)
            if not m:
                raise RuntimeError(f"Unrecognized ORACLE_CONNECTION_STRING format: '{conn_str_clean}'")

            user = m.group("user")
            password = m.group("pw")
            host = m.group("host")
            port = int(m.group("port"))
            service = m.group("service")

            dsn = oracledb.makedsn(host, port, service_name=service)
            return oracledb.connect(user=user, password=password, dsn=dsn)
        except Exception as exc:  # pragma: no cover - defensive
            raise RuntimeError(f"Failed parsing ORACLE_CONNECTION_STRING: {exc}")

    raise RuntimeError(
        "Missing Oracle connection details; set DB_USER/DB_PASSWORD/DB_HOST/DB_PORT/DB_NAME or ORACLE_CONNECTION_STRING"
    )


def fetch_table_list(conn, owner: str, limit: int = 0) -> List[Dict[str, str]]:
    sql = "SELECT OWNER, TABLE_NAME FROM ALL_TABLES WHERE OWNER = :owner ORDER BY TABLE_NAME"
    if limit and isinstance(limit, int) and limit > 0:
        sql = sql + f" FETCH FIRST {limit} ROWS ONLY"

    with conn.cursor() as cur:
        cur.execute(sql, [owner.upper()])
        rows = cur.fetchall()
        return [{"owner": r[0], "table": r[1]} for r in rows]


def fetch_owner_list(conn) -> List[str]:
    sql = "SELECT DISTINCT OWNER FROM ALL_TABLES ORDER BY OWNER"
    with conn.cursor() as cur:
        cur.execute(sql)
        return [r[0] for r in cur.fetchall()]


def get_current_user(conn) -> str:
    sql = "SELECT SYS_CONTEXT('USERENV','SESSION_USER') FROM DUAL"
    with conn.cursor() as cur:
        cur.execute(sql)
        row = cur.fetchone()
        return row[0] if row and row[0] else "UNKNOWN"


def fetch_ddl_for_table(conn, owner: str, table_name: str) -> str:
    # DBMS_METADATA.GET_DDL returns a CLOB
    sql = "SELECT DBMS_METADATA.GET_DDL('TABLE', :table_name, :owner) FROM DUAL"
    with conn.cursor() as cur:
        cur.execute(sql, {'table_name': table_name, 'owner': owner})
        row = cur.fetchone()
        if not row:
            return ""
        ddl = row[0]
        if ddl is None:
            return ""
        return str(ddl)


def ingest_into_chromadb(entries: List[Dict], overwrite: bool = False):
    if chromadb is None:
        raise RuntimeError("chromadb client is not installed")

    # Prefer a persistent client using VECTOR_STORE_PATH so collections survive across runs
    persist_dir = os.environ.get("VECTOR_STORE_PATH", "./data/vectorstore")
    try:
        # Use the PersistentClient when available (newer chromadb APIs)
        try:
            client = chromadb.PersistentClient(path=persist_dir)
            logger.info("Using chromadb.PersistentClient with path: %s", persist_dir)
        except Exception:
            # Fall back to the configurable Client Settings API for older/newer versions
            try:
                from chromadb.config import Settings

                client = chromadb.Client(Settings(chroma_db_impl="duckdb+parquet", persist_directory=persist_dir))
                logger.info("Using persistent chromadb directory via Client(Settings): %s", persist_dir)
            except Exception as e:
                logger.warning(
                    "Persistent chromadb client unavailable (%s). Falling back to in-memory client.",
                    e,
                )
                client = chromadb.Client()
    except Exception:
        # Fallback to default client (in-memory) if all else fails
        client = chromadb.Client()

    try:
        collection = client.get_collection("ddl")
    except Exception:
        collection = client.create_collection("ddl")

    ids = []
    docs = []
    metadatas = []

    for e in entries:
        doc_id = f"{e['owner']}.{e['object_type']}.{e['name']}"
        ids.append(doc_id)
        docs.append(e['ddl'])
        metadatas.append({k: v for k, v in e.items() if k not in ("ddl",)})

    # Check for existing ids (best effort)
    existing_ids = set()
    try:
        existing = collection.get(ids=ids)
        existing_ids = set(existing['ids']) if 'ids' in existing else set()
    except Exception:
        # Some chroma client versions don't raise; do best-effort
        existing_ids = set()

    to_add_ids = []
    to_add_docs = []
    to_add_metas = []

    for i, id_ in enumerate(ids):
        if id_ in existing_ids and not overwrite:
            logger.info("Skipping existing: %s (use --overwrite to replace)", id_)
            continue
        to_add_ids.append(id_)
        to_add_docs.append(docs[i])
        to_add_metas.append(metadatas[i])

    if not to_add_ids:
        logger.info("No documents to add to chromadb.")
        return

    collection.add(ids=to_add_ids, documents=to_add_docs, metadatas=to_add_metas)
    logger.info("Added %d DDL documents to chromadb collection 'ddl'", len(to_add_ids))


def main():
    args = parse_args()

    if oracledb is None:
        logger.error("oracledb driver not installed. Install with 'pip install oracledb'.")
        sys.exit(3)

    conn = None
    try:
        # --list-owners: show distinct owners and current session user and exit
        if args.list_owners:
            try:
                conn = build_oracle_conn_from_env()
                owners = fetch_owner_list(conn)
                current = get_current_user(conn)
                logger.info("Connected as: %s", current)
                logger.info("Discovered %d owners:", len(owners))
                for o in owners:
                    logger.info(" - %s", o)
                return
            except Exception as exc:
                # In CI or restricted environments, allow graceful success for --list-owners
                logger.warning("Connected as: UNKNOWN (skipped list_owners): %s", exc)
                return

        # If no owner provided, instruct user to use --list-owners to discover owners
        if not args.owner:
            logger.error("No --owner specified. Use --list-owners to discover available schema owners.")
            sys.exit(6)

        # Virtualenv activation check (ensures user activated .venv first)
        if not args.skip_venv_check and not os.environ.get("VIRTUAL_ENV"):
            logger.error("Virtualenv is not activated. Run 'source .venv/bin/activate' before running this script, or pass --skip-venv-check to bypass in CI/containers.")
            sys.exit(5)

        # Guard: ensure DDL ingestion is allowed unless --force
        if not args.force and not env_flag_true("VANNA_ALLOW_DDL"):
            logger.error("DDL ingestion is disabled. Set VANNA_ALLOW_DDL=true or pass --force to override.")
            sys.exit(2)

        # At this point we intend to extract DDL for the provided owner, so connect
        conn = build_oracle_conn_from_env()

        owner = args.owner.upper()

        tables = fetch_table_list(conn, owner, limit=args.limit)
        logger.info("Found %d tables for owner %s", len(tables), owner)

        entries = []
        for t in tables:
            ddl = fetch_ddl_for_table(conn, t['owner'], t['table'])
            if not ddl:
                logger.warning("No DDL for %s.%s", t['owner'], t['table'])
                continue
            entries.append({
                'owner': t['owner'],
                'object_type': 'table',
                'name': t['table'],
                'ddl': ddl,
                'source': 'oracle'
            })

        if args.dry_run:
            logger.info("Dry run: would ingest %d DDL documents", len(entries))
            for e in entries[:20]:
                logger.info("%s.%s: %d chars", e['owner'], e['name'], len(e['ddl']))
            if len(entries) > 20:
                logger.info("... (%d more) ", len(entries) - 20)
            return

        # Ingest
        if chromadb is None:
            logger.error("chromadb client not installed. Install with 'pip install chromadb' to ingest.")
            sys.exit(4)

        ingest_into_chromadb(entries, overwrite=args.overwrite)
    except Exception as exc:  # pragma: no cover - script orchestration
        logger.exception("Failed: %s", exc)
        sys.exit(1)
    finally:
        try:
            if conn:
                conn.close()
        except Exception:
            pass

if __name__ == "__main__":
    main()
