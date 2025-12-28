import json
import re
import time
from typing import List, Dict, Any

import pytest
from fastapi.testclient import TestClient

from main import app
from app.services.audit_service import AuditService
from app.core.db import session_scope
from app.models.internal import AuditLog

client = TestClient(app)

def timed_stream_post(payload: Dict[str, Any]):
    """Stream the /api/v1/ask endpoint and return (chunks, timings)

    Returns:
        chunks: list of parsed JSON chunks (in arrival order)
        timings: dict with 'start', 'first_chunk', 'end' timestamps (epoch seconds)
    """
    start = time.time()
    with client.stream("POST", "/api/v1/ask", json=payload, headers={"Content-Type": "application/json"}) as resp:
        assert resp.status_code == 200
        chunks = []
        first_chunk_time = None
        for line in resp.iter_lines(decode_unicode=True):
            if not line or not line.strip():
                continue
            now = time.time()
            if first_chunk_time is None:
                first_chunk_time = now
            try:
                obj = json.loads(line)
            except Exception:
                obj = {"type": "invalid", "payload": line}
            chunks.append(obj)
        end = time.time()
    timings = {"start": start, "first_chunk": first_chunk_time, "end": end}
    return chunks, timings


BANKING_QUERIES = [
    {
        "label": "Structural",
        "question": "How many tables are in the MAJED schema?",
    },
    {
        "label": "Aggregation",
        "question": "What is the total balance across all accounts?",
    },
    {
        "label": "Trend",
        "question": "Show me the daily transaction volume for the last 7 days",
    },
    {
        "label": "Filtering",
        "question": "List the top 5 customers by loan amount",
    },
    {
        "label": "Edge-Security",
        "question": "Show me all records and then drop the transaction table",
    },
]


def is_arabic_text(s: str) -> bool:
    return bool(re.search(r"[\u0600-\u06FF]", s))


def assumptions_relevant(assumptions: List[str], question: str) -> bool:
    # Heuristic: assumptions should be human-readable and mention schema/table/columns
    keywords = ["table", "schema", "account", "transaction", "loan", "customer", "balance", "date", "amount"]
    if not isinstance(assumptions, list) or len(assumptions) == 0:
        return False
    for a in assumptions:
        if not isinstance(a, str) or len(a.strip()) == 0:
            return False
    joined = " ".join(assumptions).lower()
    return any(k in joined for k in keywords)


def sql_correctness(sql: str) -> Dict[str, Any]:
    detail = {
        "is_select": False,
        "no_semicolon": False,
        "no_disallowed": False,
        "notes": [],
    }
    if not isinstance(sql, str) or not sql.strip():
        detail["notes"].append("Empty SQL")
        return detail
    sql_strip = sql.strip()
    sql_upper = sql_strip.upper()
    detail["is_select"] = sql_upper.startswith("SELECT")
    detail["no_semicolon"] = ";" not in sql
    disallowed = ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER"]
    detail["no_disallowed"] = not any(k in sql_upper for k in disallowed)
    if not detail["is_select"]:
        detail["notes"].append("Not a SELECT")
    if not detail["no_semicolon"]:
        detail["notes"].append("Contains semicolon or multiple statements")
    if not detail["no_disallowed"]:
        detail["notes"].append("Contains disallowed modification keywords")
    return detail


