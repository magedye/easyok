def test_stream_must_start_with_thinking(ndjson_sample_ok):
    first = ndjson_sample_ok[0]
    assert '"type": "thinking"' in first


def test_stream_must_end_with_end(ndjson_sample_ok):
    last = ndjson_sample_ok[-1]
    assert '"type": "end"' in last


def test_error_flow_has_no_chunks_after_error(ndjson_sample_error):
    types = [
        "error" if '"type": "error"' in c else "end" if '"type": "end"' in c else "thinking"
        for c in ndjson_sample_error
    ]
    assert types[0] == "thinking"
    assert types[-1] == "end"
    if "error" in types:
        err_idx = types.index("error")
        assert all(t != "data" for t in types[err_idx + 1 : -1])
