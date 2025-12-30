import json
import pathlib
import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent


@pytest.fixture(scope="session")
def ndjson_sample_ok():
    return [
        json.dumps({"type": "thinking", "trace_id": "t1", "timestamp": "2025-01-01T00:00:00Z"}),
        json.dumps({"type": "end", "trace_id": "t1", "timestamp": "2025-01-01T00:00:01Z"}),
    ]


@pytest.fixture(scope="session")
def ndjson_sample_error():
    return [
        json.dumps({"type": "thinking", "trace_id": "t2", "timestamp": "2025-01-01T00:00:00Z"}),
        json.dumps({
            "type": "error",
            "trace_id": "t2",
            "timestamp": "2025-01-01T00:00:00Z",
            "error_code": "POLICY_VIOLATION",
            "message": "forbidden",
            "lang": "en",
        }),
        json.dumps({"type": "end", "trace_id": "t2", "timestamp": "2025-01-01T00:00:01Z"}),
    ]


@pytest.fixture(scope="session")
def sample_policy_violation():
    return {
        "error_code": "POLICY_VIOLATION",
        "message": "forbidden table",
        "lang": "en",
    }


@pytest.fixture(scope="session")
def spec_paths():
    paths_file = ROOT / "openapi" / "paths.yaml"
    if paths_file.exists():
        content = paths_file.read_text(encoding="utf-8")
        return [line.strip().split(":")[0] for line in content.splitlines() if line.strip().startswith("/")]
    return []


@pytest.fixture(scope="session")
def fake_admin_context():
    return {"role": "admin", "user_id": "admin"}


@pytest.fixture(scope="session")
def fake_guest_context():
    return {"role": "guest", "user_id": "anonymous"}


@pytest.fixture(scope="session")
def local_bypass_settings():
    return {"ENV": "local", "ADMIN_LOCAL_BYPASS": "true"}
