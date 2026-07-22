"""
Migration 001: Enhance Knowledge Graph Schema
增强知识图谱模式 - 添加知识点分类和属性

This migration:
1. 为KnowledgePoint添加新属性
2. 创建KnowledgeCategory节点
3. 创建默认分类体系
4. 添加索引和约束
5. 迁移现有数据
"""

import logging
from datetime import datetime
from typing import List, Dict

LOGGER = logging.getLogger(__name__)


# ============================================
# 默认知识分类体系
# ============================================

DEFAULT_CATEGORIES = [
    # 一级分类
    {
        "id": "trade-fundamentals",
        "name": "贸易基础",
        "code": "TF",
        "level": 1,
        "orderIndex": 1,
        "icon": "📦",
        "color": "#3B82F6",
        "description": "国际贸易基础知识，包括术语、支付、文档等",
        "isActive": True,
        "children": [
            {
                "id": "incoterms",
                "name": "贸易术语",
                "code": "TF-IT",
                "level": 2,
                "orderIndex": 1,
                "icon": "🏷️",
                "color": "#60A5FA",
                "description": "Incoterms国际贸易术语，如FOB、CIF等",
                "isActive": True,
            },
            {
                "id": "payment-terms",
                "name": "支付方式",
                "code": "TF-PT",
                "level": 2,
                "orderIndex": 2,
                "icon": "💳",
                "color": "#60A5FA",
                "description": "国际支付工具和方式，如信用证、电汇等",
                "isActive": True,
            },
            {
                "id": "trade-documents",
                "name": "贸易文档",
                "code": "TF-TD",
                "level": 2,
                "orderIndex": 3,
                "icon": "📄",
                "color": "#60A5FA",
                "description": "贸易相关单证，如发票、提单等",
                "isActive": True,
            },
        ],
    },
    {
        "id": "negotiation-process",
        "name": "谈判流程",
        "code": "NP",
        "level": 1,
        "orderIndex": 2,
        "icon": "🔄",
        "color": "#10B981",
        "description": "国际贸易谈判的标准流程和阶段",
        "isActive": True,
        "children": [
            {
                "id": "inquiry",
                "name": "询盘阶段",
                "code": "NP-IN",
                "level": 2,
                "orderIndex": 1,
                "icon": "❓",
                "color": "#34D399",
                "description": "客户询盘和需求澄清",
                "isActive": True,
            },
            {
                "id": "offer",
                "name": "报盘阶段",
                "code": "NP-OF",
                "level": 2,
                "orderIndex": 2,
                "icon": "📊",
                "color": "#34D399",
                "description": "价格报盘和条款制定",
                "isActive": True,
            },
            {
                "id": "counter-offer",
                "name": "还盘阶段",
                "code": "NP-CO",
                "level": 2,
                "orderIndex": 3,
                "icon": "🔃",
                "color": "#34D399",
                "description": "价格和条款协商",
                "isActive": True,
            },
            {
                "id": "acceptance",
                "name": "接受与订货",
                "code": "NP-AC",
                "level": 2,
                "orderIndex": 4,
                "icon": "✅",
                "color": "#34D399",
                "description": "达成协议和订单确认",
                "isActive": True,
            },
        ],
    },
    {
        "id": "negotiation-skills",
        "name": "谈判技巧",
        "code": "NS",
        "level": 1,
        "orderIndex": 3,
        "icon": "🎯",
        "color": "#F59E0B",
        "description": "有效的谈判策略和沟通技巧",
        "isActive": True,
        "children": [
            {
                "id": "pricing-strategy",
                "name": "价格策略",
                "code": "NS-PS",
                "level": 2,
                "orderIndex": 1,
                "icon": "💰",
                "color": "#FBBF24",
                "description": "价格谈判技巧，如锚定、让步等",
                "isActive": True,
            },
            {
                "id": "communication",
                "name": "沟通技巧",
                "code": "NS-CM",
                "level": 2,
                "orderIndex": 2,
                "icon": "💬",
                "color": "#FBBF24",
                "description": "商务邮件、电话沟通等",
                "isActive": True,
            },
            {
                "id": "cross-culture",
                "name": "跨文化交际",
                "code": "NS-CC",
                "level": 2,
                "orderIndex": 3,
                "icon": "🌍",
                "color": "#FBBF24",
                "description": "不同文化背景下的沟通要点",
                "isActive": True,
            },
        ],
    },
    {
        "id": "risk-management",
        "name": "风险管理",
        "code": "RM",
        "level": 1,
        "orderIndex": 4,
        "icon": "🛡️",
        "color": "#EF4444",
        "description": "贸易风险识别和防范",
        "isActive": True,
        "children": [
            {
                "id": "payment-risk",
                "name": "支付风险",
                "code": "RM-PR",
                "level": 2,
                "orderIndex": 1,
                "icon": "⚠️",
                "color": "#F87171",
                "description": "收汇风险和信用管理",
                "isActive": True,
            },
            {
                "id": "logistics-risk",
                "name": "物流风险",
                "code": "RM-LR",
                "level": 2,
                "orderIndex": 2,
                "icon": "🚢",
                "color": "#F87171",
                "description": "运输、保险等风险",
                "isActive": True,
            },
            {
                "id": "legal-risk",
                "name": "法律风险",
                "code": "RM-LE",
                "level": 2,
                "orderIndex": 3,
                "icon": "⚖️",
                "color": "#F87171",
                "description": "合同、仲裁等法律问题",
                "isActive": True,
            },
        ],
    },
    {
        "id": "case-studies",
        "name": "实战案例",
        "code": "CS",
        "level": 1,
        "orderIndex": 5,
        "icon": "📚",
        "color": "#8B5CF6",
        "description": "真实案例分析和经验总结",
        "isActive": True,
        "children": [
            {
                "id": "successful-cases",
                "name": "成功案例",
                "code": "CS-SC",
                "level": 2,
                "orderIndex": 1,
                "icon": "✨",
                "color": "#A78BFA",
                "description": "谈判成功的典型案例",
                "isActive": True,
            },
            {
                "id": "dispute-cases",
                "name": "纠纷案例",
                "code": "CS-DC",
                "level": 2,
                "orderIndex": 2,
                "icon": "⚔️",
                "color": "#A78BFA",
                "description": "纠纷处理和解决方案",
                "isActive": True,
            },
        ],
    },
]


