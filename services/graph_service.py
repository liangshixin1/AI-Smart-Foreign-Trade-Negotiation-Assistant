"""Neo4j integration layer for the knowledge graph features."""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple
from uuid import uuid4

from neo4j import GraphDatabase, basic_auth
from neo4j.exceptions import IncompleteCommit, Neo4jError, ServiceUnavailable

import database


LOGGER = logging.getLogger(__name__)


class GraphUnavailableError(RuntimeError):
    """Raised when the Neo4j backend is not ready."""


class GraphEntityNotFoundError(RuntimeError):
    """Raised when a requested graph entity cannot be located."""


class GraphValidationError(RuntimeError):
    """Raised when a request payload fails validation checks."""


class GraphConflictError(RuntimeError):
    """Raised when an operation would violate graph constraints."""


_DRIVER = None
_GRAPH_DISABLED = False
_GRAPH_DISABLED_REASON = ""


DEFAULT_NEO4J_URI = "bolt://localhost:7687"
DEFAULT_NEO4J_USER = "neo4j"
DEFAULT_NEO4J_PASSWORD = "neo4j"


DEFAULT_KNOWLEDGE_TYPE = "concept"
DEFAULT_KNOWLEDGE_DIFFICULTY = "intermediate"
DEFAULT_KNOWLEDGE_IMPORTANCE = "core"
DEFAULT_KNOWLEDGE_CATEGORY_ID = "cat-unassigned"


_UNSPECIFIED = object()


DEFAULT_KNOWLEDGE_CATEGORIES: Sequence[Dict[str, object]] = (
    {
        "id": "cat-unassigned",
        "name": "未分类",
        "slug": "uncategorized",
        "order": 0,
        "description": "临时占位分类，便于初次导入后统一整理。",
        "children": [],
    },
    {
        "id": "cat-trade-fundamentals",
        "name": "贸易基础",
        "slug": "trade-fundamentals",
        "order": 1,
        "children": (
            {
                "id": "cat-incoterms",
                "name": "贸易术语",
                "slug": "incoterms",
                "order": 1,
                "children": (
                    {"id": "cat-incoterms-fob", "name": "FOB", "slug": "incoterms-fob", "order": 1},
                    {"id": "cat-incoterms-cif", "name": "CIF", "slug": "incoterms-cif", "order": 2},
                    {"id": "cat-incoterms-cfr", "name": "CFR", "slug": "incoterms-cfr", "order": 3},
                    {"id": "cat-incoterms-exw", "name": "EXW", "slug": "incoterms-exw", "order": 4},
                    {"id": "cat-incoterms-ddp", "name": "DDP", "slug": "incoterms-ddp", "order": 5},
                ),
            },
            {
                "id": "cat-payment-terms",
                "name": "支付方式",
                "slug": "payment-terms",
                "order": 2,
                "children": (
                    {"id": "cat-payment-lc", "name": "信用证", "slug": "payment-lc", "order": 1},
                    {"id": "cat-payment-tt", "name": "电汇", "slug": "payment-tt", "order": 2},
                    {"id": "cat-payment-collection", "name": "托收", "slug": "payment-collection", "order": 3},
                    {"id": "cat-payment-oa", "name": "赊销", "slug": "payment-oa", "order": 4},
                ),
            },
            {
                "id": "cat-trade-documents",
                "name": "贸易文档",
                "slug": "trade-documents",
                "order": 3,
                "children": (
                    {"id": "cat-document-invoice", "name": "商业发票", "slug": "document-invoice", "order": 1},
                    {"id": "cat-document-packing", "name": "装箱单", "slug": "document-packing", "order": 2},
                    {"id": "cat-document-bill-of-lading", "name": "提单", "slug": "document-bill-of-lading", "order": 3},
                    {"id": "cat-document-co", "name": "产地证", "slug": "document-co", "order": 4},
                ),
            },
        ),
    },
    {
        "id": "cat-negotiation-process",
        "name": "谈判流程",
        "slug": "negotiation-process",
        "order": 2,
        "children": (
            {"id": "cat-process-inquiry", "name": "询盘阶段", "slug": "process-inquiry", "order": 1},
            {"id": "cat-process-offer", "name": "报盘阶段", "slug": "process-offer", "order": 2},
            {"id": "cat-process-counter", "name": "还盘阶段", "slug": "process-counter", "order": 3},
            {"id": "cat-process-acceptance", "name": "成交阶段", "slug": "process-acceptance", "order": 4},
        ),
    },
    {
        "id": "cat-negotiation-skills",
        "name": "谈判技巧",
        "slug": "negotiation-skills",
        "order": 3,
        "children": (
            {"id": "cat-skill-price", "name": "价格谈判", "slug": "skill-price", "order": 1},
            {"id": "cat-skill-communication", "name": "沟通技巧", "slug": "skill-communication", "order": 2},
            {"id": "cat-skill-risk", "name": "风险管理", "slug": "skill-risk", "order": 3},
        ),
    },
    {
        "id": "cat-case-studies",
        "name": "实战案例",
        "slug": "case-studies",
        "order": 4,
        "children": (
            {"id": "cat-case-product", "name": "按产品分类", "slug": "case-product", "order": 1},
            {"id": "cat-case-market", "name": "按市场分类", "slug": "case-market", "order": 2},
            {"id": "cat-case-problem", "name": "按问题分类", "slug": "case-problem", "order": 3},
        ),
    },
    {
        "id": "cat-legal-compliance",
        "name": "法律法规",
        "slug": "legal-compliance",
        "order": 5,
        "children": (
            {"id": "cat-legal-conventions", "name": "国际公约", "slug": "legal-conventions", "order": 1},
            {"id": "cat-legal-customs", "name": "海关与物流", "slug": "legal-customs", "order": 2},
            {"id": "cat-legal-ip", "name": "知识产权", "slug": "legal-ip", "order": 3},
        ),
    },
)


_SLUG_PATTERN = re.compile(r"[^a-z0-9]+")


def _slugify(value: str) -> str:
    text = (value or "").strip().lower()
    text = _SLUG_PATTERN.sub("-", text)
    text = text.strip("-")
    return text or uuid4().hex[:8]


def _node_to_dict(node) -> Dict[str, object]:
    if node is None:
        return {}
    if isinstance(node, dict):
        return dict(node)
    if hasattr(node, "keys") and callable(node.keys):
        return {key: node.get(key) for key in node.keys()}
    return {}


