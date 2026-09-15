# [导读] 业务名词: Attempt 是一次训练记录; 场景是本次任务与约束; 正式提交会冻结内容以便评价和回
# [导读] 放。
# [导读] 用途: 回归验证登录、令牌刷新、退出和角色隔离。
# [导读] 为什么: 用可重复输入固定业务边界, 既检查成功结果, 也防止重试、权限或无效输入破坏已有行
# [导读] 为。
# [导读] 结构: 本文件有 3 个测试函数; 按各用例的准备、操作、断言顺序阅读, 公共夹具见
# [导读] tests/conftest.py。
# [导读] 提醒: 测试中的用户、令牌、案例和模型输出是测试数据; 通过这些用例不等于已验证真实外部模
# [导读] 型或线上环境。
from __future__ import annotations

import pytest
from conftest import TEST_PASSWORD
from fastapi.testclient import TestClient


def login(client: TestClient, role: str) -> dict[str, object]:
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": f"{role}@example.test", "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    return response.json()


def auth_header(token: object) -> dict[str, str]:
    assert isinstance(token, str)
    return {"Authorization": f"Bearer {token}"}


def test_invalid_credentials_do_not_reveal_account_existence(client: TestClient) -> None:
    wrong_password = client.post(
        "/api/v1/auth/login",
        json={"identifier": "student@example.test", "password": "wrong-password"},
    )
    unknown_user = client.post(
        "/api/v1/auth/login",
        json={"identifier": "nobody@example.test", "password": "wrong-password"},
    )
    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json()["error"]["code"] == "auth.invalid_credentials"
    assert wrong_password.json()["error"]["message"] == unknown_user.json()["error"]["message"]


@pytest.mark.parametrize("role", ["student", "teacher", "technician"])
def test_each_role_can_only_access_its_workspace(client: TestClient, role: str) -> None:
    tokens = login(client, role)
    headers = auth_header(tokens["access_token"])
    me = client.get("/api/v1/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["user"]["roles"] == [role]

    own_workspace = client.get(f"/api/v1/{role}/workspace", headers=headers)
    assert own_workspace.status_code == 200

    other_role = "teacher" if role != "teacher" else "student"
    forbidden = client.get(f"/api/v1/{other_role}/workspace", headers=headers)
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "auth.forbidden"


def test_refresh_rotates_tokens_and_logout_revokes_session(client: TestClient) -> None:
    first = login(client, "student")
    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert refreshed.status_code == 200
    second = refreshed.json()
    assert second["access_token"] != first["access_token"]
    assert second["refresh_token"] != first["refresh_token"]

    old_access = client.get("/api/v1/me", headers=auth_header(first["access_token"]))
    assert old_access.status_code == 401
    old_refresh = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert old_refresh.status_code == 401

    headers = auth_header(second["access_token"])
    logout = client.post("/api/v1/auth/logout", headers=headers)
    assert logout.status_code == 204
    assert client.get("/api/v1/me", headers=headers).status_code == 401
