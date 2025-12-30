import json


def test_error_chunk_shape(ndjson_sample_error):
    err = json.loads(ndjson_sample_error[1])
    assert set(["type", "trace_id", "timestamp", "error_code", "message", "lang"]).issubset(err.keys())
    assert err["type"] == "error"
    assert err["lang"] in ["en", "ar"]


def test_base_chunk_fields(ndjson_sample_ok):
    chunk = json.loads(ndjson_sample_ok[0])
    for field in ("type", "trace_id", "timestamp"):
        assert field in chunk