def _neo4j_credentials() -> Tuple[str, str, str]:
    """Return connection credentials, falling back to local Docker defaults."""

    uri = os.getenv("NEO4J_URI", DEFAULT_NEO4J_URI)
    auth = os.getenv("NEO4J_AUTH", "")
    user = os.getenv("NEO4J_USER")
    password = os.getenv("NEO4J_PASSWORD")

    if auth and "/" in auth:
        auth_user, auth_password = auth.split("/", 1)
        user = user or auth_user
        if not password:
            password = auth_password

    user = user or DEFAULT_NEO4J_USER
    password = password or DEFAULT_NEO4J_PASSWORD

    if not uri:
        raise GraphUnavailableError("Neo4j URI is not configured")
    if not password:
        raise GraphUnavailableError("Neo4j password is not configured")

    return uri, user, password


def _disable_graph(reason: str) -> None:
    """Disable knowledge graph operations after a fatal connectivity issue."""

    global _GRAPH_DISABLED, _GRAPH_DISABLED_REASON
    close_driver()
    _GRAPH_DISABLED = True
    _GRAPH_DISABLED_REASON = reason


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
        _disable_graph(f"Failed to connect to Neo4j at {uri}: {exc}")
        raise GraphUnavailableError("Failed to connect to Neo4j") from exc

    _DRIVER = driver
    _GRAPH_DISABLED = False
    _GRAPH_DISABLED_REASON = ""
    return driver


def is_configured() -> bool:
    """Return True if Neo4j connection information is available."""

    disabled_flag = os.getenv("NEO4J_DISABLED", "").strip().lower()
    if disabled_flag in {"1", "true", "yes", "on"}:
        return False
    return True


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
        "CREATE CONSTRAINT knowledge_category_id IF NOT EXISTS FOR (c:KnowledgeCategory) REQUIRE c.id IS UNIQUE",
        "CREATE CONSTRAINT knowledge_category_slug IF NOT EXISTS FOR (c:KnowledgeCategory) REQUIRE c.slug IS UNIQUE",
    ]

    with driver.session() as session:
        for statement in statements:
            session.run(statement)


def apply_schema_migrations() -> None:
    """Ensure categories exist and new knowledge attributes are backfilled."""

    driver = _get_driver()
    with driver.session() as session:
        session.execute_write(_ensure_default_categories)
        session.execute_write(_backfill_knowledge_point_defaults)


def _ensure_default_categories(tx) -> None:
    def _merge_category(entry: Dict[str, object], parent_id: Optional[str]) -> None:
        category_id = str(entry.get("id"))
        name = str(entry.get("name") or category_id)
        slug = str(entry.get("slug") or name)
        order_index = int(entry.get("order", 0))
        description = str(entry.get("description") or "")

        tx.run(
            "MERGE (c:KnowledgeCategory {id: $id}) "
            "SET c.name = $name, c.slug = $slug, c.orderIndex = $orderIndex, c.description = $description",
            {
                "id": category_id,
                "name": name,
                "slug": slug,
                "orderIndex": order_index,
                "description": description,
            },
        )
        if parent_id:
            tx.run(
                "MATCH (parent:KnowledgeCategory {id: $parent}), (child:KnowledgeCategory {id: $child}) "
                "MERGE (parent)-[:HAS_CHILD]->(child) "
                "SET child.parentId = $parent",
                {"parent": parent_id, "child": category_id},
            )
        else:
            tx.run(
                "MATCH (c:KnowledgeCategory {id: $id}) "
                "REMOVE c.parentId",
                {"id": category_id},
            )

        children = entry.get("children") if isinstance(entry, dict) else None
        if isinstance(children, (list, tuple)):
            for child in children:
                if isinstance(child, dict):
                    _merge_category(child, category_id)

    for root_entry in DEFAULT_KNOWLEDGE_CATEGORIES:
        if isinstance(root_entry, dict):
            _merge_category(root_entry, None)


def _backfill_knowledge_point_defaults(tx) -> None:
    tx.run(
        "MATCH (k:KnowledgePoint) WHERE k.type IS NULL OR k.type = '' "
        "SET k.type = $type",
        {"type": DEFAULT_KNOWLEDGE_TYPE},
    )
    tx.run(
        "MATCH (k:KnowledgePoint) WHERE k.difficulty IS NULL OR k.difficulty = '' "
        "SET k.difficulty = $difficulty",
        {"difficulty": DEFAULT_KNOWLEDGE_DIFFICULTY},
    )
    tx.run(
        "MATCH (k:KnowledgePoint) WHERE k.importance IS NULL OR k.importance = '' "
        "SET k.importance = $importance",
        {"importance": DEFAULT_KNOWLEDGE_IMPORTANCE},
    )
    tx.run(
        "MATCH (k:KnowledgePoint) WHERE k.categoryId IS NULL OR k.categoryId = '' "
        "SET k.categoryId = $category",
        {"category": DEFAULT_KNOWLEDGE_CATEGORY_ID},
    )
    tx.run(
        "MATCH (k:KnowledgePoint) "
        "OPTIONAL MATCH (k)-[rel:BELONGS_TO]->(:KnowledgeCategory) "
        "WITH k, collect(rel) AS rels "
        "FOREACH (r IN rels | DELETE r) "
        "WITH k "
        "MATCH (target:KnowledgeCategory {id: k.categoryId}) "
        "MERGE (k)-[:BELONGS_TO]->(target)",
    )


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
        apply_schema_migrations()
        sync_static_content()
    except GraphUnavailableError as exc:  # pragma: no cover - depends on external service
        LOGGER.warning("Unable to bootstrap knowledge graph: %s", exc)
    except (Neo4jError, ServiceUnavailable, IncompleteCommit, OSError, TimeoutError) as exc:
        LOGGER.warning("Knowledge graph bootstrap failed: %s", exc)
        _disable_graph(f"Knowledge graph bootstrap failed: {exc}")