# ============================================
# 知识点属性枚举
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
# 迁移脚本
# ============================================

def create_constraints(tx):
    """创建约束和索引"""
    statements = [
        # KnowledgePoint约束和索引
        "CREATE CONSTRAINT knowledge_point_name IF NOT EXISTS FOR (k:KnowledgePoint) REQUIRE k.name IS UNIQUE",
        "CREATE INDEX knowledge_point_category IF NOT EXISTS FOR (k:KnowledgePoint) ON (k.category)",
        "CREATE INDEX knowledge_point_type IF NOT EXISTS FOR (k:KnowledgePoint) ON (k.type)",
        "CREATE INDEX knowledge_point_difficulty IF NOT EXISTS FOR (k:KnowledgePoint) ON (k.difficulty)",
        "CREATE INDEX knowledge_point_importance IF NOT EXISTS FOR (k:KnowledgePoint) ON (k.importance)",

        # KnowledgeCategory约束和索引
        "CREATE CONSTRAINT knowledge_category_id IF NOT EXISTS FOR (c:KnowledgeCategory) REQUIRE c.id IS UNIQUE",
        "CREATE INDEX knowledge_category_level IF NOT EXISTS FOR (c:KnowledgeCategory) ON (c.level)",
        "CREATE INDEX knowledge_category_code IF NOT EXISTS FOR (c:KnowledgeCategory) ON (c.code)",
    ]

    for statement in statements:
        try:
            tx.run(statement)
            LOGGER.info(f"Executed: {statement}")
        except Exception as e:
            LOGGER.warning(f"Constraint/Index creation failed (may already exist): {e}")


