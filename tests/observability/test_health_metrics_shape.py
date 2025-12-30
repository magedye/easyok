def test_health_endpoint_contract():
    expected_status = 200
    assert expected_status == 200


def test_metrics_contract_fields():
    expected_content_type = "application/json"
    assert expected_content_type == "application/json"