def sync_static_content() -> None:
    """Mirror the SQLite content hierarchy into Neo4j."""

    driver = _get_driver()

    chapters = database.list_level_hierarchy(include_prompts=True)
    theory_hierarchy = database.list_theory_hierarchy(
        include_content=True, published_only=False
    )

    try:
        with driver.session() as session:
            session.execute_write(_merge_process_steps)
            for chapter in chapters:
                session.execute_write(_merge_chapter, chapter)
                session.execute_write(_link_chapter_process, chapter["id"])
                for section in chapter.get("sections", []):
                    session.execute_write(_merge_practice, chapter, section)
                    preset = SECTION_KNOWLEDGE_PRESETS.get(section["id"], ())
                    if preset:
                        session.execute_write(
                            _ensure_practice_knowledge, section["id"], list(preset)
                        )

            for theory_chapter in theory_hierarchy:
                for topic in theory_chapter.get("topics", []):
                    if not topic.get("id"):
                        LOGGER.warning(
                            "Skipping theory topic with missing id in chapter %s",
                            theory_chapter.get("chapterId"),
                        )
                        continue
                    session.execute_write(_merge_theory_topic, topic)
                    for lesson in topic.get("lessons", []):
                        if not lesson.get("id"):
                            LOGGER.warning(
                                "Skipping theory lesson with missing id for topic %s",
                                topic.get("id"),
                            )
                            continue
                        session.execute_write(_merge_theory_lesson, topic, lesson)
                        preset = LESSON_KNOWLEDGE_PRESETS.get(lesson["id"], ())
                        if preset:
                            session.execute_write(
                                _ensure_lesson_knowledge, lesson["id"], list(preset)
                            )
    except (Neo4jError, ServiceUnavailable, IncompleteCommit, OSError, TimeoutError) as exc:
        LOGGER.error("Failed to synchronise static content with Neo4j: %s", exc)
        _disable_graph(f"Failed to synchronise static content: {exc}")
        raise GraphUnavailableError("Failed to synchronise static content") from exc


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


def _ensure_lesson_knowledge(tx, lesson_id: str, points: List[object]) -> None:
    existing = tx.run(
        (
            "MATCH (:TheoryLesson {id: $id})-[rel]->(k:KnowledgePoint) "
            "WHERE type(rel) = 'EXPLAINS' RETURN collect(k.name) AS names"
        ),
        {"id": lesson_id},
    ).single()
    if existing and existing["names"]:
        return
    normalized = _normalize_knowledge_point_payloads(points)
    if not normalized:
        return
    _set_lesson_knowledge_tx(tx, lesson_id, normalized)


def set_practice_knowledge_points(practice_id: str, points: Sequence[object]) -> None:
    driver = _get_driver()
    normalized_payloads = _normalize_knowledge_point_payloads(points)
    with driver.session() as session:
        session.execute_write(_set_practice_knowledge_tx, practice_id, normalized_payloads)


def _set_practice_knowledge_tx(
    tx,
    practice_id: str,
    points: Sequence[Dict[str, object]],
) -> None:
    record = tx.run(
        "MATCH (p:Practice {id: $id}) RETURN p", {"id": practice_id}
    ).single()
    if not record:
        raise GraphEntityNotFoundError(f"Practice {practice_id} not found")

    tx.run(
        "MATCH (:Practice {id: $id})-[rel:TESTS]->(:KnowledgePoint) DELETE rel",
        {"id": practice_id},
    )
    for payload in points:
        if not isinstance(payload, dict):
            continue
        name = payload.get("name")
        if not name:
            continue
        node_params, _ = _prepare_knowledge_parameters(payload)
        params = {
            "id": practice_id,
            "name": name,
            **node_params,
        }
        tx.run(
            "MATCH (p:Practice {id: $id}) "
            "MERGE (k:KnowledgePoint {name: $name}) "
            "SET k.summary = CASE WHEN $summary = '' THEN k.summary ELSE $summary END "
            "SET k.bodyHtml = CASE WHEN $bodyHtml = '' THEN k.bodyHtml ELSE $bodyHtml END "
            "SET k.imageUrl = CASE WHEN $imageUrl = '' THEN k.imageUrl ELSE $imageUrl END "
            "SET k.imageAlt = CASE WHEN $imageAlt = '' THEN k.imageAlt ELSE $imageAlt END "
            "SET k.sourceId = CASE WHEN $knowledgeId = '' THEN k.sourceId ELSE $knowledgeId END "
            "SET k.tags = CASE WHEN size($tags) = 0 THEN k.tags ELSE $tags END "
            "SET k.type = $type, k.difficulty = $difficulty, k.importance = $importance, k.categoryId = $categoryId "
            "WITH p, k, $categoryId AS categoryId "
            "OPTIONAL MATCH (k)-[existing:BELONGS_TO]->(:KnowledgeCategory) "
            "DELETE existing "
            "WITH p, k, categoryId "
            "MATCH (cat:KnowledgeCategory {id: categoryId}) "
            "MERGE (k)-[:BELONGS_TO]->(cat) "
            "MERGE (p)-[:TESTS]->(k)",
            params,
        )


def set_lesson_knowledge_points(lesson_id: str, points: Sequence[object]) -> None:
    driver = _get_driver()
    normalized = _normalize_knowledge_point_payloads(points)
    with driver.session() as session:
        session.execute_write(_set_lesson_knowledge_tx, lesson_id, normalized)


def _set_lesson_knowledge_tx(tx, lesson_id: str, points: Sequence[Dict[str, object]]) -> None:
    record = tx.run(
        "MATCH (l:TheoryLesson {id: $id}) RETURN l", {"id": lesson_id}
    ).single()
    if not record:
        raise GraphEntityNotFoundError(f"Theory lesson {lesson_id} not found")

    tx.run(
        (
            "MATCH (:TheoryLesson {id: $id})-[rel]->(:KnowledgePoint) "
            "WHERE type(rel) = 'EXPLAINS' DELETE rel"
        ),
        {"id": lesson_id},
    )
    for payload in points:
        if not isinstance(payload, dict):
            continue
        name = payload.get("name")
        if not name:
            continue
        node_params, rel_params = _prepare_knowledge_parameters(payload)
        params = {
            "id": lesson_id,
            "name": name,
            **node_params,
            **rel_params,
        }
        tx.run(
            "MATCH (l:TheoryLesson {id: $id}) "
            "MERGE (k:KnowledgePoint {name: $name}) "
            "SET k.summary = CASE WHEN $summary = '' THEN k.summary ELSE $summary END "
            "SET k.bodyHtml = CASE WHEN $bodyHtml = '' THEN k.bodyHtml ELSE $bodyHtml END "
            "SET k.imageUrl = CASE WHEN $imageUrl = '' THEN k.imageUrl ELSE $imageUrl END "
            "SET k.imageAlt = CASE WHEN $imageAlt = '' THEN k.imageAlt ELSE $imageAlt END "
            "SET k.sourceId = CASE WHEN $knowledgeId = '' THEN k.sourceId ELSE $knowledgeId END "
            "SET k.tags = CASE WHEN size($tags) = 0 THEN k.tags ELSE $tags END "
            "SET k.type = $type, k.difficulty = $difficulty, k.importance = $importance, k.categoryId = $categoryId "
            "WITH l, k, $categoryId AS categoryId, $anchorId AS anchorId, $summary AS summary, "
            "$bodyHtml AS bodyHtml, $imageUrl AS imageUrl, $imageAlt AS imageAlt, $tags AS tags "
            "OPTIONAL MATCH (k)-[existing:BELONGS_TO]->(:KnowledgeCategory) "
            "DELETE existing "
            "WITH l, k, categoryId, anchorId, summary, bodyHtml, imageUrl, imageAlt, tags "
            "MATCH (cat:KnowledgeCategory {id: categoryId}) "
            "MERGE (k)-[:BELONGS_TO]->(cat) "
            "MERGE (l)-[rel:EXPLAINS]->(k) "
            "SET rel.anchorId = CASE WHEN anchorId = '' THEN rel.anchorId ELSE anchorId END "
            "SET rel.summary = CASE WHEN summary = '' THEN rel.summary ELSE summary END "
            "SET rel.bodyHtml = CASE WHEN bodyHtml = '' THEN rel.bodyHtml ELSE bodyHtml END "
            "SET rel.imageUrl = CASE WHEN imageUrl = '' THEN rel.imageUrl ELSE imageUrl END "
            "SET rel.imageAlt = CASE WHEN imageAlt = '' THEN rel.imageAlt ELSE imageAlt END "
            "SET rel.tags = CASE WHEN size(tags) = 0 THEN rel.tags ELSE tags END",
            params,
        )


