# Issue Brief — Schema-Aware Training Failure (DDL Missing)

**Status:** Confirmed – Architectural Gap

**Severity:** High (Functional correctness & trust impact)

---

## 1. Problem Description (Root Cause Analysis)

### Symptom

When a schema-level question is asked, e.g.:

> **“How many tables do you have?”**

The system responds with non-informative placeholders such as:

```
result: ok
summary: ok
```

Without returning:

* a generated SQL query
* a numeric result
* or meaningful chart data

---

## 2. Root Cause (Technical)

The issue is **not** related to:

* Oracle connectivity
* FastAPI routing
* Frontend rendering

### Actual Root Cause

**Missing DDL (Schema) knowledge in the AI layer.**

Specifically:

* The system has **not been trained on database DDL**
* Consequently, the LLM + Vanna engine **does not know**:

  * what tables exist
  * how many tables exist
  * which Oracle system views to query (`USER_TABLES`, `ALL_TABLES`, etc.)

> ⚠️ **Vanna does not introspect the database automatically.**
> It only reasons over what is explicitly stored in the vector store.

---

## 3. Architectural Truth (Non-Negotiable)

> **DDL training is mandatory, not optional.**

Without DDL:

* The model is blind to schema structure
* Any schema-related question will:

  * fail silently
  * return placeholders
  * or hallucinate answers

---

## 4. Relevant Existing Functions (Verified Correct)

The backend already exposes the correct primitives:

### A. DDL Injection (Required)

```python
def add_ddl(self, ddl: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
```

* Stores DDL in **ChromaDB**
* Collection: `ddl`

### B. Question–SQL Pairs (Secondary)

```python
def add_question_sql_pair(...)
```

* Useful **only after** DDL exists

---

## 5. What Went Wrong in the Current Flow

* The **Training UI** was primarily used for:

  * Question + SQL pairs
* **DDL was never injected**
* Result:

  * Schema-level questions cannot be answered
  * Queries like `COUNT(TABLES)` cannot be inferred

---

## 6. Approved Solutions (Implementation Paths)

### ✅ Solution 1 — Mandatory DDL Training Phase (Recommended)

**Before enabling any “Ask” functionality:**

1. Extract Oracle schema DDL
2. Inject via `add_ddl()`
3. Persist in the vector store

**Oracle Example**

```sql
SELECT DBMS_METADATA.GET_DDL('TABLE', table_name, owner)
FROM all_tables
WHERE owner = 'TARGET_SCHEMA';
```

**Injection**

```python
vanna.add_ddl(
    ddl=ddl_text,
    metadata={
        "schema": "HR",
        "source": "oracle",
        "object_type": "table"
    }
)
```

**Enables correct answers for:**

* how many tables
* list tables
* column discovery
* joins
* aggregations

---

### ✅ Solution 2 — Dedicated DDL Training Endpoint

Create an explicit endpoint:

```
POST /training/ddl
```

Payload:

```json
{
  "ddl": "CREATE TABLE ...",
  "schema": "HR"
}
```

Purpose:

* Eliminate ambiguity with question/SQL training
* Enforce correct routing to `add_ddl()`

---

### ⚙️ Solution 3 — Auto-Bootstrap DDL (Optional / Advanced)

On first startup:

* Connect to Oracle (read-only)
* Extract schema metadata
* Automatically call `add_ddl()`

**Constraints**

* Disabled by default
* Explicitly enabled via config
* Fully logged

---

### 🚧 Solution 4 — Guardrail in Ask Flow (Strongly Required)

If **no DDL exists** in the vector store:

* Block schema-level questions
* Return an explicit error

**Recommended Response**

```json
{
  "status": "error",
  "error_code": "SCHEMA_NOT_TRAINED",
  "message": "Schema not trained. Please upload DDL before asking schema-level questions."
}
```

Purpose:

* Prevent misleading “ok” responses
* Fail loudly and correctly

---

## 7. Verification Checklist (Post-Fix)

All items below **must pass** after implementation:

| Question           | Expected Behavior                    |
| ------------------ | ------------------------------------ |
| list tables        | SQL generated + table names returned |
| how many tables    | `COUNT(*)` SQL + numeric result      |
| describe employees | columns inferred from DDL            |
| join tables        | correct join keys inferred           |

---

## 8. Final Directive to the Agent (Binding)

1. **Treat DDL as a first-class training artifact**
2. **Never rely on live DB introspection**
3. **Do not answer schema questions without DDL**
4. **Ensure DDL is routed to `add_ddl()` only**
5. **Fail explicitly if schema is missing**

---

### Implementation Priority

1. **Solution 4 (Guardrail)** — immediate
2. **Solution 2 (DDL endpoint)** — short term
3. **Solution 1 / 3 (DDL training / bootstrap)** — structural completion

---

**This document is authoritative.**
Any deviation must be justified with an architectural decision record (ADR).


*Sealed & Approved: easyok core architecture team*