def migrate_existing_knowledge_points(tx):
    """为现有知识点添加默认属性"""
    query = """
    MATCH (k:KnowledgePoint)
    WHERE k.category IS NULL
    SET k.category = 'uncategorized',
        k.type = 'concept',
        k.difficulty = 'intermediate',
        k.importance = 'recommended',
        k.estimatedMinutes = 15,
        k.summary = COALESCE(k.summary, ''),
        k.keywords = COALESCE(k.keywords, []),
        k.tags = COALESCE(k.tags, []),
        k.viewCount = COALESCE(k.viewCount, 0),
        k.practiceCount = COALESCE(k.practiceCount, 0),
        k.updatedAt = datetime(),
        k.version = COALESCE(k.version, 1)
    RETURN count(k) AS updated
    """
    result = tx.run(query)
    record = result.single()
    count = record["updated"] if record else 0
    LOGGER.info(f"Updated {count} existing knowledge points with default attributes")
    return count


def create_category_hierarchy(tx, categories: List[Dict]):
    """创建分类层级结构"""
    created_count = 0

    for category in categories:
        # 创建父分类
        parent_query = """
        MERGE (c:KnowledgeCategory {id: $id})
        SET c.name = $name,
            c.code = $code,
            c.level = $level,
            c.orderIndex = $orderIndex,
            c.icon = $icon,
            c.color = $color,
            c.description = $description,
            c.isActive = $isActive,
            c.createdAt = COALESCE(c.createdAt, datetime()),
            c.updatedAt = datetime()
        RETURN c
        """
        tx.run(parent_query, {
            "id": category["id"],
            "name": category["name"],
            "code": category["code"],
            "level": category["level"],
            "orderIndex": category["orderIndex"],
            "icon": category["icon"],
            "color": category["color"],
            "description": category["description"],
            "isActive": category["isActive"],
        })
        created_count += 1
        LOGGER.info(f"Created category: {category['name']}")

        # 创建子分类
        for child in category.get("children", []):
            child_query = """
            MERGE (child:KnowledgeCategory {id: $childId})
            SET child.name = $childName,
                child.code = $childCode,
                child.level = $childLevel,
                child.orderIndex = $childOrderIndex,
                child.icon = $childIcon,
                child.color = $childColor,
                child.description = $childDescription,
                child.isActive = $childIsActive,
                child.createdAt = COALESCE(child.createdAt, datetime()),
                child.updatedAt = datetime()
            WITH child
            MATCH (parent:KnowledgeCategory {id: $parentId})
            MERGE (parent)-[r:PARENT_OF]->(child)
            SET r.orderIndex = $childOrderIndex
            RETURN child
            """
            tx.run(child_query, {
                "childId": child["id"],
                "childName": child["name"],
                "childCode": child["code"],
                "childLevel": child["level"],
                "childOrderIndex": child["orderIndex"],
                "childIcon": child["icon"],
                "childColor": child["color"],
                "childDescription": child["description"],
                "childIsActive": child["isActive"],
                "parentId": category["id"],
            })
            created_count += 1
            LOGGER.info(f"  - Created sub-category: {child['name']}")

    return created_count