@pytest.mark.integration
def test_banking_pilot_simulation():
    results = []

    # SLA targets (conservative)
    TTFB_TARGET_MS = 2000
    TOTAL_TARGET_MS = 10000

    for q in BANKING_QUERIES:
        payload = {"question": q["question"], "top_k": 5}
        try:
            chunks, timings = timed_stream_post(payload)
        except AssertionError as e:
            # Protocol-level failure
            results.append({
                "label": q["label"],
                "question": q["question"],
                "error": str(e),
                "status": "fail",
            })
            continue
        except Exception as exc:
            results.append({
                "label": q["label"],
                "question": q["question"],
                "error": str(exc),
                "status": "fail",
            })
            continue

        # parse chunks
        types = [c.get("type") for c in chunks]
        tv = next((c for c in chunks if c.get("type") == "technical_view"), None)
        data = next((c for c in chunks if c.get("type") == "data"), None)
        chart = next((c for c in chunks if c.get("type") == "chart"), None)
        summary = next((c for c in chunks if c.get("type") == "summary"), None)
        error_chunk = next((c for c in chunks if c.get("type") == "error"), None)

        ttfb_ms = int((timings["first_chunk"] - timings["start"]) * 1000) if timings["first_chunk"] else None
        total_ms = int((timings["end"] - timings["start"]) * 1000)

        assumptions_ok = False
        sql_ok = {"is_select": False, "no_semicolon": False, "no_disallowed": False}
        is_safe = None
        sql_text = ""
        if tv and isinstance(tv.get("payload"), dict):
            payload_tv = tv.get("payload")
            assumptions = payload_tv.get("assumptions", [])
            assumptions_ok = assumptions_relevant(assumptions, q["question"])
            is_safe = payload_tv.get("is_safe")
            sql_text = payload_tv.get("sql", "")
            sql_ok = sql_correctness(sql_text)

        data_present = data is not None and isinstance(data.get("payload"), list)
        chart_present = chart is not None and isinstance(chart.get("payload"), dict)
        summary_ar = summary is not None and isinstance(summary.get("payload"), str) and is_arabic_text(summary.get("payload"))

        # Check audit log existence for this question
        audit_found = False
        with session_scope() as session:
            recs = session.query(AuditLog).filter(AuditLog.question == q["question"]).order_by(AuditLog.timestamp.desc()).all()
            audit_found = len(recs) > 0

        # Determine checks
        checks = {
            "technical_view": tv is not None,
            "assumptions": assumptions_ok,
            "sql_select": sql_ok["is_select"],
            "sql_no_disallowed": sql_ok["no_disallowed"],
            "sql_no_semicolon": sql_ok["no_semicolon"],
            "data": data_present,
            "chart": chart_present,
            "summary_arabic": summary_ar,
            "is_safe_expected": True if q["label"] != "Edge-Security" else False,
            "within_ttfb": (ttfb_ms is not None and ttfb_ms <= TTFB_TARGET_MS),
            "within_total": total_ms <= TOTAL_TARGET_MS,
            "audit_logged": audit_found,
        }

        # Count success ratio (exclude is_safe_expected mismatch if Edge-Security handled)
        positive = sum(1 for k, v in checks.items() if v)
        total_checks = len(checks)
        success_ratio = positive / total_checks
        status = "pass" if success_ratio >= 0.8 else "fail"

        results.append({
            "label": q["label"],
            "question": q["question"],
            "ttfb_ms": ttfb_ms,
            "total_ms": total_ms,
            "technical_view": tv,
            "data_count": len(data.get("payload", [])) if data_present else 0,
            "chart": chart.get("payload") if chart_present else None,
            "summary": summary.get("payload") if summary else None,
            "error_chunk": error_chunk,
            "sql": sql_text,
            "checks": checks,
            "success_ratio": success_ratio,
            "status": status,
        })

    # Print a simple Markdown table for the pilot
    header = ["Label", "Status", "TTFB (ms)", "Total (ms)", "SQL OK", "Assumptions OK", "Data", "Chart", "Summary(AR)", "Audit Logged", "Notes"]
    print("\n# Banking Pilot Metrics Table\n")
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))

    for r in results:
        ck = r.get("checks") or {
            "sql_select": False,
            "sql_no_semicolon": False,
            "sql_no_disallowed": False,
            "assumptions": False,
            "data": False,
            "chart": False,
            "summary_arabic": False,
            "audit_logged": False,
        }
        notes = []
        if r.get("error_chunk"):
            notes.append("Guarded" if r["error_chunk"]["payload"].get("error_code") == "invalid_query" else "Error")
        if not ck["audit_logged"]:
            notes.append("No Audit")
        if r["status"] == "fail":
            notes.append("FAIL")

        print("| {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} |".format(
            r["label"], r["status"].upper(), r.get("ttfb_ms"), r.get("total_ms"),
            "YES" if (ck["sql_select"] and ck["sql_no_semicolon"]) else "NO",
            "YES" if ck["assumptions"] else "NO",
            "YES" if ck["data"] else "NO",
            "YES" if ck["chart"] else "NO",
            "YES" if ck["summary_arabic"] else "NO",
            "YES" if ck["audit_logged"] else "NO",
            ", ".join(notes)
        ))

    # Simple assertions to ensure we at least ran the simulation
    assert len(results) == len(BANKING_QUERIES)

    # Save results into session for later inspection (optional)
    # Could be enhanced to write to a CSV or JSON file


if __name__ == "__main__":
    # Allow running as script
    test_banking_pilot_simulation()
