from urllib.parse import quote

from fastapi.responses import Response

from app.modules.knowledge_graph.models import KnowledgeContentAsset


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