def classify_existing_knowledge_points(tx):
    """自动分类现有知识点（基于名称关键词匹配）"""
    # 定义关键词到分类的映射
    keyword_mappings = [
        # 贸易术语
        (["FOB", "CIF", "CFR", "EXW", "DDP", "贸易术语", "离岸价", "到岸价"], "incoterms"),
        # 支付方式
        (["信用证", "电汇", "T/T", "L/C", "托收", "D/P", "D/A", "赊销", "O/A", "支付"], "payment-terms"),
        # 贸易文档
        (["发票", "装箱单", "提单", "B/L", "产地证", "C/O", "商检", "单证"], "trade-documents"),
        # 询盘阶段
        (["询盘", "需求澄清", "产品规格", "邮件礼仪"], "inquiry"),
        # 报盘阶段
        (["报盘", "报价", "价格梯度", "价值陈述"], "offer"),
        # 还盘阶段
        (["还盘", "议价", "底线管理", "让步"], "counter-offer"),
        # 接受阶段
        (["接受函", "订单确认", "形式发票", "PI"], "acceptance"),
        # 价格策略
        (["锚定", "报价策略", "成本", "价格计算", "折扣"], "pricing-strategy"),
        # 沟通技巧
        (["邮件", "沟通", "礼仪", "异议处理"], "communication"),
        # 跨文化
        (["跨文化", "文化差异", "语气"], "cross-culture"),
        # 支付风险
        (["信用调查", "风险评估", "收汇"], "payment-risk"),
        # 物流风险
        (["物流", "运输", "保险", "装运"], "logistics-risk"),
        # 法律风险
        (["合同", "仲裁", "法律", "条款"], "legal-risk"),
    ]

    classified_count = 0

    for keywords, category_id in keyword_mappings:
        # 构建关键词匹配条件
        keyword_patterns = [f"k.name CONTAINS '{kw}'" for kw in keywords]
        where_clause = " OR ".join(keyword_patterns)

        query = f"""
        MATCH (k:KnowledgePoint)
        WHERE k.category = 'uncategorized' AND ({where_clause})
        MATCH (c:KnowledgeCategory {{id: $categoryId}})
        SET k.category = c.id
        WITH k, c
        MERGE (k)-[r:BELONGS_TO]->(c)
        SET r.assignedAt = datetime(),
            r.assignedBy = 'auto-migration',
            r.confidence = 0.8
        RETURN count(k) AS count
        """

        result = tx.run(query, {"categoryId": category_id})
        record = result.single()
        count = record["count"] if record else 0
        if count > 0:
            classified_count += count
            LOGGER.info(f"Classified {count} points to category: {category_id}")

    return classified_count


def run_migration(driver):
    """执行完整迁移"""
    LOGGER.info("="*60)
    LOGGER.info("Starting Knowledge Graph Enhancement Migration")
    LOGGER.info("="*60)

    try:
        with driver.session() as session:
            # Step 1: 创建约束和索引
            LOGGER.info("\n[Step 1] Creating constraints and indexes...")
            session.execute_write(create_constraints)

            # Step 2: 迁移现有知识点
            LOGGER.info("\n[Step 2] Migrating existing knowledge points...")
            updated_count = session.execute_write(migrate_existing_knowledge_points)

            # Step 3: 创建分类体系
            LOGGER.info("\n[Step 3] Creating category hierarchy...")
            category_count = session.execute_write(create_category_hierarchy, DEFAULT_CATEGORIES)

            # Step 4: 自动分类
            LOGGER.info("\n[Step 4] Auto-classifying knowledge points...")
            classified_count = session.execute_write(classify_existing_knowledge_points)

            LOGGER.info("\n"+"="*60)
            LOGGER.info("Migration completed successfully!")
            LOGGER.info(f"  - Updated knowledge points: {updated_count}")
            LOGGER.info(f"  - Created categories: {category_count}")
            LOGGER.info(f"  - Auto-classified points: {classified_count}")
            LOGGER.info("="*60)

            return True

    except Exception as e:
        LOGGER.error(f"Migration failed: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    # 用于直接运行迁移脚本
    import os
    from neo4j import GraphDatabase

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    uri = os.getenv("NEO4J_URI", "neo4j://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "CHANGE_ME")

    LOGGER.info(f"Connecting to Neo4j at {uri}...")
    driver = GraphDatabase.driver(uri, auth=(user, password))

    try:
        driver.verify_connectivity()
        LOGGER.info("Connected successfully!")
        success = run_migration(driver)
        exit(0 if success else 1)
    except Exception as e:
        LOGGER.error(f"Failed to connect: {e}")
        exit(1)
    finally:
        driver.close()