def _normalize_knowledge_point_payloads(points: Sequence[object]) -> List[Dict[str, object]]:
    """Normalize arbitrary knowledge point payloads into consistent objects."""

    normalized: List[Dict[str, object]] = []
    by_name: Dict[str, Dict[str, object]] = {}

    def _clean_string(value: object) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        return str(value).strip()

    def _merge_payload(target: Dict[str, object], source: Dict[str, object]) -> None:
        for key, raw_value in source.items():
            if key == "name":
                continue
            if raw_value is None:
                continue
            if key == "tags":
                existing = target.get("tags")
                merged: List[str] = []
                if isinstance(existing, list):
                    merged.extend(str(tag) for tag in existing if str(tag))
                for tag in raw_value:
                    tag_value = _clean_string(tag)
                    if not tag_value:
                        continue
                    if tag_value not in merged:
                        merged.append(tag_value)
                if merged:
                    target["tags"] = merged
                continue
            if key in {"categoryId", "categoryName", "type", "difficulty", "importance"}:
                text = _clean_string(raw_value)
                if text:
                    target[key] = text
                continue
            cleaned_value = raw_value
            if isinstance(raw_value, str):
                cleaned_value = raw_value.strip()
            target[key] = cleaned_value

    for entry in points:
        if isinstance(entry, str):
            name = entry.strip()
            payload: Dict[str, object] = {"name": name}
        elif isinstance(entry, dict):
            candidate = (
                entry.get("name")
                or entry.get("title")
                or entry.get("label")
                or entry.get("id")
            )
            name = _clean_string(candidate)
            payload = {"name": name}
            summary = _clean_string(entry.get("summary") or entry.get("description"))
            if summary:
                payload["summary"] = summary
            body_html = entry.get("bodyHtml") or entry.get("html") or entry.get("body")
            if isinstance(body_html, str) and body_html.strip():
                payload["bodyHtml"] = body_html
            image_url = _clean_string(entry.get("imageUrl") or entry.get("image") or entry.get("coverUrl"))
            if image_url:
                payload["imageUrl"] = image_url
            image_alt = _clean_string(entry.get("imageAlt") or entry.get("alt"))
            if image_alt:
                payload["imageAlt"] = image_alt
            anchor_id = _clean_string(entry.get("anchorId") or entry.get("anchor"))
            if anchor_id:
                payload["anchorId"] = anchor_id
            source_id = _clean_string(entry.get("knowledgeId") or entry.get("sourceId"))
            if source_id:
                payload["knowledgeId"] = source_id
            tags_field = entry.get("tags")
            tags: List[str] = []
            if isinstance(tags_field, (list, tuple)):
                tags = [_clean_string(tag) for tag in tags_field if _clean_string(tag)]
            elif isinstance(tags_field, str):
                tags = [tag.strip() for tag in tags_field.split(",") if tag.strip()]
            if tags:
                payload["tags"] = tags
            category_id = _clean_string(entry.get("categoryId"))
            category_name = _clean_string(entry.get("categoryName"))
            category_field = entry.get("category")
            if isinstance(category_field, dict):
                category_id = category_id or _clean_string(category_field.get("id"))
                category_name = category_name or _clean_string(category_field.get("name"))
            elif isinstance(category_field, str) and category_field.strip():
                if not category_name:
                    category_name = category_field.strip()
            if category_id:
                payload["categoryId"] = category_id
            if category_name:
                payload["categoryName"] = category_name
            knowledge_type = _clean_string(entry.get("type") or entry.get("knowledgeType"))
            if knowledge_type:
                payload["type"] = knowledge_type
            difficulty = _clean_string(entry.get("difficulty"))
            if difficulty:
                payload["difficulty"] = difficulty
            importance = _clean_string(entry.get("importance"))
            if importance:
                payload["importance"] = importance
        else:
            continue

        name = payload.get("name", "")
        if not isinstance(name, str):
            name = str(name)
        cleaned_name = name.strip()
        if not cleaned_name:
            continue
        payload["name"] = cleaned_name

        existing = by_name.get(cleaned_name)
        if existing:
            _merge_payload(existing, payload)
            continue

        by_name[cleaned_name] = payload
        normalized.append(payload)

    return normalized


