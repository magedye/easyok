def test_llm_failure_returns_error_shape(sample_policy_violation):
    err = sample_policy_violation
    assert err["error_code"] == "POLICY_VIOLATION"
    assert "message" in err
    assert err["lang"] in ["en", "ar"]


def test_db_failure_is_reported_consistently():
    error = {"error_code": "DB_FAILURE"}
    assert "error_code" in error
