# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途与原因: 以内联、禁止缓存的响应发送受控视频或 PPTX; 权限已由内容服务检查, 避免浏览器
# [导读] 长期缓存私有教学附件。
# [导读] 结构: learning_asset_response。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
from urllib.parse import quote

from fastapi.responses import Response

from app.modules.knowledge_graph.models import KnowledgeContentAsset


# [导读] 在返回文件时设置内联和禁缓存头; 受控资源不应被浏览器或代理长期复用而绕过后续权限变化。
def learning_asset_response(asset: KnowledgeContentAsset) -> Response:
    """以内联且禁缓存的方式返回受控教学媒体。"""

    filename = quote(asset.filename)
    return Response(
        content=asset.content,
        media_type=asset.content_type,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{filename}",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