def _prepare_knowledge_parameters(
    payload: Dict[str, object],
) -> Tuple[Dict[str, object], Dict[str, object]]:
    def _as_text(value: object) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value.strip()
        return str(value).strip()

    summary = _as_text(payload.get("summary"))
    body_html = payload.get("bodyHtml")
    body_text = body_html if isinstance(body_html, str) else ""
    image_url = _as_text(payload.get("imageUrl"))
    image_alt = _as_text(payload.get("imageAlt"))
    anchor_id = _as_text(payload.get("anchorId"))
    knowledge_id = _as_text(payload.get("knowledgeId"))
    knowledge_type = _as_text(payload.get("type")) or DEFAULT_KNOWLEDGE_TYPE
    difficulty = _as_text(payload.get("difficulty")) or DEFAULT_KNOWLEDGE_DIFFICULTY
    importance = _as_text(payload.get("importance")) or DEFAULT_KNOWLEDGE_IMPORTANCE
    category_id = _as_text(payload.get("categoryId")) or "cat-unassigned"

    tags_list: List[str] = []
    tags_field = payload.get("tags")
    if isinstance(tags_field, (list, tuple)):
        for tag in tags_field:
            value = _as_text(tag)
            if value and value not in tags_list:
                tags_list.append(value)
    elif isinstance(tags_field, str):
        for tag in tags_field.split(","):
            value = tag.strip()
            if value and value not in tags_list:
                tags_list.append(value)

    node_params = {
        "summary": summary,
        "bodyHtml": body_text,
        "imageUrl": image_url,
        "imageAlt": image_alt,
        "knowledgeId": knowledge_id,
        "tags": tags_list,
        "type": knowledge_type,
        "difficulty": difficulty,
        "importance": importance,
        "categoryId": category_id,
    }
    rel_params = {
        "summary": summary,
        "bodyHtml": body_text,
        "imageUrl": image_url,
        "imageAlt": image_alt,
        "anchorId": anchor_id,
        "tags": tags_list,
    }
    return node_params, rel_params


def _build_knowledge_point_payload(record: Dict[str, object]) -> Optional[Dict[str, object]]:
    base = {
        "name": record.get("name"),
        "summary": record.get("summary"),
        "bodyHtml": record.get("bodyHtml"),
        "imageUrl": record.get("imageUrl"),
        "imageAlt": record.get("imageAlt"),
        "knowledgeId": record.get("knowledgeId"),
        "tags": record.get("tags") or [],
        "type": record.get("type"),
        "difficulty": record.get("difficulty"),
        "importance": record.get("importance"),
        "categoryId": record.get("categoryId"),
        "categoryName": record.get("categoryName"),
    }
    normalized = _normalize_knowledge_point_payloads([base])
    if not normalized:
        return None
    payload = normalized[0]
    payload["practiceCount"] = int(record.get("practiceCount", 0) or 0)
    payload["lessonCount"] = int(record.get("lessonCount", 0) or 0)
    return payload


