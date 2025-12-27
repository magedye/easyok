#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import traceback
import pytest

from app.providers.database.oracle_provider import OracleProvider
from app.core.config import get_settings

try:
    import oracledb
except Exception as e:
    print("[ERROR] Cannot import oracledb. Install using: pip install oracledb")
    print("Details:", e)
    sys.exit(1)

# ============================================================
#  ORACLE CONFIG — MATCHES main_v11.py
# ============================================================

ORACLE_USER = "MAJED"
ORACLE_PASSWORD = "StrongPass123"
DB_ORACLE_DSN = "10.10.10.10:1521/XEPDB1"
ORACLE_SCHEMA = ORACLE_USER.upper()


# ============================================================
#  UTILITIES
# ============================================================

def fail(msg):
    print(f"[ERROR] {msg}")
    sys.exit(1)


def warn(msg):
    print(f"[WARN] {msg}")


def ok(msg):
    print(f"[OK] {msg}")


# ============================================================
#  CHECK ENVIRONMENT
# ============================================================

def check_env():
    print("\n=== Checking Oracle Configuration ===")
    if not ORACLE_USER:
        fail("Oracle user is missing.")
    if not ORACLE_PASSWORD:
        fail("Oracle password is missing.")
    if not DB_ORACLE_DSN:
        fail("Oracle DSN is missing.")

    ok(f"User: {ORACLE_USER}")
    ok(f"DSN: {DB_ORACLE_DSN}")


def check_dsn_format():
    print("\n=== Validating DSN Format ===")
    if ":" not in DB_ORACLE_DSN or "/" not in DB_ORACLE_DSN:
        fail("Invalid DSN format. Expected host:port/service_name")
    ok("DSN format looks correct.")


# ============================================================
#  ORACLE CONNECTION TEST
# ============================================================

def connect_oracle():
    print("\n=== Testing Oracle Connection ===")
    try:
        conn = oracledb.connect(
            user=ORACLE_USER,
            password=ORACLE_PASSWORD,
            dsn=DB_ORACLE_DSN
        )
        ok("Connection to Oracle established.")
        return conn
    except Exception:
        fail(f"Connection failed.\n{traceback.format_exc()}")


@pytest.fixture(scope="module")
def conn():
    """
    Provide a live Oracle connection using application settings.

    Skips tests gracefully if the driver or connection details are unavailable.
    """
    try:
        provider = OracleProvider(get_settings(force_reload=True))
        connection = provider.connect()
    except Exception as exc:
        pytest.skip(f"Oracle connection unavailable: {exc}")
    try:
        yield connection
    finally:
        try:
            connection.close()
        except Exception:
            pass


def test_basic_query(conn):
    print("\n=== Running Basic Query (SELECT 1 FROM DUAL) ===")
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM DUAL")
        ok(f"Query OK: {cur.fetchone()}")
    except Exception:
        fail(f"Query failed.\n{traceback.format_exc()}")


# ============================================================
#  TABLE DISCOVERY
# ============================================================

def list_tables(conn):
    print("\n=== Listing Schema Tables ===")
    try:
        cur = conn.cursor()
        cur.execute("SELECT table_name FROM user_tables ORDER BY table_name")
        tables = [r[0] for r in cur.fetchall()]

        if not tables:
            warn("No tables found in schema.")
            return []

        ok(f"Found {len(tables)} tables.")
        print("Sample:", tables[:10])
        return tables
    except Exception:
        fail(f"Cannot list tables.\n{traceback.format_exc()}")


def describe_table(conn, table):
    print(f"\n=== Describing Table: {table} ===")
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT column_name, data_type, nullable
            FROM user_tab_columns
            WHERE table_name=:tbl
            ORDER BY column_id
        """, {"tbl": table})

        rows = cur.fetchall()
        if not rows:
            warn(f"No metadata for {table}")
            return

        ok(f"{len(rows)} columns")
        for c in rows:
            print(f"- {c[0]} ({c[1]}) NULL={c[2]}")

    except Exception:
        fail(f"Cannot describe table {table}.\n{traceback.format_exc()}")


def test_metadata_all(conn):
    print("\n=== Metadata Extraction Test ===")
    tables = list_tables(conn)
    if not tables:
        return

    for table in tables[:5]:
        describe_table(conn, table)


# ============================================================
#  ORACLE SQL EXECUTION TEST (MATCHING VANNA STYLE)
# ============================================================

def test_sql_execution(conn):
    print("\n=== Testing SQL Execution (Oracle Dialect) ===")

    sample_table = None
    tables = list_tables(conn)
    if tables:
        sample_table = tables[0]
        ok(f"Testing table: {sample_table}")
    else:
        warn("No tables available. Skipping test.")
        return

    sql = f"SELECT * FROM {sample_table} FETCH FIRST 1 ROWS ONLY"

    try:
        cur = conn.cursor()
        cur.execute(sql)
        row = cur.fetchone()
        ok(f"Row fetched: {row}")
    except Exception:
        fail(f"Failed SQL execution.\n{traceback.format_exc()}")


# ============================================================
#  MAIN
# ============================================================

def main():
    print("\n============================================")
    print("   ORACLE DIAGNOSTIC TOOL — PROJECT VERSION")
    print("============================================")

    check_env()
    check_dsn_format()
    conn = connect_oracle()

    test_basic_query(conn)
    test_metadata_all(conn)
    test_sql_execution(conn)

    conn.close()
    print("\n============================================")
    ok("Oracle diagnostic completed successfully.")
    print("============================================")


if __name__ == "__main__":
    main()
