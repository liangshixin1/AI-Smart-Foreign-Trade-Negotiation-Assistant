# [导读] 业务名词: Attempt 是一次训练记录; 场景是本次任务与约束; 正式提交会冻结内容以便评价和回
# [导读] 放。
# [导读] 用途: 回归验证应用健康检查、错误格式和跨域行为。
# [导读] 为什么: 用可重复输入固定业务边界, 既检查成功结果, 也防止重试、权限或无效输入破坏已有行
# [导读] 为。
# [导读] 结构: 本文件有 2 个测试函数; 按各用例的准备、操作、断言顺序阅读, 公共夹具见
# [导读] tests/conftest.py。
# [导读] 提醒: 测试中的用户、令牌、案例和模型输出是测试数据; 通过这些用例不等于已验证真实外部模
# [导读] 型或线上环境。
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
