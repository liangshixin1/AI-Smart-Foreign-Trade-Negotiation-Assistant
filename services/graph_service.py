"""Neo4j integration layer for the knowledge graph features."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from neo4j import GraphDatabase, basic_auth
from neo4j.exceptions import Neo4jError, ServiceUnavailable

import database


LOGGER = logging.getLogger(__name__)


class GraphUnavailableError(RuntimeError):
    """Raised when the Neo4j backend is not ready."""


class GraphEntityNotFoundError(RuntimeError):
    """Raised when a requested graph entity cannot be located."""


_DRIVER = None
_GRAPH_DISABLED = False
_GRAPH_DISABLED_REASON = ""


def _neo4j_credentials() -> Tuple[str, str, str]:
    uri = os.getenv("NEO4J_URI")
    if not uri:
        raise GraphUnavailableError("NEO4J_URI environment variable is not configured")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "")
    return uri, user, password


def _get_driver():
    global _DRIVER, _GRAPH_DISABLED, _GRAPH_DISABLED_REASON
    if _GRAPH_DISABLED:
        raise GraphUnavailableError(_GRAPH_DISABLED_REASON or "Knowledge graph connectivity disabled")

    if _DRIVER is not None:
        return _DRIVER

    uri, user, password = _neo4j_credentials()
    try:
        driver = GraphDatabase.driver(uri, auth=basic_auth(user, password))
        driver.verify_connectivity()
    except (Neo4jError, ServiceUnavailable, OSError) as exc:  # pragma: no cover - network
        LOGGER.error("Failed to connect to Neo4j at %s: %s", uri, exc)
        _GRAPH_DISABLED = True
        _GRAPH_DISABLED_REASON = f"Failed to connect to Neo4j at {uri}: {exc}"
        raise GraphUnavailableError("Failed to connect to Neo4j") from exc

    _DRIVER = driver
    _GRAPH_DISABLED = False
    _GRAPH_DISABLED_REASON = ""
    return driver


def is_configured() -> bool:
    """Return True if Neo4j connection information is available."""

    return bool(os.getenv("NEO4J_URI"))


def graph_status() -> Dict[str, object]:
    """Return diagnostic information about the knowledge graph backend."""

    return {
        "configured": is_configured(),
        "available": is_configured() and not _GRAPH_DISABLED,
        "message": _GRAPH_DISABLED_REASON,
    }


def close_driver() -> None:
    """Dispose of the cached Neo4j driver."""

    global _DRIVER, _GRAPH_DISABLED, _GRAPH_DISABLED_REASON
    if _DRIVER is not None:
        _DRIVER.close()
        _DRIVER = None
    _GRAPH_DISABLED = False
    _GRAPH_DISABLED_REASON = ""


def _fallback_practice_detail(practice_id: str) -> Dict[str, object]:
    practice = database.get_section(practice_id)
    if not practice:
        raise GraphEntityNotFoundError(f"Practice {practice_id} not found")
    return {
        "id": practice.get("id"),
        "title": practice.get("title"),
        "description": practice.get("description"),
        "orderIndex": practice.get("order_index"),
        "chapterId": practice.get("chapter_id"),
        "knowledgePoints": [],
    }


def _fallback_lesson_detail(lesson_id: str) -> Dict[str, object]:
    lesson = database.get_theory_lesson(lesson_id, include_unpublished=True)
    if not lesson:
        raise GraphEntityNotFoundError(f"Theory lesson {lesson_id} not found")
    return {
        "id": lesson.get("id"),
        "title": lesson.get("title"),
        "code": lesson.get("code"),
        "topicId": lesson.get("topicId"),
        "knowledgePoints": [],
    }


def _execute_read(query: str, parameters: Optional[Dict[str, object]] = None) -> List[Dict[str, object]]:
    driver = _get_driver()
    with driver.session() as session:
        result = session.run(query, parameters or {})
        return [record.data() for record in result]


def _execute_write(query: str, parameters: Optional[Dict[str, object]] = None) -> None:
    driver = _get_driver()
    with driver.session() as session:
        session.run(query, parameters or {})


def ensure_indexes() -> None:
    """Create the uniqueness constraints required by the knowledge graph."""

    driver = _get_driver()
    statements = [
        "CREATE CONSTRAINT chapter_id IF NOT EXISTS FOR (c:Chapter) REQUIRE c.id IS UNIQUE",
        "CREATE CONSTRAINT practice_id IF NOT EXISTS FOR (p:Practice) REQUIRE p.id IS UNIQUE",
        "CREATE CONSTRAINT theory_topic_id IF NOT EXISTS FOR (t:TheoryTopic) REQUIRE t.id IS UNIQUE",
        "CREATE CONSTRAINT lesson_id IF NOT EXISTS FOR (l:TheoryLesson) REQUIRE l.id IS UNIQUE",
        "CREATE CONSTRAINT knowledge_point_name IF NOT EXISTS FOR (k:KnowledgePoint) REQUIRE k.name IS UNIQUE",
        "CREATE CONSTRAINT process_step_id IF NOT EXISTS FOR (s:ProcessStep) REQUIRE s.id IS UNIQUE",
    ]

    with driver.session() as session:
        for statement in statements:
            session.run(statement)


@dataclass(frozen=True)
class ProcessStep:
    """Metadata for the canonical negotiation process stages."""

    identifier: str
    name: str
    order_index: int


PROCESS_STEPS: Sequence[ProcessStep] = (
    ProcessStep("process-prologue", "课程导入", 0),
    ProcessStep("process-inquiry", "询盘", 1),
    ProcessStep("process-offer", "报盘", 2),
    ProcessStep("process-counter-offer", "还盘", 3),
    ProcessStep("process-acceptance", "接受与订货", 4),
    ProcessStep("process-logistics", "订舱与物流", 5),
    ProcessStep("process-payment", "付款与交货", 6),
    ProcessStep("process-inspection", "商检", 7),
    ProcessStep("process-risk", "保险与仲裁", 8),
    ProcessStep("process-complaint", "投诉处理", 9),
    ProcessStep("process-claim", "索赔与理赔", 10),
)


CHAPTER_PROCESS_MAPPING: Dict[str, str] = {
    "chapter-0": "process-prologue",
    "chapter-1": "process-inquiry",
    "chapter-2": "process-offer",
    "chapter-3": "process-counter-offer",
    "chapter-4": "process-acceptance",
    "chapter-5": "process-logistics",
    "chapter-6": "process-payment",
    "chapter-7": "process-inspection",
    "chapter-8": "process-risk",
    "chapter-9": "process-complaint",
    "chapter-10": "process-claim",
}


SECTION_KNOWLEDGE_PRESETS: Dict[str, Sequence[str]] = {
    "chapter-0-section-1": (
        "首轮报价锚点策略",
        "FOB 成本构成",
        "条件式让步技巧",
    ),
    "chapter-1-section-1": (
        "询盘结构要素",
        "产品规格描述",
        "专业邮件礼仪",
    ),
    "chapter-1-section-2": (
        "需求澄清提问",
        "跟进邮件结构",
        "跨文化沟通语气",
    ),
    "chapter-2-section-1": (
        "报盘组成项目",
        "价格梯度设计",
        "价值陈述技巧",
    ),
    "chapter-2-section-2": (
        "议价让步逻辑",
        "锚定与反锚定",
        "条件交换策略",
    ),
    "chapter-3-section-1": (
        "还盘框架设计",
        "底线管理",
        "谈判让步幅度",
    ),
    "chapter-4-section-1": (
        "报价单审阅要点",
        "价格条款辨识",
        "折扣条件分析",
    ),
    "chapter-4-section-2": (
        "形式发票结构",
        "支付条款匹配",
        "风险提示编写",
    ),
    "chapter-4-section-3": (
        "发盘流程",
        "条款协同",
        "谈判节奏控制",
    ),
    "chapter-4-section-4": (
        "国际支付工具",
        "信用证条款",
        "风险保障策略",
    ),
    "chapter-4-section-5": (
        "接受函撰写",
        "订单确认流程",
        "交付节点管理",
    ),
    "chapter-4-section-6": (
        "订单履行跟进",
        "客户关系维护",
        "跨部门协同",
    ),
    "chapter-5-section-1": (
        "出口包装标准",
        "唛头设计",
        "货物防护技巧",
    ),
    "chapter-5-section-2": (
        "运输方式比较",
        "运价谈判策略",
        "时效与成本平衡",
    ),
    "chapter-5-section-3": (
        "装运时间表",
        "港口协调",
        "突发事件预案",
    ),
    "chapter-5-section-4": (
        "全链路协调",
        "物流关键路径",
        "多方沟通机制",
    ),
    "chapter-6-section-1": (
        "信用证审证流程",
        "单证一致性",
        "改证谈判技巧",
    ),
    "chapter-6-section-2": (
        "托收风险识别",
        "银行交涉话术",
        "账款保障措施",
    ),
    "chapter-6-section-3": (
        "电汇操作流程",
        "收汇时间规划",
        "资金安全控制",
    ),
    "chapter-6-section-4": (
        "分批交货条款",
        "交货时间管理",
        "库存与产能匹配",
    ),
    "chapter-6-section-5": (
        "Incoterms 责任划分",
        "风险转移节点",
        "费用承担分析",
    ),
    "chapter-6-section-6": (
        "高风险客户评估",
        "付款条件博弈",
        "风险缓释方案",
    ),
    "chapter-7-section-1": (
        "检验证书类型",
        "法定与商检机构",
        "合规要求识别",
    ),
    "chapter-7-section-2": (
        "检验条款撰写",
        "合同风险控制",
        "检验责任划分",
    ),
    "chapter-7-section-3": (
        "检验谈判策略",
        "异议处理流程",
        "质量保证设计",
    ),
    "chapter-7-section-4": (
        "不合格争议应对",
        "证据链构建",
        "解决方案谈判",
    ),
    "chapter-8-section-1": (
        "货运保险类别",
        "保险金额计算",
        "风险敞口评估",
    ),
    "chapter-8-section-2": (
        "仲裁条款要素",
        "争议解决流程",
        "适用法律选择",
    ),
    "chapter-8-section-3": (
        "海运险理赔流程",
        "索赔资料准备",
        "损失证据整理",
    ),
    "chapter-8-section-4": (
        "仲裁申请准备",
        "律师沟通要点",
        "庭审应对策略",
    ),
    "chapter-9-section-1": (
        "投诉处理流程",
        "客户情绪管理",
        "补救方案设计",
    ),
    "chapter-9-section-2": (
        "投诉到争议升级",
        "内部协调机制",
        "品牌声誉保护",
    ),
    "chapter-10-section-1": (
        "索赔函结构",
        "损失计算方法",
        "法律条款引用",
    ),
    "chapter-10-section-2": (
        "理赔审核要点",
        "调解与谈判技巧",
        "赔偿决策机制",
    ),
}


LESSON_KNOWLEDGE_PRESETS: Dict[str, Sequence[str]] = {}


def bootstrap_graph() -> None:
    """Initialise constraints and ingest the static content hierarchy."""

    if not is_configured():
        LOGGER.warning("Neo4j connection is not configured; knowledge graph features disabled")
        return

    try:
        ensure_indexes()
        sync_static_content()
    except GraphUnavailableError as exc:  # pragma: no cover - depends on external service
        LOGGER.warning("Unable to bootstrap knowledge graph: %s", exc)


def sync_static_content() -> None:
    """Mirror the SQLite content hierarchy into Neo4j."""

    driver = _get_driver()

    chapters = database.list_level_hierarchy(include_prompts=True)
    theory_topics = database.list_theory_hierarchy(include_content=True, published_only=False)

    with driver.session() as session:
        session.execute_write(_merge_process_steps)
        for chapter in chapters:
            session.execute_write(_merge_chapter, chapter)
            session.execute_write(_link_chapter_process, chapter["id"])
            for section in chapter.get("sections", []):
                session.execute_write(_merge_practice, chapter, section)
                preset = SECTION_KNOWLEDGE_PRESETS.get(section["id"], ())
                if preset:
                    session.execute_write(_ensure_practice_knowledge, section["id"], list(preset))

        for topic in theory_topics:
            session.execute_write(_merge_theory_topic, topic)
            for lesson in topic.get("lessons", []):
                session.execute_write(_merge_theory_lesson, topic, lesson)
                preset = LESSON_KNOWLEDGE_PRESETS.get(lesson["id"], ())
                if preset:
                    session.execute_write(_ensure_lesson_knowledge, lesson["id"], list(preset))


def _merge_process_steps(tx) -> None:
    for step in PROCESS_STEPS:
        tx.run(
            "MERGE (s:ProcessStep {id: $id}) SET s.name = $name, s.orderIndex = $order",
            {"id": step.identifier, "name": step.name, "order": step.order_index},
        )

    for previous, current in zip(PROCESS_STEPS, PROCESS_STEPS[1:]):
        tx.run(
            "MATCH (a:ProcessStep {id: $a}), (b:ProcessStep {id: $b}) "
            "MERGE (a)-[:NEXT_STEP]->(b)",
            {"a": previous.identifier, "b": current.identifier},
        )


def _merge_chapter(tx, chapter: Dict[str, object]) -> None:
    tx.run(
        "MERGE (c:Chapter {id: $id}) "
        "SET c.title = $title, c.description = $description, "
        "    c.orderIndex = $orderIndex, c.isDefault = $isDefault",
        {
            "id": chapter.get("id"),
            "title": chapter.get("title"),
            "description": chapter.get("description"),
            "orderIndex": chapter.get("orderIndex", 0),
            "isDefault": bool(chapter.get("isDefault")),
        },
    )


def _link_chapter_process(tx, chapter_id: str) -> None:
    process_id = CHAPTER_PROCESS_MAPPING.get(chapter_id)
    if not process_id:
        return
    tx.run(
        "MATCH (c:Chapter {id: $chapter_id}), (p:ProcessStep {id: $process_id}) "
        "MERGE (c)-[:COVERS_PROCESS]->(p)",
        {"chapter_id": chapter_id, "process_id": process_id},
    )


def _merge_practice(tx, chapter: Dict[str, object], section: Dict[str, object]) -> None:
    properties = {
        "id": section.get("id"),
        "title": section.get("title"),
        "description": section.get("description"),
        "environmentPromptTemplate": section.get("environmentPromptTemplate"),
        "environmentUserMessage": section.get("environmentUserMessage"),
        "conversationPromptTemplate": section.get("conversationPromptTemplate"),
        "evaluationPromptTemplate": section.get("evaluationPromptTemplate"),
        "expectsBargaining": bool(section.get("expectsBargaining")),
        "orderIndex": section.get("orderIndex", 0),
    }
    tx.run(
        "MERGE (p:Practice {id: $id}) "
        "SET p.title = $title, p.description = $description, p.orderIndex = $orderIndex, "
        "    p.environmentPromptTemplate = $environmentPromptTemplate, "
        "    p.environmentUserMessage = $environmentUserMessage, "
        "    p.conversationPromptTemplate = $conversationPromptTemplate, "
        "    p.evaluationPromptTemplate = $evaluationPromptTemplate, "
        "    p.expectsBargaining = $expectsBargaining",
        properties,
    )
    tx.run(
        "MATCH (c:Chapter {id: $chapter_id}), (p:Practice {id: $practice_id}) "
        "MERGE (c)-[:HAS_PRACTICE]->(p)",
        {"chapter_id": chapter.get("id"), "practice_id": section.get("id")},
    )


def _merge_theory_topic(tx, topic: Dict[str, object]) -> None:
    tx.run(
        "MERGE (t:TheoryTopic {id: $id}) "
        "SET t.title = $title, t.code = $code, t.summary = $summary, t.orderIndex = $orderIndex",
        {
            "id": topic.get("id"),
            "title": topic.get("title"),
            "code": topic.get("code"),
            "summary": topic.get("summary"),
            "orderIndex": topic.get("orderIndex", 0),
        },
    )
    chapter_id = topic.get("chapterId")
    if chapter_id:
        tx.run(
            "MATCH (c:Chapter {id: $chapter_id}), (t:TheoryTopic {id: $topic_id}) "
            "MERGE (c)-[:HAS_TOPIC]->(t)",
            {"chapter_id": chapter_id, "topic_id": topic.get("id")},
        )


def _merge_theory_lesson(tx, topic: Dict[str, object], lesson: Dict[str, object]) -> None:
    tx.run(
        "MERGE (l:TheoryLesson {id: $id}) "
        "SET l.title = $title, l.code = $code, l.orderIndex = $orderIndex, "
        "    l.isPublished = $isPublished, l.contentHtml = $contentHtml",
        {
            "id": lesson.get("id"),
            "title": lesson.get("title"),
            "code": lesson.get("code"),
            "orderIndex": lesson.get("orderIndex", 0),
            "isPublished": bool(lesson.get("isPublished")),
            "contentHtml": lesson.get("contentHtml"),
        },
    )
    tx.run(
        "MATCH (t:TheoryTopic {id: $topic_id}), (l:TheoryLesson {id: $lesson_id}) "
        "MERGE (t)-[:HAS_LESSON]->(l)",
        {"topic_id": topic.get("id"), "lesson_id": lesson.get("id")},
    )


def _ensure_practice_knowledge(tx, practice_id: str, points: List[str]) -> None:
    existing = tx.run(
        "MATCH (:Practice {id: $id})-[:TESTS]->(k:KnowledgePoint) RETURN collect(k.name) AS names",
        {"id": practice_id},
    ).single()
    if existing and existing["names"]:
        return
    _set_practice_knowledge_tx(tx, practice_id, points)


def _ensure_lesson_knowledge(tx, lesson_id: str, points: List[str]) -> None:
    existing = tx.run(
        "MATCH (:TheoryLesson {id: $id})-[:EXPLAINS]->(k:KnowledgePoint) RETURN collect(k.name) AS names",
        {"id": lesson_id},
    ).single()
    if existing and existing["names"]:
        return
    _set_lesson_knowledge_tx(tx, lesson_id, points)


def set_practice_knowledge_points(practice_id: str, points: Sequence[str]) -> None:
    driver = _get_driver()
    normalized = _normalize_knowledge_points(points)
    with driver.session() as session:
        session.execute_write(_set_practice_knowledge_tx, practice_id, normalized)


def _set_practice_knowledge_tx(tx, practice_id: str, points: Sequence[str]) -> None:
    record = tx.run(
        "MATCH (p:Practice {id: $id}) RETURN p", {"id": practice_id}
    ).single()
    if not record:
        raise GraphEntityNotFoundError(f"Practice {practice_id} not found")

    tx.run(
        "MATCH (:Practice {id: $id})-[rel:TESTS]->(:KnowledgePoint) DELETE rel",
        {"id": practice_id},
    )
    for name in points:
        tx.run(
            "MATCH (p:Practice {id: $id}) "
            "MERGE (k:KnowledgePoint {name: $name}) "
            "MERGE (p)-[:TESTS]->(k)",
            {"id": practice_id, "name": name},
        )


def set_lesson_knowledge_points(lesson_id: str, points: Sequence[str]) -> None:
    driver = _get_driver()
    normalized = _normalize_knowledge_points(points)
    with driver.session() as session:
        session.execute_write(_set_lesson_knowledge_tx, lesson_id, normalized)


def _set_lesson_knowledge_tx(tx, lesson_id: str, points: Sequence[str]) -> None:
    record = tx.run(
        "MATCH (l:TheoryLesson {id: $id}) RETURN l", {"id": lesson_id}
    ).single()
    if not record:
        raise GraphEntityNotFoundError(f"Theory lesson {lesson_id} not found")

    tx.run(
        "MATCH (:TheoryLesson {id: $id})-[rel:EXPLAINS]->(:KnowledgePoint) DELETE rel",
        {"id": lesson_id},
    )
    for name in points:
        tx.run(
            "MATCH (l:TheoryLesson {id: $id}) "
            "MERGE (k:KnowledgePoint {name: $name}) "
            "MERGE (l)-[:EXPLAINS]->(k)",
            {"id": lesson_id, "name": name},
        )


def _normalize_knowledge_points(points: Sequence[str]) -> List[str]:
    normalized: List[str] = []
    seen = set()
    for point in points:
        if not isinstance(point, str):
            continue
        cleaned = point.strip()
        if not cleaned:
            continue
        if cleaned in seen:
            continue
        seen.add(cleaned)
        normalized.append(cleaned)
    return normalized


def get_practice_detail(practice_id: str) -> Dict[str, object]:
    try:
        records = _execute_read(
            """
            MATCH (p:Practice {id: $id})
            OPTIONAL MATCH (p)-[:TESTS]->(k:KnowledgePoint)
            OPTIONAL MATCH (c:Chapter)-[:HAS_PRACTICE]->(p)
            RETURN p AS practice, collect(DISTINCT k.name) AS knowledge, c.id AS chapterId
            """,
            {"id": practice_id},
        )
    except GraphUnavailableError:
        LOGGER.debug("Graph unavailable when fetching practice %s; returning fallback", practice_id)
        return _fallback_practice_detail(practice_id)

    if not records:
        raise GraphEntityNotFoundError(f"Practice {practice_id} not found")

    record = records[0]
    practice = record["practice"]
    payload = {
        "id": practice.get("id"),
        "title": practice.get("title"),
        "description": practice.get("description"),
        "orderIndex": practice.get("orderIndex"),
        "chapterId": record.get("chapterId"),
        "knowledgePoints": sorted(filter(None, record.get("knowledge") or [])),
    }
    return payload


def get_lesson_detail(lesson_id: str) -> Dict[str, object]:
    try:
        records = _execute_read(
            """
            MATCH (l:TheoryLesson {id: $id})
            OPTIONAL MATCH (l)-[:EXPLAINS]->(k:KnowledgePoint)
            OPTIONAL MATCH (t:TheoryTopic)-[:HAS_LESSON]->(l)
            RETURN l AS lesson, collect(DISTINCT k.name) AS knowledge, t.id AS topicId
            """,
            {"id": lesson_id},
        )
    except GraphUnavailableError:
        LOGGER.debug("Graph unavailable when fetching lesson %s; returning fallback", lesson_id)
        return _fallback_lesson_detail(lesson_id)

    if not records:
        raise GraphEntityNotFoundError(f"Theory lesson {lesson_id} not found")

    record = records[0]
    lesson = record["lesson"]
    return {
        "id": lesson.get("id"),
        "title": lesson.get("title"),
        "code": lesson.get("code"),
        "topicId": record.get("topicId"),
        "knowledgePoints": sorted(filter(None, record.get("knowledge") or [])),
    }


def list_knowledge_points() -> List[Dict[str, object]]:
    return _execute_read(
        """
        MATCH (k:KnowledgePoint)
        OPTIONAL MATCH (k)<-[:TESTS]-(p:Practice)
        OPTIONAL MATCH (k)<-[:EXPLAINS]-(l:TheoryLesson)
        RETURN k.name AS name,
               count(DISTINCT p) AS practiceCount,
               count(DISTINCT l) AS lessonCount
        ORDER BY name
        """,
    )


def get_related_practices_for_lesson(lesson_id: str) -> List[Dict[str, object]]:
    try:
        return _execute_read(
            """
            MATCH (l:TheoryLesson {id: $id})-[:EXPLAINS]->(k:KnowledgePoint)<-[:TESTS]-(p:Practice)
            OPTIONAL MATCH (c:Chapter)-[:HAS_PRACTICE]->(p)
            RETURN DISTINCT p.id AS id, p.title AS title, p.description AS description,
                   p.orderIndex AS orderIndex, c.id AS chapterId
            ORDER BY p.orderIndex, p.title
            """,
            {"id": lesson_id},
        )
    except GraphUnavailableError:
        LOGGER.debug(
            "Graph unavailable when listing practices for lesson %s; returning empty list",
            lesson_id,
        )
        # Ensure the lesson exists before returning an empty payload.
        _fallback_lesson_detail(lesson_id)
        return []


def get_related_lessons_for_practice(practice_id: str) -> List[Dict[str, object]]:
    try:
        return _execute_read(
            """
            MATCH (p:Practice {id: $id})-[:TESTS]->(k:KnowledgePoint)<-[:EXPLAINS]-(l:TheoryLesson)
            OPTIONAL MATCH (t:TheoryTopic)-[:HAS_LESSON]->(l)
            RETURN DISTINCT l.id AS id, l.title AS title, l.code AS code, l.orderIndex AS orderIndex,
                   l.isPublished AS isPublished, t.id AS topicId
            ORDER BY l.orderIndex, l.title
            """,
            {"id": practice_id},
        )
    except GraphUnavailableError:
        LOGGER.debug(
            "Graph unavailable when listing lessons for practice %s; returning empty list",
            practice_id,
        )
        _fallback_practice_detail(practice_id)
        return []


def fetch_graph_snapshot(limit: int = 250) -> Dict[str, object]:
    allowed_labels = [
        "Chapter",
        "Practice",
        "TheoryTopic",
        "TheoryLesson",
        "KnowledgePoint",
        "ProcessStep",
    ]
    nodes = _execute_read(
        """
        MATCH (n)
        WHERE any(label IN labels(n) WHERE label IN $allowed)
        RETURN DISTINCT labels(n) AS labels, n AS node
        LIMIT $limit
        """,
        {"allowed": allowed_labels, "limit": limit},
    )

    edges = _execute_read(
        """
        MATCH (a)-[r]->(b)
        WHERE any(label IN labels(a) WHERE label IN $allowed)
          AND any(label IN labels(b) WHERE label IN $allowed)
        RETURN labels(a) AS sourceLabels, a AS source,
               labels(b) AS targetLabels, b AS target,
               type(r) AS type
        LIMIT $limit
        """,
        {"allowed": allowed_labels, "limit": limit * 3},
    )

    node_payload: Dict[str, Dict[str, object]] = {}
    for record in nodes:
        labels = record.get("labels") or []
        node = record.get("node") or {}
        primary = _select_primary_label(labels)
        if not primary:
            continue
        identifier = _extract_node_identifier(primary, node)
        if not identifier:
            continue
        key = f"{primary}:{identifier}"
        node_payload[key] = {
            "key": key,
            "label": primary,
            "title": node.get("title") or node.get("name") or node.get("code") or identifier,
            "subtitle": _build_node_subtitle(primary, node),
        }

    edge_payload: List[Dict[str, object]] = []
    for record in edges:
        source_primary = _select_primary_label(record.get("sourceLabels") or [])
        target_primary = _select_primary_label(record.get("targetLabels") or [])
        source_identifier = _extract_node_identifier(source_primary, record.get("source") or {})
        target_identifier = _extract_node_identifier(target_primary, record.get("target") or {})
        if not (source_primary and target_primary and source_identifier and target_identifier):
            continue
        source_key = f"{source_primary}:{source_identifier}"
        target_key = f"{target_primary}:{target_identifier}"
        if source_key not in node_payload or target_key not in node_payload:
            continue
        edge_payload.append(
            {
                "source": source_key,
                "target": target_key,
                "type": record.get("type"),
            }
        )

    return {"nodes": list(node_payload.values()), "edges": edge_payload}


def _select_primary_label(labels: Iterable[str]) -> Optional[str]:
    priority = [
        "Chapter",
        "Practice",
        "TheoryTopic",
        "TheoryLesson",
        "KnowledgePoint",
        "ProcessStep",
    ]
    for label in priority:
        if label in labels:
            return label
    return next(iter(labels), None) if labels else None


def _extract_node_identifier(label: Optional[str], node: Dict[str, object]) -> Optional[str]:
    if not label:
        return None
    if label == "KnowledgePoint":
        return node.get("name")
    return node.get("id") or node.get("code") or node.get("title")


def _build_node_subtitle(label: str, node: Dict[str, object]) -> Optional[str]:
    if label == "Practice":
        return node.get("description")
    if label == "TheoryLesson":
        return node.get("code")
    if label == "KnowledgePoint":
        return None
    if label == "ProcessStep":
        return f"顺序：{node.get('orderIndex')}"
    return node.get("description")

