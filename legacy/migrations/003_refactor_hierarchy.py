"""
Migration 003: Refactor hierarchy to Stage -> Topic -> KnowledgeCategory -> KnowledgePoint

目标:
1) 为每个 Topic 创建物理的 KnowledgeCategory 中间层
2) 将 KnowledgePoint 挂载到对应的 Category 下
3) 清理越级关系: 删除 Stage->KnowledgePoint(HAS_TOPIC) 与 Topic->KnowledgePoint(INCLUDE_POINT)
"""

import logging
from typing import Dict, Iterable, Optional

LOGGER = logging.getLogger(__name__)


# 分类名称映射
CATEGORY_NAME_ALIASES = {
    "skill": "技能",
    "技能": "技能",
    "技能型": "技能",
    "terminology": "术语",
    "term": "术语",
    "术语": "术语",
    "概念": "术语",
    "concept": "术语",
    "knowledge": "知识",
    "知识": "知识",
    "knowledgepoint": "知识",
    "document": "文档",
    "doc": "文档",
    "文档": "文档",
}


def _resolve_category_name(raw_type: Optional[str], labels: Iterable[str]) -> str:
    """根据类型或标签确定分类名称。"""
    if raw_type:
        normalized = str(raw_type).strip().lower()
        if normalized in CATEGORY_NAME_ALIASES:
            return CATEGORY_NAME_ALIASES[normalized]

    for label in labels or []:
        normalized = str(label).strip().lower()
        if normalized in CATEGORY_NAME_ALIASES:
            return CATEGORY_NAME_ALIASES[normalized]

    return "知识"


def upgrade(driver, initiated_by: str = "system") -> Dict[str, int]:
    """
    执行层级重构迁移。

    Returns:
        统计信息字典
    """
    stats = {
        "topics_processed": 0,
        "categories_created": 0,
        "has_category_created": 0,
        "contains_created": 0,
        "include_deleted": 0,
        "has_topic_deleted": 0,
    }

    with driver.session() as session:
        LOGGER.info("扫描 Topic 与 KnowledgePoint 关系，准备创建 KnowledgeCategory ...")
        records = session.run(
            """
            MATCH (t:Topic)-[:INCLUDE_POINT]->(kp:KnowledgePoint)
            OPTIONAL MATCH (t)<-[:CONTAIN_TOPIC]-(s:Stage)
            RETURN t.name AS topicName,
                   coalesce(t.stage, s.name) AS stageName,
                   kp.name AS pointName,
                   kp.type AS pointType,
                   labels(kp) AS pointLabels
            """
        )

        topic_payload: Dict[str, Dict[str, object]] = {}
        for record in records:
            topic_name = record["topicName"]
            stage_name = record["stageName"]
            point_name = record["pointName"]
            point_type = record["pointType"]
            point_labels = record["pointLabels"] or []

            if not topic_name or not point_name:
                continue

            topic_key = f"{stage_name}::{topic_name}"
            payload = topic_payload.setdefault(
                topic_key,
                {"topic": topic_name, "stage": stage_name, "points": []},
            )
            payload["points"].append(
                {"name": point_name, "type": point_type, "labels": point_labels}
            )

        LOGGER.info("开始创建 KnowledgeCategory 节点并重新挂载知识点 ...")
        for topic_data in topic_payload.values():
            topic_name = topic_data["topic"]
            stage_name = topic_data.get("stage")
            stats["topics_processed"] += 1

            for point in topic_data["points"]:
                category_name = _resolve_category_name(point.get("type"), point.get("labels"))
                create_category_result = session.run(
                    """
                    MATCH (kp:KnowledgePoint {name: $point_name})
                    MERGE (t:Topic {name: $topic_name, stage: $stage_name})
                    WITH kp, t
                    FOREACH (_ IN CASE WHEN $stage_name IS NOT NULL AND $stage_name <> '' THEN [1] ELSE [] END |
                        MERGE (s:Stage {name: $stage_name})
                        MERGE (s)-[:CONTAIN_TOPIC]->(t)
                    )
                    MERGE (c:KnowledgeCategory {name: $category_name, topic: $topic_name, stage: $stage_name})
                    ON CREATE SET
                        c.type = $category_name,
                        c.createdAt = datetime(),
                        c.updatedAt = datetime(),
                        c.createdBy = $createdBy,
                        c.updatedBy = $createdBy
                    SET
                        c.updatedAt = datetime(),
                        c.updatedBy = $createdBy
                    MERGE (t)-[hc:HAS_CATEGORY]->(c)
                    ON CREATE SET hc.createdAt = datetime(), hc.createdBy = $createdBy
                    """,
                    {
                        "point_name": point["name"],
                        "topic_name": topic_name,
                        "stage_name": stage_name,
                        "category_name": category_name,
                        "createdBy": initiated_by,
                    },
                )
                counters = create_category_result.consume().counters
                stats["categories_created"] += counters.nodes_created
                stats["has_category_created"] += counters.relationships_created

                contains_result = session.run(
                    """
                    MATCH (c:KnowledgeCategory {name: $category_name, topic: $topic_name, stage: $stage_name})
                    MATCH (kp:KnowledgePoint {name: $point_name})
                    MERGE (c)-[ct:CONTAINS]->(kp)
                    ON CREATE SET ct.createdAt = datetime(), ct.createdBy = $createdBy
                    """,
                    {
                        "point_name": point["name"],
                        "topic_name": topic_name,
                        "stage_name": stage_name,
                        "category_name": category_name,
                        "createdBy": initiated_by,
                    },
                )
                stats["contains_created"] += contains_result.consume().counters.relationships_created

        LOGGER.info("删除越级关系 HAS_TOPIC 与旧的 INCLUDE_POINT 关系 ...")
        include_result = session.run(
            "MATCH (:Topic)-[r:INCLUDE_POINT]->(:KnowledgePoint) DELETE r RETURN count(r) AS deleted"
        ).single()
        stats["include_deleted"] = include_result["deleted"] if include_result else 0

        has_topic_result = session.run(
            "MATCH (:Stage)-[r:HAS_TOPIC]->(:KnowledgePoint) DELETE r RETURN count(r) AS deleted"
        ).single()
        stats["has_topic_deleted"] = has_topic_result["deleted"] if has_topic_result else 0

        LOGGER.info(f"Migration 003 completed with stats: {stats}")

    return stats
