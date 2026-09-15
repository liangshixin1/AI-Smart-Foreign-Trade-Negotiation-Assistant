# [导读] 业务名词: 图谱连接阶段、现象、知识和策略; Scaffold 是本次训练固定支持库, PI 十阶段是项
# [导读] 目采用的贸易流程分类。
# [导读] 用途: 回归验证阶段、现象和知识节点独立内容及草稿可见性。
# [导读] 为什么: 用可重复输入固定业务边界, 既检查成功结果, 也防止重试、权限或无效输入破坏已有行
# [导读] 为。
# [导读] 结构: 本文件有 1 个测试函数; 按各用例的准备、操作、断言顺序阅读, 公共夹具见
# [导读] tests/conftest.py。
# [导读] 提醒: 测试中的用户、令牌、案例和模型输出是测试数据; 通过这些用例不等于已验证真实外部模
# [导读] 型或线上环境。
from fastapi.testclient import TestClient
from test_auth import auth_header, login
from test_knowledge_graph_v2 import _minimal_pptx
from test_knowledge_graph_v3 import _publish_v3


def test_stage_and_phenomenon_have_independent_content_and_assets(client: TestClient) -> None:
    teacher, _ = _publish_v3(client)
    student = auth_header(login(client, "student")["access_token"])
    root = "/api/v1/knowledge-graph"
    for key, kind in [("stage:S1", "Stage"), ("phenomenon:P1.01", "Phenomenon")]:
        endpoint = f"{root}/teacher/content/{key}"
        public = f"{root}/student/content/{key}"
        initial = client.get(endpoint, headers=teacher)
        assert initial.status_code == 200, initial.text
        assert initial.json()["node_type"] == kind
        assert initial.json()["title"] != key
        assert initial.json()["status"] == "draft"
        assert client.get(public, headers=student).status_code == 404
        payload = dict(
            title=f"{kind} lesson", summary=kind, markdown_body=f"## {kind}", status="draft"
        )
        assert client.put(endpoint, headers=student, json=payload).status_code == 403
        assert client.put(endpoint, headers=teacher, json=payload).status_code == 200
        ppt = _minimal_pptx()
        uploaded = client.put(
            f"{endpoint}/assets/slides",
            headers={**teacher, "X-File-Name": f"{kind}.pptx"},
            content=ppt,
        )
        assert uploaded.status_code == 200, uploaded.text
        assert client.get(f"{public}/assets/slides", headers=student).status_code == 404
        video = b"\x00\x00\x00\x18ftypisom" + kind.encode()
        assert (
            client.put(
                f"{endpoint}/assets/video",
                headers={**teacher, "X-File-Name": f"{kind}.mp4"},
                content=video,
            ).status_code
            == 200
        )
        assert (
            client.put(
                endpoint, headers=teacher, json={**payload, "status": "published"}
            ).status_code
            == 200
        )
        assert client.get(public, headers=student).json()["markdown_body"] == f"## {kind}"
        assert client.get(f"{public}/assets/slides", headers=student).content == ppt
        assert client.get(f"{public}/assets/video", headers=student).content == video
        event = dict(event_type="completed", source="map", client_event_id=f"completed-{kind}-0001")
        recorded = client.post(f"{public}/activities", headers=student, json=event)
        assert recorded.status_code == 201, recorded.text
        assert recorded.json()["node_type"] == kind
        assert (
            client.post(f"{public}/activities", headers=student, json=event).json()["id"]
            == recorded.json()["id"]
        )
    stage = client.get(f"{root}/student/content/stage:S1", headers=student).json()
    assert stage["title"] == "Stage lesson"
    assert (
        client.delete(
            f"{root}/teacher/content/phenomenon:P1.01/assets/slides", headers=teacher
        ).status_code
        == 200
    )
    assert (
        client.get(f"{root}/student/content/stage:S1/assets/slides", headers=student).status_code
        == 200
    )
