from fastapi.testclient import TestClient


def test_health_and_request_id(client: TestClient) -> None:
    response = client.get("/health", headers={"X-Request-Id": "test-request"})
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["X-Request-Id"] == "test-request"


def test_validation_uses_stable_error_shape(client: TestClient) -> None:
    response = client.post("/api/v1/auth/login", json={"identifier": ""})
    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "request.validation_failed"
    assert body["retryable"] is False
    assert body["request_id"]
