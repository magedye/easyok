# EasyData Scripts Directory

**Organized for clarity, stability, and safety.**

All scripts are organized by lifecycle and intent. See categories below.

---

## Directory Structure

```
scripts/
├── dev/                          # Development & build utilities
│   └── generate-api.sh           # Generate OpenAPI SDK from spec
│
├── setup/                        # Environment configuration (non-operational)
│   └── configure_env.py          # Interactive .env editor [LEGACY]
│
├── verify/                       # Validation & diagnostics
│   ├── preflight.py              # Environment preflight check
│   └── sync_env.py               # Environment synchronization utility
│
└── oracle/                       # Oracle-specific utilities (FROZEN)
    ├── extract_and_ingest_ddl.py # Extract DDL & ingest to vector store
    └── README.md                 # Oracle DDL extraction guide
```

---

## Script Inventory & Safety Matrix

| Script | Category | Purpose | Safe Environment | Status | Notes |
|--------|----------|---------|------------------|--------|-------|
| `dev/generate-api.sh` | Development | Generate OpenAPI TypeScript SDK via codegen | Dev | ✅ Safe | Runs at build-time. Requires `frontend/openapi.json` |
| `setup/configure_env.py` | Setup | Interactive `.env` file editor | Dev | ⚠️ Legacy | Not actively used. Can be invoked for manual env setup. **Do not use in automation.** |
| `verify/preflight.py` | Validation | Verify environment readiness | Dev/Ops | ✅ Safe | Pre-flight validation. Can be run before startup. |
| `verify/sync_env.py` | Validation | Synchronize environment variables | Dev/Ops | ✅ Safe | Adjacent to preflight. **Not consolidated.** Each tool has distinct purpose. |
| `oracle/extract_and_ingest_ddl.py` | Operations | Extract Oracle DDL → ingest ChromaDB | Dev/Ops | 🔴 Frozen | **CI/Test-bound (hardcoded paths in test suite).** Path: `scripts/oracle/extract_and_ingest_ddl.py` — IMMUTABLE. |

---

## Quick Reference: Running Scripts

### 1. Generate OpenAPI SDK
```bash
# Regenerate TypeScript client from updated OpenAPI spec
bash scripts/dev/generate-api.sh
```
**Output**: `frontend/src/api/generated/`

---

### 2. Configure Environment (Manual)
```bash
# Interactive .env editor (legacy path)
python scripts/setup/configure_env.py
```
**Note**: This is a legacy utility. For new deployments, edit `.env.example` directly.

---

### 3. Preflight Environment Check
```bash
# Validate environment before startup
python scripts/verify/preflight.py
```
**Output**: Validation report (success/failure of env vars, paths, credentials)

---

### 4. Synchronize Environment
```bash
# Sync environment variables (validation-adjacent)
python scripts/verify/sync_env.py
```
**Note**: Complements `preflight.py`. Independent purpose.

---

### 5. Extract Oracle DDL
```bash
# Extract DDL from Oracle schema and ingest into ChromaDB vector store
# Dry-run (safe preview):
VANNA_ALLOW_DDL=true python scripts/oracle/extract_and_ingest_ddl.py --owner HR --dry-run

# Actual ingest (requires explicit env flag or --force):
VANNA_ALLOW_DDL=true python scripts/oracle/extract_and_ingest_ddl.py --owner HR --overwrite
```
**Details**: See `scripts/oracle/README.md`

---

## Safety Warnings

### ⚠️ **DO NOT**
- ❌ Rename or move scripts referenced in tests (e.g., `scripts/oracle/extract_and_ingest_ddl.py`)
- ❌ Change `scripts/oracle/` directory name or location
- ❌ Modify script content in ways that break invocation contracts
- ❌ Use `configure_env.py` in automated deployments (legacy only)

### ✅ **OK TO DO**
- ✅ Run any `dev/` script locally during development
- ✅ Run `verify/` scripts before operational startup
- ✅ Call `oracle/extract_and_ingest_ddl.py` from docs examples or tests
- ✅ Invoke `scripts/dev/generate-api.sh` as part of build pipeline

---

## Immutable Reference (CI-Bound)

The following script paths are **hardcoded in tests/CI and cannot be changed**:

| Script | Hardcoded Path | Referenced By |
|--------|----------------|---------------|
| `extract_and_ingest_ddl.py` | `scripts/oracle/extract_and_ingest_ddl.py` | `tests/test_oracle_ddl_extractor.py` (5 refs), README.md, docs/ |

**Any move of the above requires test file edits** (out of scope for scripts hygiene phase).

---

## Development Notes

### Adding New Scripts
- Store in appropriate category directory (`dev/`, `setup/`, `verify/`, `ops/`)
- Update this README with script entry and usage example
- Document safety constraints (if any)
- Avoid hardcoding paths; use relative imports where possible

### Deprecating Scripts
- Mark as `[LEGACY]` in inventory table
- Keep in place for backward compatibility (minimum 1 release)
- Document replacement/alternative in notes
- Example: `configure_env.py` is legacy; use manual `.env` editing instead

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Safe to use/move |
| ⚠️ | Use with caution (legacy, edge cases) |
| 🔴 | Frozen (CI-bound, immutable path) |
| ℹ️ | Informational |

---

## Related Documentation

- **Backend Setup**: `README.md` (root)
- **Oracle DDL Training**: `docs/quickstarts/ddl_extraction.md`, `docs/refrence/training-guide.md`
- **Operational Runbook**: `Operational_Verification_Runbook.md`
- **Environment Contract**: `EasyData-Env-Contract-v16.7.md`

---

**Last Updated**: 2025-01-10 (ESHA Phase 2)  
**Maintainer**: Scripts Hygiene Agent (ESHA)