def get_practice_detail(practice_id: str) -> Dict[str, object]:
    try:
        records = _execute_read(
            """
            MATCH (p:Practice {id: $id})
            OPTIONAL MATCH (p)-[:TESTS]->(k:KnowledgePoint)
            OPTIONAL MATCH (k)-[:BELONGS_TO]->(cat:KnowledgeCategory)
            OPTIONAL MATCH (c:Chapter)-[:HAS_PRACTICE]->(p)
            RETURN p AS practice,
                   collect(DISTINCT CASE WHEN k IS NULL THEN NULL ELSE {
                     name: k.name,
                     summary: k.summary,
                     bodyHtml: k.bodyHtml,
                     imageUrl: k.imageUrl,
                     imageAlt: k.imageAlt,
                     knowledgeId: k.sourceId,
                     tags: k.tags,
                     type: k.type,
                     difficulty: k.difficulty,
                     importance: k.importance,
                     categoryId: k.categoryId,
                     categoryName: cat.name
                   } END) AS knowledge,
                   c.id AS chapterId
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
        "knowledgePoints": _normalize_knowledge_point_payloads(record.get("knowledge") or []),
    }
    return payload


def get_lesson_detail(lesson_id: str) -> Dict[str, object]:
    try:
        records = _execute_read(
            """
            MATCH (l:TheoryLesson {id: $id})
            OPTIONAL MATCH (l)-[rel]->(k:KnowledgePoint)
            WHERE type(rel) = 'EXPLAINS'
            OPTIONAL MATCH (t:TheoryTopic)-[:HAS_LESSON]->(l)
            OPTIONAL MATCH (k)-[:BELONGS_TO]->(cat:KnowledgeCategory)
            WITH l,
                 t,
                 CASE WHEN rel IS NULL THEN {} ELSE properties(rel) END AS relProps,
                 CASE WHEN k IS NULL THEN {} ELSE properties(k) END AS kProps,
                 cat
            RETURN l AS lesson,
                   collect(DISTINCT CASE WHEN k IS NULL THEN NULL ELSE {
                     name: kProps['name'],
                     summary: coalesce(relProps['summary'], kProps['summary']),
                     bodyHtml: coalesce(relProps['bodyHtml'], kProps['bodyHtml']),
                     imageUrl: coalesce(relProps['imageUrl'], kProps['imageUrl']),
                     imageAlt: coalesce(relProps['imageAlt'], kProps['imageAlt']),
                     anchorId: relProps['anchorId'],
                     tags: relProps['tags'],
                     knowledgeId: kProps['sourceId'],
                     type: kProps['type'],
                     difficulty: kProps['difficulty'],
                     importance: kProps['importance'],
                     categoryId: kProps['categoryId'],
                     categoryName: cat.name
                   } END) AS knowledge,
                   t.id AS topicId
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
    raw_knowledge = [item for item in (record.get("knowledge") or []) if item]
    return {
        "id": lesson.get("id"),
        "title": lesson.get("title"),
        "code": lesson.get("code"),
        "topicId": record.get("topicId"),
        "knowledgePoints": _normalize_knowledge_point_payloads(raw_knowledge),
    }


def list_knowledge_points() -> List[Dict[str, object]]:
    records = _execute_read(
        """
        MATCH (k:KnowledgePoint)
        OPTIONAL MATCH (k)<-[:TESTS]-(p:Practice)
        OPTIONAL MATCH (k)<-[rel]-(l:TheoryLesson)
        WHERE rel IS NULL OR type(rel) = 'EXPLAINS'
        OPTIONAL MATCH (k)-[:BELONGS_TO]->(cat:KnowledgeCategory)
        RETURN k.name AS name,
               k.summary AS summary,
               k.bodyHtml AS bodyHtml,
               k.imageUrl AS imageUrl,
               k.imageAlt AS imageAlt,
               k.sourceId AS knowledgeId,
               k.tags AS tags,
               k.type AS type,
               k.difficulty AS difficulty,
               k.importance AS importance,
               k.categoryId AS categoryId,
               cat.name AS categoryName,
               count(DISTINCT p) AS practiceCount,
               count(DISTINCT l) AS lessonCount
        ORDER BY name
        """,
    )
    payloads: List[Dict[str, object]] = []
    for record in records:
        payload = _build_knowledge_point_payload(record)
        if payload:
            payloads.append(payload)
    return payloads


def list_knowledge_categories() -> List[Dict[str, object]]:
    records = _execute_read(
        """
        MATCH (c:KnowledgeCategory)
        OPTIONAL MATCH (parent:KnowledgeCategory)-[:HAS_CHILD]->(c)
        RETURN c AS category, parent.id AS parentId
        ORDER BY c.orderIndex, c.name
        """,
    )

    nodes: Dict[str, Dict[str, object]] = {}
    order_pairs: List[Tuple[str, Optional[str]]] = []
    for record in records:
        raw = _node_to_dict(record.get("category"))
        category_id = raw.get("id")
        if not category_id:
            continue
        data = nodes.get(category_id)
        if not data:
            data = {
                "id": category_id,
                "name": raw.get("name"),
                "slug": raw.get("slug"),
                "description": raw.get("description"),
                "orderIndex": raw.get("orderIndex", 0),
                "parentId": record.get("parentId") or raw.get("parentId"),
                "children": [],
            }
            nodes[category_id] = data
        else:
            data.update(
                {
                    "name": raw.get("name") or data.get("name"),
                    "slug": raw.get("slug") or data.get("slug"),
                    "description": raw.get("description") or data.get("description"),
                    "orderIndex": raw.get("orderIndex", data.get("orderIndex", 0)),
                    "parentId": record.get("parentId")
                    or raw.get("parentId")
                    or data.get("parentId"),
                }
            )
        order_pairs.append((category_id, record.get("parentId") or raw.get("parentId")))

    roots: List[Dict[str, object]] = []
    for category_id, parent_id in order_pairs:
        node = nodes.get(category_id)
        if not node:
            continue
        node_parent_id = parent_id or node.get("parentId")
        node["parentId"] = node_parent_id
        if node_parent_id and node_parent_id in nodes:
            parent = nodes[node_parent_id]
            if node not in parent.setdefault("children", []):
                parent["children"].append(node)
        elif node not in roots:
            roots.append(node)

    def _sort_node(node: Dict[str, object]) -> None:
        children = node.get("children") or []
        children.sort(key=lambda item: ((item.get("orderIndex") or 0), item.get("name") or ""))
        node["children"] = children
        for child in children:
            _sort_node(child)

    def _assign_path(node: Dict[str, object], ancestors: List[str]) -> None:
        path = ancestors + [node.get("name") or ""]
        node["path"] = [segment for segment in path if segment]
        for child in node.get("children", []):
            _assign_path(child, node["path"])

    roots.sort(key=lambda item: ((item.get("orderIndex") or 0), item.get("name") or ""))
    for root in roots:
        _sort_node(root)
        _assign_path(root, [])

    return roots


def _ensure_unique_slug(tx, base_slug: str) -> str:
    slug = base_slug or uuid4().hex[:8]
    candidate = slug
    index = 1
    while True:
        record = tx.run(
            "MATCH (c:KnowledgeCategory {slug: $slug}) RETURN c", {"slug": candidate}
        ).single()
        if not record:
            return candidate
        candidate = f"{slug}-{index}"
        index += 1


def _fetch_category_by_id_tx(tx, category_id: str) -> Dict[str, object]:
    record = tx.run(
        """
        MATCH (c:KnowledgeCategory {id: $id})
        OPTIONAL MATCH (parent:KnowledgeCategory)-[:HAS_CHILD]->(c)
        RETURN c AS category, parent.id AS parentId
        """,
        {"id": category_id},
    ).single()
    if not record:
        raise GraphEntityNotFoundError(f"Knowledge category {category_id} not found")
    raw = _node_to_dict(record.get("category"))
    payload = {
        "id": raw.get("id"),
        "name": raw.get("name"),
        "slug": raw.get("slug"),
        "description": raw.get("description"),
        "orderIndex": raw.get("orderIndex", 0),
        "parentId": record.get("parentId") or raw.get("parentId"),
        "children": [],
    }
    return payload


def create_knowledge_category(
    name: str,
    *,
    parent_id: Optional[str] = None,
    description: str = "",
    order_index: Optional[int] = None,
) -> Dict[str, object]:
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise GraphValidationError("分类名称不能为空")

    driver = _get_driver()
    with driver.session() as session:
        return session.execute_write(
            _create_category_tx,
            cleaned_name,
            parent_id,
            description or "",
            order_index,
        )


def _create_category_tx(
    tx,
    name: str,
    parent_id: Optional[str],
    description: str,
    order_index: Optional[int],
) -> Dict[str, object]:
    if parent_id:
        parent = tx.run(
            "MATCH (p:KnowledgeCategory {id: $id}) RETURN p", {"id": parent_id}
        ).single()
        if not parent:
            raise GraphEntityNotFoundError(f"Knowledge category {parent_id} not found")

    base_slug = _slugify(name)
    slug = _ensure_unique_slug(tx, base_slug)

    if order_index is None:
        if parent_id:
            result = tx.run(
                """
                MATCH (:KnowledgeCategory {id: $parent})-[:HAS_CHILD]->(child)
                RETURN coalesce(max(child.orderIndex), 0) AS maxOrder
                """,
                {"parent": parent_id},
            ).single()
        else:
            result = tx.run(
                """
                MATCH (child:KnowledgeCategory)
                WHERE NOT (child)<-[:HAS_CHILD]-(:KnowledgeCategory)
                RETURN coalesce(max(child.orderIndex), 0) AS maxOrder
                """,
            ).single()
        order_index = int(result.get("maxOrder", 0) or 0) + 1
    else:
        order_index = int(order_index)

    category_id = f"cat-{uuid4().hex}"
    tx.run(
        "CREATE (c:KnowledgeCategory {id: $id, name: $name, slug: $slug, description: $description, orderIndex: $orderIndex})",
        {
            "id": category_id,
            "name": name,
            "slug": slug,
            "description": description,
            "orderIndex": order_index,
        },
    )
    if parent_id:
        tx.run(
            "MATCH (parent:KnowledgeCategory {id: $parent}), (c:KnowledgeCategory {id: $id}) "
            "MERGE (parent)-[:HAS_CHILD]->(c) "
            "SET c.parentId = $parent",
            {"parent": parent_id, "id": category_id},
        )
    else:
        tx.run("MATCH (c:KnowledgeCategory {id: $id}) REMOVE c.parentId", {"id": category_id})

    return _fetch_category_by_id_tx(tx, category_id)


def update_knowledge_category(
    category_id: str,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    order_index: Optional[int] = None,
    parent_id: object = _UNSPECIFIED,
) -> Dict[str, object]:
    cleaned_id = (category_id or "").strip()
    if not cleaned_id:
        raise GraphValidationError("分类ID不能为空")

    driver = _get_driver()
    with driver.session() as session:
        return session.execute_write(
            _update_category_tx,
            cleaned_id,
            name,
            description,
            order_index,
            parent_id,
        )


def _update_category_tx(
    tx,
    category_id: str,
    name: Optional[str],
    description: Optional[str],
    order_index: Optional[int],
    parent_id: object,
) -> Dict[str, object]:
    record = tx.run(
        "MATCH (c:KnowledgeCategory {id: $id}) RETURN c", {"id": category_id}
    ).single()
    if not record:
        raise GraphEntityNotFoundError(f"Knowledge category {category_id} not found")

    raw = _node_to_dict(record.get("c"))
    updated_name = (name or raw.get("name") or "").strip()
    if not updated_name:
        raise GraphValidationError("分类名称不能为空")

    slug = raw.get("slug") or _slugify(updated_name)
    if name and name.strip() and name.strip() != raw.get("name"):
        slug = _ensure_unique_slug(tx, _slugify(name))

    updated_description = (
        description if description is not None else raw.get("description") or ""
    )
    if order_index is None:
        updated_order = int(raw.get("orderIndex", 0) or 0)
    else:
        updated_order = int(order_index)

    tx.run(
        "MATCH (c:KnowledgeCategory {id: $id}) "
        "SET c.name = $name, c.slug = $slug, c.description = $description, c.orderIndex = $orderIndex",
        {
            "id": category_id,
            "name": updated_name,
            "slug": slug,
            "description": updated_description,
            "orderIndex": updated_order,
        },
    )

    if parent_id is not _UNSPECIFIED:
        if parent_id:
            if parent_id == category_id:
                raise GraphValidationError("父分类不能与自身相同")
            parent = tx.run(
                "MATCH (p:KnowledgeCategory {id: $id}) RETURN p", {"id": parent_id}
            ).single()
            if not parent:
                raise GraphEntityNotFoundError(f"Knowledge category {parent_id} not found")
        tx.run(
            "MATCH (:KnowledgeCategory)-[rel:HAS_CHILD]->(c:KnowledgeCategory {id: $id}) DELETE rel",
            {"id": category_id},
        )
        if parent_id:
            tx.run(
                "MATCH (parent:KnowledgeCategory {id: $parent}), (c:KnowledgeCategory {id: $id}) "
                "MERGE (parent)-[:HAS_CHILD]->(c) "
                "SET c.parentId = $parent",
                {"parent": parent_id, "id": category_id},
            )
        else:
            tx.run(
                "MATCH (c:KnowledgeCategory {id: $id}) REMOVE c.parentId",
                {"id": category_id},
            )

    return _fetch_category_by_id_tx(tx, category_id)


def delete_knowledge_category(
    category_id: str,
    *,
    fallback_id: Optional[str] = None,
) -> None:
    cleaned_id = (category_id or "").strip()
    if not cleaned_id:
        raise GraphValidationError("分类ID不能为空")
    fallback = (fallback_id or DEFAULT_KNOWLEDGE_CATEGORY_ID).strip()

    driver = _get_driver()
    with driver.session() as session:
        session.execute_write(_delete_category_tx, cleaned_id, fallback)


def _delete_category_tx(tx, category_id: str, fallback_id: str) -> None:
    if category_id == fallback_id:
        raise GraphConflictError("无法删除默认分类")

    record = tx.run(
        "MATCH (c:KnowledgeCategory {id: $id}) RETURN c", {"id": category_id}
    ).single()
    if not record:
        raise GraphEntityNotFoundError(f"Knowledge category {category_id} not found")

    children = tx.run(
        "MATCH (c:KnowledgeCategory {id: $id})-[:HAS_CHILD]->(child) RETURN count(child) AS childCount",
        {"id": category_id},
    ).single()
    if children and int(children.get("childCount", 0) or 0) > 0:
        raise GraphConflictError("请先移除或迁移该分类下的子分类")

    fallback = tx.run(
        "MATCH (f:KnowledgeCategory {id: $id}) RETURN f", {"id": fallback_id}
    ).single()
    if not fallback:
        raise GraphEntityNotFoundError(f"Fallback category {fallback_id} not found")

    tx.run(
        """
        MATCH (c:KnowledgeCategory {id: $id})<-[rel:BELONGS_TO]-(k:KnowledgePoint)
        WITH c, collect(rel) AS rels, collect(k) AS knowledge
        FOREACH (r IN rels | DELETE r)
        WITH knowledge
        MATCH (fallback:KnowledgeCategory {id: $fallback})
        FOREACH (kp IN knowledge | MERGE (kp)-[:BELONGS_TO]->(fallback) SET kp.categoryId = $fallback)
        """,
        {"id": category_id, "fallback": fallback_id},
    )
    tx.run(
        "MATCH (:KnowledgeCategory)-[rel:HAS_CHILD]->(c:KnowledgeCategory {id: $id}) DELETE rel",
        {"id": category_id},
    )
    tx.run(
        "MATCH (c:KnowledgeCategory {id: $id}) DETACH DELETE c",
        {"id": category_id},
    )


def _fetch_knowledge_point_tx(tx, name: str) -> Dict[str, object]:
    record = tx.run(
        """
        MATCH (k:KnowledgePoint {name: $name})
        OPTIONAL MATCH (k)-[:BELONGS_TO]->(cat:KnowledgeCategory)
        OPTIONAL MATCH (k)<-[:TESTS]-(p:Practice)
        OPTIONAL MATCH (k)<-[rel:EXPLAINS]-(l:TheoryLesson)
        RETURN k AS node,
               cat AS category,
               count(DISTINCT p) AS practiceCount,
               count(DISTINCT l) AS lessonCount
        """,
        {"name": name},
    ).single()
    if not record:
        raise GraphEntityNotFoundError(f"Knowledge point {name} not found")

    node = _node_to_dict(record.get("node"))
    category = _node_to_dict(record.get("category"))
    base_record = {
        "name": node.get("name"),
        "summary": node.get("summary"),
        "bodyHtml": node.get("bodyHtml"),
        "imageUrl": node.get("imageUrl"),
        "imageAlt": node.get("imageAlt"),
        "knowledgeId": node.get("sourceId"),
        "tags": node.get("tags"),
        "type": node.get("type"),
        "difficulty": node.get("difficulty"),
        "importance": node.get("importance"),
        "categoryId": node.get("categoryId"),
        "categoryName": category.get("name"),
        "practiceCount": record.get("practiceCount", 0),
        "lessonCount": record.get("lessonCount", 0),
    }
    payload = _build_knowledge_point_payload(base_record)
    if not payload:
        raise GraphEntityNotFoundError(f"Knowledge point {name} not found")
    return payload


def get_knowledge_point(name: str) -> Dict[str, object]:
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise GraphValidationError("知识点名称不能为空")

    driver = _get_driver()
    with driver.session() as session:
        return session.execute_read(_fetch_knowledge_point_tx, cleaned_name)


def save_knowledge_point(
    payload: Dict[str, object],
    *,
    previous_name: Optional[str] = None,
) -> Dict[str, object]:
    normalized = _normalize_knowledge_point_payloads([payload])
    if not normalized:
        raise GraphValidationError("知识点名称不能为空")
    data = normalized[0]
    cleaned_prev = (
        previous_name
        or payload.get("previousName")
        or payload.get("originalName")
        or data.get("name")
        or ""
    )

    driver = _get_driver()
    with driver.session() as session:
        return session.execute_write(_save_knowledge_point_tx, cleaned_prev, data)


def _save_knowledge_point_tx(
    tx,
    previous_name: Optional[str],
    data: Dict[str, object],
) -> Dict[str, object]:
    name = (data.get("name") or "").strip()
    if not name:
        raise GraphValidationError("知识点名称不能为空")

    prev_name = (previous_name or "").strip() or name

    if prev_name != name:
        existing_new = tx.run(
            "MATCH (k:KnowledgePoint {name: $name}) RETURN k", {"name": name}
        ).single()
        if existing_new:
            raise GraphConflictError(f"知识点“{name}”已存在")
        existing_prev = tx.run(
            "MATCH (k:KnowledgePoint {name: $name}) RETURN k", {"name": prev_name}
        ).single()
        if existing_prev:
            tx.run(
                "MATCH (k:KnowledgePoint {name: $prev}) SET k.name = $name",
                {"prev": prev_name, "name": name},
            )

    node_params, _ = _prepare_knowledge_parameters(data)
    tx.run(
        "MERGE (k:KnowledgePoint {name: $name}) "
        "SET k.summary = $summary, "
        "    k.bodyHtml = $bodyHtml, "
        "    k.imageUrl = $imageUrl, "
        "    k.imageAlt = $imageAlt, "
        "    k.sourceId = $knowledgeId, "
        "    k.tags = $tags, "
        "    k.type = $type, "
        "    k.difficulty = $difficulty, "
        "    k.importance = $importance, "
        "    k.categoryId = $categoryId",
        {"name": name, **node_params},
    )
    tx.run(
        "MATCH (k:KnowledgePoint {name: $name}) "
        "OPTIONAL MATCH (k)-[rel:BELONGS_TO]->(:KnowledgeCategory) "
        "DELETE rel",
        {"name": name},
    )
    tx.run(
        "MATCH (k:KnowledgePoint {name: $name}), (cat:KnowledgeCategory {id: $categoryId}) "
        "MERGE (k)-[:BELONGS_TO]->(cat)",
        {"name": name, "categoryId": node_params["categoryId"]},
    )

    return _fetch_knowledge_point_tx(tx, name)


def bulk_import_knowledge_points(payloads: Sequence[object]) -> Dict[str, int]:
    normalized = _normalize_knowledge_point_payloads(payloads)
    if not normalized:
        raise GraphValidationError("未检测到有效的知识点记录")

    driver = _get_driver()
    with driver.session() as session:
        return session.execute_write(_bulk_import_knowledge_tx, normalized)


def _bulk_import_knowledge_tx(tx, payloads: Sequence[Dict[str, object]]) -> Dict[str, int]:
    summary = {"created": 0, "updated": 0, "skipped": 0}
    for payload in payloads:
        name = (payload.get("name") or "").strip()
        if not name:
            summary["skipped"] += 1
            continue
        node_params, _ = _prepare_knowledge_parameters(payload)
        existing = tx.run(
            "MATCH (k:KnowledgePoint {name: $name}) RETURN k", {"name": name}
        ).single()
        created = existing is None
        tx.run(
            "MERGE (k:KnowledgePoint {name: $name}) "
            "SET k.summary = $summary, "
            "    k.bodyHtml = $bodyHtml, "
            "    k.imageUrl = $imageUrl, "
            "    k.imageAlt = $imageAlt, "
            "    k.sourceId = $knowledgeId, "
            "    k.tags = $tags, "
            "    k.type = $type, "
            "    k.difficulty = $difficulty, "
            "    k.importance = $importance, "
            "    k.categoryId = $categoryId",
            {"name": name, **node_params},
        )
        tx.run(
            "MATCH (k:KnowledgePoint {name: $name}) "
            "OPTIONAL MATCH (k)-[rel:BELONGS_TO]->(:KnowledgeCategory) "
            "DELETE rel",
            {"name": name},
        )
        tx.run(
            "MATCH (k:KnowledgePoint {name: $name}), (cat:KnowledgeCategory {id: $categoryId}) "
            "MERGE (k)-[:BELONGS_TO]->(cat)",
            {"name": name, "categoryId": node_params["categoryId"]},
        )
        if created:
            summary["created"] += 1
        else:
            summary["updated"] += 1

    return summary

def get_related_practices_for_lesson(lesson_id: str) -> List[Dict[str, object]]:
    try:
        return _execute_read(
            """
            MATCH (l:TheoryLesson {id: $id})-[rel]->(k:KnowledgePoint)<-[:TESTS]-(p:Practice)
            WHERE type(rel) = 'EXPLAINS'
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
            MATCH (p:Practice {id: $id})-[:TESTS]->(k:KnowledgePoint)<-[rel]-(l:TheoryLesson)
            WHERE type(rel) = 'EXPLAINS'
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
        "KnowledgeCategory",
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
        "KnowledgeCategory",
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
    if label == "KnowledgeCategory":
        return node.get("id") or node.get("slug") or node.get("name")
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
    if label == "KnowledgeCategory":
        return node.get("description")
    return node.get("description")

