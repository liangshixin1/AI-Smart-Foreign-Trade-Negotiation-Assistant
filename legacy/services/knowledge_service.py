"""Enhanced knowledge point management service for the knowledge graph.

This service provides:
1. CRUD operations for knowledge points with enhanced attributes
2. Knowledge category management
3. Knowledge point classification and relationships
4. Batch import from Excel/CSV
5. Search and filtering
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, List, Optional, Sequence

from services import graph_service

LOGGER = logging.getLogger(__name__)


def _to_iso(dt):
    """Convert Neo4j temporal values to ISO strings for JSON serialization."""
    try:
        if hasattr(dt, "isoformat"):
            return dt.isoformat()
    except Exception:
        return dt
    return dt


# ============================================
# 枚举定义
# ============================================

KNOWLEDGE_TYPES = {
    "concept": "概念型",
    "skill": "技能型",
    "document": "文档型",
    "case": "案例型",
    "tool": "工具型",
    "theory": "理论型",
    "regulation": "法规型",
}

DIFFICULTY_LEVELS = {
    "beginner": "初级",
    "intermediate": "中级",
    "advanced": "高级",
}

IMPORTANCE_LEVELS = {
    "required": "必修",
    "recommended": "推荐",
    "optional": "选修",
}


# ============================================
# 知识点CRUD操作
# ============================================

def create_knowledge_point(
    name: str,
    *,
    category: Optional[str] = None,
    type: str = "concept",
    lex_role: str = "",
    difficulty: str = "intermediate",
    importance: str = "recommended",
    summary: str = "",
    description: str = "",
    keywords: Optional[List[str]] = None,
    tags: Optional[List[str]] = None,
    estimated_minutes: int = 15,
    image_url: str = "",
    video_url: str = "",
    document_url: str = "",
    external_url: str = "",
    created_by: str = "system",
) -> Dict[str, object]:
    """创建新的知识点"""
    driver = graph_service._get_driver()

    query = """
    MERGE (k:KnowledgePoint {name: $name})
    SET k.code = COALESCE(k.code, $code),
        k.category = $category,
        k.type = $type,
        k.lex_role = $lex_role,
        k.difficulty = $difficulty,
        k.importance = $importance,
        k.summary = $summary,
        k.description = $description,
        k.keywords = $keywords,
        k.tags = $tags,
        k.estimatedMinutes = $estimatedMinutes,
        k.imageUrl = $imageUrl,
        k.videoUrl = $videoUrl,
        k.documentUrl = $documentUrl,
        k.externalUrl = $externalUrl,
        k.viewCount = COALESCE(k.viewCount, 0),
        k.practiceCount = COALESCE(k.practiceCount, 0),
        k.createdAt = COALESCE(k.createdAt, datetime()),
        k.updatedAt = datetime(),
        k.createdBy = $createdBy,
        k.version = COALESCE(k.version, 1)
    RETURN k
    """

    # 生成编码（如果没有）
    code = _generate_knowledge_code(name, category or "uncategorized")

    with driver.session() as session:
        result = session.run(query, {
            "name": name,
            "code": code,
            "category": category or "uncategorized",
            "type": type,
            "lex_role": lex_role,
            "difficulty": difficulty,
            "importance": importance,
            "summary": summary,
            "description": description,
            "keywords": keywords or [],
            "tags": tags or [],
            "estimatedMinutes": estimated_minutes,
            "imageUrl": image_url,
            "videoUrl": video_url,
            "documentUrl": document_url,
            "externalUrl": external_url,
            "createdBy": created_by,
        })
        record = result.single()
        if not record:
            raise RuntimeError(f"Failed to create knowledge point: {name}")

        # 如果指定了分类，创建关系
        if category and category != "uncategorized":
            _link_to_category(session, name, category, created_by)

        return _format_knowledge_point(record["k"])


def update_knowledge_point(
    name: str,
    **kwargs
) -> Optional[Dict[str, object]]:
    """更新知识点信息"""
    driver = graph_service._get_driver()

    allowed_fields = [
        "category", "type", "lex_role",
        "difficulty", "importance",
        "summary", "description", "keywords", "tags",
        "estimatedMinutes", "imageUrl", "videoUrl",
        "documentUrl", "externalUrl"
    ]

    updates = []
    params = {"name": name}

    for field, value in kwargs.items():
        if field in allowed_fields and value is not None:
            neo4j_field = field[0].lower() + field[1:]  # camelCase
            updates.append(f"k.{neo4j_field} = ${field}")
            params[field] = value

    if not updates:
        return get_knowledge_point(name)

    updates.append("k.updatedAt = datetime()")
    updates.append("k.version = k.version + 1")

    query = f"""
    MATCH (k:KnowledgePoint {{name: $name}})
    SET {', '.join(updates)}
    RETURN k
    """

    with driver.session() as session:
        result = session.run(query, params)
        record = result.single()
        if not record:
            return None

        # 如果更新了分类，更新关系
        if "category" in kwargs and kwargs["category"]:
            _link_to_category(session, name, kwargs["category"], "update")

        return _format_knowledge_point(record["k"])


def get_knowledge_point(name: str) -> Optional[Dict[str, object]]:
    """获取单个知识点详情"""
    driver = graph_service._get_driver()

    query = """
    MATCH (k:KnowledgePoint {name: $name})
    OPTIONAL MATCH (k)-[:BELONGS_TO]->(c:KnowledgeCategory)
    OPTIONAL MATCH (k)-[:REQUIRES]->(prereq:KnowledgePoint)
    OPTIONAL MATCH (k)-[rel:RELATES_TO]-(related:KnowledgePoint)
    RETURN k,
           c.name AS categoryName,
           collect(DISTINCT prereq.name) AS prerequisites,
           collect(DISTINCT {
               name: related.name,
               type: COALESCE(rel.relationType, 'related'),
               strength: COALESCE(rel.strength, 0.5)
           }) AS related
    """

    with driver.session() as session:
        result = session.run(query, {"name": name})
        record = result.single()
        if not record:
            return None

        point = _format_knowledge_point(record["k"])
        point["categoryName"] = record["categoryName"]
        point["prerequisites"] = [p for p in record["prerequisites"] if p]
        point["related"] = [r for r in record["related"] if r.get("name")]

        return point


def delete_knowledge_point(name: str) -> bool:
    """删除知识点（软删除，保留关系）"""
    driver = graph_service._get_driver()

    query = """
    MATCH (k:KnowledgePoint {name: $name})
    DETACH DELETE k
    RETURN count(k) AS deleted
    """

    with driver.session() as session:
        result = session.run(query, {"name": name})
        record = result.single()
        return record and record["deleted"] > 0


def list_knowledge_points(
    *,
    category: Optional[str] = None,
    type: Optional[str] = None,
    difficulty: Optional[str] = None,
    importance: Optional[str] = None,
    keyword: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[Dict[str, object]]:
    """列出知识点（支持过滤）"""
    driver = graph_service._get_driver()

    conditions = []
    params: Dict[str, object] = {"limit": limit, "offset": offset}

    if category:
        conditions.append("k.category = $category")
        params["category"] = category

    if type:
        conditions.append("k.type = $type")
        params["type"] = type

    if difficulty:
        conditions.append("k.difficulty = $difficulty")
        params["difficulty"] = difficulty

    if importance:
        conditions.append("k.importance = $importance")
        params["importance"] = importance

    if keyword:
        conditions.append(
            "(k.name CONTAINS $keyword OR k.summary CONTAINS $keyword OR "
            "any(tag IN k.tags WHERE tag CONTAINS $keyword))"
        )
        params["keyword"] = keyword

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    query = f"""
    MATCH (k:KnowledgePoint)
    {where_clause}
    OPTIONAL MATCH (k)-[:BELONGS_TO]->(c:KnowledgeCategory)
    OPTIONAL MATCH (k)<-[:TESTS]-(p:Practice)
    OPTIONAL MATCH (k)<-[:EXPLAINS]-(l:TheoryLesson)
    RETURN k,
           c.name AS categoryName,
           count(DISTINCT p) AS practiceCount,
           count(DISTINCT l) AS lessonCount
    ORDER BY k.importance DESC, k.difficulty, k.name
    SKIP $offset
    LIMIT $limit
    """

    with driver.session() as session:
        result = session.run(query, params)
        points = []
        for record in result:
            point = _format_knowledge_point(record["k"])
            point["categoryName"] = record["categoryName"]
            point["practiceCount"] = record["practiceCount"]
            point["lessonCount"] = record["lessonCount"]
            points.append(point)
        return points


# ============================================
# 知识分类管理
# ============================================

def create_knowledge_category(
    id: str,
    name: str,
    *,
    code: str = "",
    level: int = 1,
    order_index: int = 0,
    icon: str = "📁",
    color: str = "#6B7280",
    description: str = "",
    parent_id: Optional[str] = None,
) -> Dict[str, object]:
    """创建知识分类"""
    driver = graph_service._get_driver()

    query = """
    MERGE (c:KnowledgeCategory {id: $id})
    SET c.name = $name,
        c.code = $code,
        c.level = $level,
        c.orderIndex = $orderIndex,
        c.icon = $icon,
        c.color = $color,
        c.description = $description,
        c.isActive = true,
        c.createdAt = COALESCE(c.createdAt, datetime()),
        c.updatedAt = datetime()
    RETURN c
    """

    with driver.session() as session:
        result = session.run(query, {
            "id": id,
            "name": name,
            "code": code,
            "level": level,
            "orderIndex": order_index,
            "icon": icon,
            "color": color,
            "description": description,
        })
        record = result.single()
        if not record:
            raise RuntimeError(f"Failed to create category: {id}")

        # 如果有父分类，创建关系
        if parent_id:
            _link_category_parent(session, id, parent_id, order_index)

        return _format_category(record["c"])


def list_knowledge_categories(
    *,
    level: Optional[int] = None,
    parent_id: Optional[str] = None,
) -> List[Dict[str, object]]:
    """列出知识分类"""
    driver = graph_service._get_driver()

    conditions = ["c.isActive = true"]
    params: Dict[str, object] = {}

    if level is not None:
        conditions.append("c.level = $level")
        params["level"] = level

    if parent_id:
        query = """
        MATCH (parent:KnowledgeCategory {id: $parentId})-[:PARENT_OF]->(c:KnowledgeCategory)
        WHERE c.isActive = true
        RETURN c
        ORDER BY c.orderIndex, c.name
        """
        params["parentId"] = parent_id
    else:
        where_clause = " AND ".join(conditions)
        query = f"""
        MATCH (c:KnowledgeCategory)
        WHERE {where_clause}
        OPTIONAL MATCH (c)-[:PARENT_OF]->(child:KnowledgeCategory)
        WITH c, count(child) AS childCount
        RETURN c, childCount
        ORDER BY c.level, c.orderIndex, c.name
        """

    with driver.session() as session:
        result = session.run(query, params)
        categories = []
        for record in result:
            category = _format_category(record["c"])
            if not parent_id and "childCount" in record.keys():
                category["childCount"] = record["childCount"]
            categories.append(category)
        return categories


def get_category_tree() -> List[Dict[str, object]]:
    """获取完整的分类树"""
    # 获取所有一级分类
    root_categories = list_knowledge_categories(level=1)

    # 递归获取子分类
    for category in root_categories:
        category["children"] = list_knowledge_categories(parent_id=category["id"])

        # 获取三级分类（如果需要）
        for child in category["children"]:
            child["children"] = list_knowledge_categories(parent_id=child["id"])

    return root_categories


# ============================================
# 知识点关系管理
# ============================================

def add_knowledge_prerequisite(
    knowledge_name: str,
    prerequisite_name: str,
    *,
    is_strict: bool = True,
    reason: str = "",
) -> bool:
    """添加前置依赖关系"""
    driver = graph_service._get_driver()

    query = """
    MATCH (k:KnowledgePoint {name: $name})
    MATCH (prereq:KnowledgePoint {name: $prereqName})
    MERGE (k)-[r:REQUIRES]->(prereq)
    SET r.isStrict = $isStrict,
        r.reason = $reason,
        r.createdAt = COALESCE(r.createdAt, datetime())
    RETURN r
    """

    with driver.session() as session:
        result = session.run(query, {
            "name": knowledge_name,
            "prereqName": prerequisite_name,
            "isStrict": is_strict,
            "reason": reason,
        })
        return result.single() is not None


def add_knowledge_relation(
    knowledge_name1: str,
    knowledge_name2: str,
    *,
    relation_type: str = "similar",
    strength: float = 0.5,
    description: str = "",
) -> bool:
    """添加知识点关联关系"""
    driver = graph_service._get_driver()

    query = """
    MATCH (k1:KnowledgePoint {name: $name1})
    MATCH (k2:KnowledgePoint {name: $name2})
    MERGE (k1)-[r:RELATES_TO]-(k2)
    SET r.relationType = $relationType,
        r.strength = $strength,
        r.description = $description,
        r.createdAt = COALESCE(r.createdAt, datetime())
    RETURN r
    """

    with driver.session() as session:
        result = session.run(query, {
            "name1": knowledge_name1,
            "name2": knowledge_name2,
            "relationType": relation_type,
            "strength": strength,
            "description": description,
        })
        return result.single() is not None


# ============================================
# 批量导入
# ============================================

def batch_import_knowledge_points(
    points: Sequence[Dict[str, object]],
    *,
    created_by: str = "import",
) -> Dict[str, int]:
    """批量导入知识点"""
    created = 0
    updated = 0
    errors = []

    for point_data in points:
        try:
            name = point_data.get("name")
            if not name:
                errors.append("Missing name field")
                continue

            # 检查是否已存在
            existing = get_knowledge_point(name)

            if existing:
                # 更新
                update_knowledge_point(name, **point_data)
                updated += 1
            else:
                # 创建
                create_knowledge_point(name, created_by=created_by, **point_data)
                created += 1

        except Exception as e:
            LOGGER.error(f"Failed to import knowledge point: {e}")
            errors.append(str(e))

    return {
        "created": created,
        "updated": updated,
        "errors": len(errors),
        "errorMessages": errors[:10],  # 最多返回10条错误
    }


# ============================================
# 辅助函数
# ============================================

def _generate_knowledge_code(name: str, category: str) -> str:
    """生成知识点编码"""
    category_prefix = category[:2].upper() if category else "KP"
    # 简单hash生成
    hash_val = sum(ord(c) for c in name) % 1000
    return f"{category_prefix}-{hash_val:03d}"


def _link_to_category(session, knowledge_name: str, category_id: str, assigned_by: str):
    """将知识点关联到分类"""
    query = """
    MATCH (k:KnowledgePoint {name: $name})
    MATCH (c:KnowledgeCategory {id: $categoryId})
    MERGE (k)-[r:BELONGS_TO]->(c)
    SET r.assignedAt = datetime(),
        r.assignedBy = $assignedBy
    """
    session.run(query, {
        "name": knowledge_name,
        "categoryId": category_id,
        "assignedBy": assigned_by,
    })


def _link_category_parent(session, child_id: str, parent_id: str, order_index: int):
    """关联父子分类"""
    query = """
    MATCH (parent:KnowledgeCategory {id: $parentId})
    MATCH (child:KnowledgeCategory {id: $childId})
    MERGE (parent)-[r:PARENT_OF]->(child)
    SET r.orderIndex = $orderIndex
    """
    session.run(query, {
        "parentId": parent_id,
        "childId": child_id,
        "orderIndex": order_index,
    })


def _format_knowledge_point(node) -> Dict[str, object]:
    """格式化知识点节点为字典"""
    return {
        "name": node.get("name"),
        "code": node.get("code"),
        "category": node.get("category"),
        "type": node.get("type"),
        "lex_role": node.get("lex_role", ""),
        "difficulty": node.get("difficulty"),
        "importance": node.get("importance"),
        "summary": node.get("summary", ""),
        "description": node.get("description", ""),
        "keywords": node.get("keywords", []),
        "tags": node.get("tags", []),
        "estimatedMinutes": node.get("estimatedMinutes", 15),
        "imageUrl": node.get("imageUrl", ""),
        "videoUrl": node.get("videoUrl", ""),
        "documentUrl": node.get("documentUrl", ""),
        "externalUrl": node.get("externalUrl", ""),
        "viewCount": node.get("viewCount", 0),
        "practiceCount": node.get("practiceCount", 0),
        "averageScore": node.get("averageScore"),
        "createdAt": _to_iso(node.get("createdAt")),
        "updatedAt": _to_iso(node.get("updatedAt")),
        "createdBy": node.get("createdBy"),
        "version": node.get("version", 1),
    }


def _format_category(node) -> Dict[str, object]:
    """格式化分类节点为字典"""
    return {
        "id": node.get("id"),
        "name": node.get("name"),
        "code": node.get("code"),
        "level": node.get("level"),
        "orderIndex": node.get("orderIndex"),
        "icon": node.get("icon"),
        "color": node.get("color"),
        "description": node.get("description", ""),
        "isActive": node.get("isActive", True),
        "createdAt": node.get("createdAt"),
        "updatedAt": node.get("updatedAt"),
    }
