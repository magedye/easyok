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

try:
    import oracledb  # type: ignore
except Exception:
    oracledb = None

try:
    import chromadb
    from chromadb.utils import embedding_functions  # noqa: F401 - optional
except Exception:
    chromadb = None

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("ddl_extractor")


def env_flag_true(name: str) -> bool:
    v = os.environ.get(name, "false").lower()
    return v in ("1", "true", "yes", "on")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Extract Oracle DDL and ingest into vector store")
    p.add_argument("--owner", required=True, help="Oracle schema owner (e.g., HR)")
    p.add_argument("--limit", type=int, default=0, help="Limit number of objects to extract (0 = all)")
    p.add_argument("--dry-run", action="store_true", help="Do not write to vector store; only preview")
    p.add_argument("--overwrite", action="store_true", help="Overwrite existing docs in vector store")
    p.add_argument("--force", action="store_true", help="Bypass VANNA_ALLOW_DDL guard (use with care)")
    return p.parse_args()


def build_oracle_conn_from_env():
    """Build a connection using DB_* env vars or ORACLE_CONNECTION_STRING fallback."""
    if oracledb is None:
        raise RuntimeError("oracledb driver is not installed")

    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    host = os.environ.get("DB_HOST")
    port = os.environ.get("DB_PORT")
    service = os.environ.get("DB_NAME")

    conn_str = os.environ.get("ORACLE_CONNECTION_STRING")

    if user and password and host and port and service:
        dsn = oracledb.makedsn(host, int(port), service_name=service)
        return oracledb.connect(user=user, password=password, dsn=dsn)

    if conn_str:
        # Expected formats: oracle+oracledb://user:pass@host:port/service
        # Very light parsing — prefer explicit DB_* variables.
        try:
            import re

            m = re.search(r"(?P<user>[^:]+):(?P<pw>[^@]+)@(?P<host>[^:/]+):(?P<port>\d+)[/\\](?P<service>\S+)", conn_str)
            if m:
                user = m.group("user")
                password = m.group("pw")
                host = m.group("host")
                port = int(m.group("port"))
                service = m.group("service")
                dsn = oracledb.makedsn(host, port, service_name=service)
                return oracledb.connect(user=user, password=password, dsn=dsn)
        except Exception as exc:  # pragma: no cover - defensive
            raise RuntimeError(f"Failed parsing ORACLE_CONNECTION_STRING: {exc}")

    raise RuntimeError("Missing Oracle connection details; set DB_USER/DB_PASSWORD/DB_HOST/DB_PORT/DB_NAME or ORACLE_CONNECTION_STRING")


def fetch_table_list(conn, owner: str, limit: int = 0) -> List[Dict[str, str]]:
    sql = "SELECT OWNER, TABLE_NAME FROM ALL_TABLES WHERE OWNER = :owner ORDER BY TABLE_NAME"
    if limit and isinstance(limit, int) and limit > 0:
        sql = sql + f" FETCH FIRST {limit} ROWS ONLY"

    with conn.cursor() as cur:
        cur.execute(sql, [owner.upper()])
        rows = cur.fetchall()
        return [{"owner": r[0], "table": r[1]} for r in rows]


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

    # Guard: ensure DDL ingestion is allowed unless --force
    if not args.force and not env_flag_true("VANNA_ALLOW_DDL"):
        logger.error("DDL ingestion is disabled. Set VANNA_ALLOW_DDL=true or pass --force to override.")
        sys.exit(2)

    if oracledb is None:
        logger.error("oracledb driver not installed. Install with 'pip install oracledb'.")
        sys.exit(3)

    owner = args.owner.upper()

    conn = None
    try:
        conn = build_oracle_conn_from_env()
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
