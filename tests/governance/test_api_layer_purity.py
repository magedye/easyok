import os
import re

API_DIR = "app/api"
FORBIDDEN = [
    r"\bSQLGuard\b",
    r"\bSchemaPolicyService\b",
    r"\bgenerate_sql\b",
    r"\binject_rls_filters\b",
    r"\bOPENAI_MODEL\b",
    r"\bLLM_PROVIDER\b",
]


def test_api_layer_has_no_forbidden_symbols():
    violations = []
    for root, _, files in os.walk(API_DIR):
        for f in files:
            if not f.endswith(".py"):
                continue
            path = os.path.join(root, f)
            with open(path, encoding="utf-8") as fh:
                text = fh.read()
            for pat in FORBIDDEN:
                if re.search(pat, text):
                    violations.append((path, pat))
    assert not violations, f"Found forbidden symbols in API layer: {violations}"
