#!/usr/bin/env python3
"""
One-time Oracle DDL training script for Vanna (Tier-2 only).

- Retrieves DDL from Oracle using a safe raw connection.
- Bypasses Vanna API layers and writes directly to ChromaDB.
- Ensures data is tagged correctly as 'ddl' for RAG retrieval.
"""

import os
import sys
import asyncio
import chromadb
from chromadb.config import Settings
from typing import List

# ─────────────────────────────────────────────
# Guards
# ─────────────────────────────────────────────

def require_env_flag():
    if os.getenv("VANNA_ALLOW_DDL", "").lower() != "true":
        print("❌ DDL training is disabled. Set VANNA_ALLOW_DDL=true to proceed.", file=sys.stderr)
        sys.exit(2)

def require_virtualenv():
    if not os.getenv("VIRTUAL_ENV"):
        print("❌ Virtualenv is not activated.", file=sys.stderr)
        sys.exit(5)

# ─────────────────────────────────────────────
# Bootstrap imports
# ─────────────────────────────────────────────

sys.path.append(os.getcwd())

# We strictly import config to get DB settings, we don't need the Service for this approach
from app.core.config import settings
from app.providers.factory import create_db_provider

# ─────────────────────────────────────────────
# Core logic
# ─────────────────────────────────────────────

def get_raw_connection():
    """Create a direct connection to handle LOB lifecycle manually."""
    provider = create_db_provider(settings)
    return provider.connect()

def train_to_chroma(table_name: str, ddl_text: str):
    """
    Directly inject DDL into ChromaDB, bypassing Vanna's strict ToolContext validation.
    """
    # 1. Initialize Chroma Client pointing to the EXACT same path as the app
    persist_path = "./data/vanna_memory"
    
    # Ensure directory exists
    os.makedirs(persist_path, exist_ok=True)
    
    client = chromadb.PersistentClient(path=persist_path)
    
    # 2. Get or Create the collection named 'vanna_memory' (standard Vanna name)
    collection = client.get_or_create_collection(name="vanna_memory")
    
    # 3. Add the DDL
    # Vanna searches for metadata={'type': 'ddl'} or just text similarity.
    # We add explicitly formatted metadata.
    collection.add(
        documents=[ddl_text],
        metadatas=[{"type": "ddl", "table": table_name, "source": "oracle_training"}],
        ids=[f"ddl_{table_name}"]
    )
    print(f"     ✅ DDL injected into ChromaDB (ID: ddl_{table_name})")

async def train():
    print("🚀 Initializing Training Sequence (Direct Injection Mode)")

    if settings.VANNA_MEMORY_TYPE != "chroma":
        print("❌ Error: VANNA_MEMORY_TYPE must be 'chroma' in .env")
        return

    print(f"🔌 Connecting to Oracle: {settings.ORACLE_DSN}")
    
    conn = None
    cursor = None
    
    try:
        conn = get_raw_connection()
        cursor = conn.cursor()
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return

    try:
        # 1. Get Tables
        print("🔍 Fetching table list...")
        cursor.execute("SELECT table_name FROM user_tables")
        tables = [row[0] for row in cursor.fetchall()]

        if not tables:
            print("⚠️ No tables found. Nothing to train.")
            return

        print(f"📦 Found {len(tables)} tables")

        # 2. Loop and Train
        for table in tables:
            print(f"→ Processing table: {table}")
            try:
                cursor.execute(
                    f"SELECT DBMS_METADATA.GET_DDL('TABLE', '{table}') FROM DUAL"
                )
                row = cursor.fetchone()
                
                if row:
                    lob_obj = row[0]
                    ddl_text = str(lob_obj) if lob_obj else ""
                    
                    if ddl_text:
                        print(f"   ✓ DDL fetched ({len(ddl_text)} chars). Injecting...")
                        # Direct Injection
                        train_to_chroma(table, ddl_text)
                    else:
                        print("   ⚠️ Empty DDL returned.")
            
            except Exception as exc:
                print(f"   ❌ Failed to train {table}: {exc}")

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("🔌 Database connection closed.")

    print("🎉 Training completed successfully")

# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    require_env_flag()
    require_virtualenv()
    asyncio.run(train())