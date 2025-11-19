"""
Migration 002: 多节点类型架构升级
Multi-Node Types Architecture Upgrade

目标 (Goals):
1. 引入专用节点类型: Stage(阶段), Skill(技能), Terminology(术语)
2. 建立 PRECEDES 关系,显性表达流程时序
3. 迁移现有 KnowledgePoint 数据到新架构
4. 保持向后兼容,支持渐进式迁移

架构设计 (Architecture):
- Stage: 外贸谈判的核心流程阶段(询盘、报盘、还盘...)
- Skill: 可操作的技能和方法
- Terminology: 术语和概念
- KnowledgePoint: 保留作为通用节点,用于向后兼容

关系类型 (Relationships):
- PRECEDES: Stage之间的先后顺序(流程骨架)
- HAS_TOPIC: Stage包含的知识点
- DEFINES_TERM: 定义术语关系
- REQUIRES: 前置依赖(保留)
- RELATED_TO: 语义关联(保留)
"""

import logging
from typing import List, Dict, Optional
from datetime import datetime

LOGGER = logging.getLogger(__name__)


# ============================================
# 外贸十大核心阶段 (Trade Negotiation Stages)
# ============================================

TRADE_NEGOTIATION_STAGES = [
    {
        "name": "询盘",
        "englishName": "Inquiry",
        "order": 1,
        "description": "买方向卖方询问商品信息和交易条件的阶段",
        "keySkills": ["客户需求分析", "产品信息准备"],
        "estimatedDuration": 7,  # 天数
        "difficulty": "beginner",
        "icon": "🔍",
        "color": "#3B82F6",
    },
    {
        "name": "报盘",
        "englishName": "Offer",
        "order": 2,
        "description": "卖方向买方报价和交易条件的阶段",
        "keySkills": ["价格计算", "报价单制作", "Incoterms应用"],
        "estimatedDuration": 5,
        "difficulty": "intermediate",
        "icon": "📊",
        "color": "#10B981",
    },
    {
        "name": "还盘",
        "englishName": "Counter-Offer",
        "order": 3,
        "description": "买卖双方针对报价和条件进行协商和调整",
        "keySkills": ["谈判技巧", "价格让步策略"],
        "estimatedDuration": 10,
        "difficulty": "advanced",
        "icon": "🔄",
        "color": "#F59E0B",
    },
    {
        "name": "接受",
        "englishName": "Acceptance",
        "order": 4,
        "description": "双方就交易条件达成一致",
        "keySkills": ["合同要点确认"],
        "estimatedDuration": 3,
        "difficulty": "beginner",
        "icon": "✅",
        "color": "#22C55E",
    },
    {
        "name": "签订合同",
        "englishName": "Contract Signing",
        "order": 5,
        "description": "正式签署贸易合同,明确双方权利义务",
        "keySkills": ["合同审核", "法律条款理解"],
        "estimatedDuration": 7,
        "difficulty": "intermediate",
        "icon": "📝",
        "color": "#8B5CF6",
    },
    {
        "name": "备货",
        "englishName": "Goods Preparation",
        "order": 6,
        "description": "卖方准备符合合同要求的货物",
        "keySkills": ["生产管理", "质量控制"],
        "estimatedDuration": 30,
        "difficulty": "intermediate",
        "icon": "📦",
        "color": "#EC4899",
    },
    {
        "name": "报检报关",
        "englishName": "Inspection & Customs",
        "order": 7,
        "description": "商品检验检疫和海关手续办理",
        "keySkills": ["报检流程", "报关文件准备"],
        "estimatedDuration": 5,
        "difficulty": "advanced",
        "icon": "🛃",
        "color": "#EF4444",
    },
    {
        "name": "装运",
        "englishName": "Shipment",
        "order": 8,
        "description": "货物装船和运输安排",
        "keySkills": ["物流协调", "装运单据准备"],
        "estimatedDuration": 3,
        "difficulty": "intermediate",
        "icon": "🚢",
        "color": "#06B6D4",
    },
    {
        "name": "保险",
        "englishName": "Insurance",
        "order": 9,
        "description": "货物运输保险的安排和处理",
        "keySkills": ["保险条款理解", "保险投保"],
        "estimatedDuration": 2,
        "difficulty": "intermediate",
        "icon": "🛡️",
        "color": "#14B8A6",
    },
    {
        "name": "结汇",
        "englishName": "Payment Settlement",
        "order": 10,
        "description": "完成货款的收付和外汇结算",
        "keySkills": ["信用证操作", "单据审核", "外汇结算"],
        "estimatedDuration": 7,
        "difficulty": "advanced",
        "icon": "💰",
        "color": "#F97316",
    },
]


# ============================================
# 核心术语库 (Core Terminology)
# ============================================

CORE_TERMINOLOGY = [
    {
        "name": "FOB",
        "fullName": "Free On Board",
        "chineseName": "离岸价",
        "category": "Incoterms",
        "definition": "货物在指定装运港越过船舷,卖方即完成交货",
        "relatedTerms": ["CIF", "CFR"],
        "difficulty": "beginner",
    },
    {
        "name": "CIF",
        "fullName": "Cost, Insurance and Freight",
        "chineseName": "成本加保险费加运费",
        "category": "Incoterms",
        "definition": "卖方负责货物运到目的港的运费和保险费",
        "relatedTerms": ["FOB", "CFR"],
        "difficulty": "intermediate",
    },
    {
        "name": "CFR",
        "fullName": "Cost and Freight",
        "chineseName": "成本加运费",
        "category": "Incoterms",
        "definition": "卖方负责货物运到目的港的运费,不含保险",
        "relatedTerms": ["FOB", "CIF"],
        "difficulty": "intermediate",
    },
    {
        "name": "L/C",
        "fullName": "Letter of Credit",
        "chineseName": "信用证",
        "category": "Payment",
        "definition": "银行根据进口商申请开立的有条件的付款承诺",
        "relatedTerms": ["T/T", "D/P"],
        "difficulty": "advanced",
    },
    {
        "name": "T/T",
        "fullName": "Telegraphic Transfer",
        "chineseName": "电汇",
        "category": "Payment",
        "definition": "通过电报或电传方式直接将款项汇给收款人",
        "relatedTerms": ["L/C", "D/P"],
        "difficulty": "beginner",
    },
]


# ============================================
# 迁移函数 (Migration Functions)
# ============================================

def upgrade(driver, initiated_by: str = "system") -> Dict[str, int]:
    """
    执行升级迁移

    Returns:
        统计信息字典: {stages_created, terminology_created, relations_created, ...}
    """
    stats = {
        "stages_created": 0,
        "terminology_created": 0,
        "precedes_relations": 0,
        "defines_relations": 0,
        "constraints_created": 0,
        "indexes_created": 0,
    }

    with driver.session() as session:
        # 第一步: 创建约束和索引
        LOGGER.info("Creating constraints for new node types...")
        _create_constraints(session, stats)

        # 第二步: 创建 Stage 节点
        LOGGER.info("Creating Stage nodes...")
        _create_stages(session, initiated_by, stats)

        # 第三步: 创建 Terminology 节点
        LOGGER.info("Creating Terminology nodes...")
        _create_terminology(session, initiated_by, stats)

        # 第四步: 建立 PRECEDES 关系链
        LOGGER.info("Creating PRECEDES relationships...")
        _create_precedes_relationships(session, stats)

        # 第五步: 建立术语关联
        LOGGER.info("Creating terminology relationships...")
        _create_terminology_relationships(session, stats)

        LOGGER.info(f"Migration 002 completed: {stats}")

    return stats


def _create_constraints(session, stats: Dict[str, int]) -> None:
    """创建新节点类型的约束和索引"""

    constraints = [
        # Stage 约束: name 必须唯一
        "CREATE CONSTRAINT stage_name IF NOT EXISTS FOR (s:Stage) REQUIRE s.name IS UNIQUE",

        # Skill 约束: name 必须唯一
        "CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE",

        # Terminology 约束: name 必须唯一
        "CREATE CONSTRAINT terminology_name IF NOT EXISTS FOR (t:Terminology) REQUIRE t.name IS UNIQUE",
    ]

    for constraint_query in constraints:
        try:
            session.run(constraint_query)
            stats["constraints_created"] += 1
            LOGGER.info(f"Created constraint: {constraint_query}")
        except Exception as e:
            # 约束可能已存在
            LOGGER.warning(f"Constraint creation skipped: {e}")

    # 创建索引以提升查询性能
    indexes = [
        "CREATE INDEX stage_order IF NOT EXISTS FOR (s:Stage) ON (s.order)",
        "CREATE INDEX terminology_category IF NOT EXISTS FOR (t:Terminology) ON (t.category)",
    ]

    for index_query in indexes:
        try:
            session.run(index_query)
            stats["indexes_created"] += 1
            LOGGER.info(f"Created index: {index_query}")
        except Exception as e:
            LOGGER.warning(f"Index creation skipped: {e}")


def _create_stages(session, initiated_by: str, stats: Dict[str, int]) -> None:
    """创建外贸流程的 Stage 节点"""

    query = """
    CREATE (s:Stage {
        name: $name,
        englishName: $englishName,
        order: $order,
        description: $description,
        keySkills: $keySkills,
        estimatedDuration: $estimatedDuration,
        difficulty: $difficulty,
        icon: $icon,
        color: $color,
        createdAt: datetime(),
        createdBy: $createdBy,
        updatedAt: datetime()
    })
    RETURN s.name AS name
    """

    for stage in TRADE_NEGOTIATION_STAGES:
        result = session.run(
            query,
            name=stage["name"],
            englishName=stage["englishName"],
            order=stage["order"],
            description=stage["description"],
            keySkills=stage["keySkills"],
            estimatedDuration=stage["estimatedDuration"],
            difficulty=stage["difficulty"],
            icon=stage.get("icon", "🔵"),
            color=stage.get("color", "#3B82F6"),
            createdBy=initiated_by,
        )

        if result.single():
            stats["stages_created"] += 1
            LOGGER.info(f"Created Stage: {stage['name']}")


def _create_terminology(session, initiated_by: str, stats: Dict[str, int]) -> None:
    """创建术语节点"""

    query = """
    CREATE (t:Terminology {
        name: $name,
        fullName: $fullName,
        chineseName: $chineseName,
        category: $category,
        definition: $definition,
        difficulty: $difficulty,
        createdAt: datetime(),
        createdBy: $createdBy,
        updatedAt: datetime()
    })
    RETURN t.name AS name
    """

    for term in CORE_TERMINOLOGY:
        result = session.run(
            query,
            name=term["name"],
            fullName=term["fullName"],
            chineseName=term["chineseName"],
            category=term["category"],
            definition=term["definition"],
            difficulty=term["difficulty"],
            createdBy=initiated_by,
        )

        if result.single():
            stats["terminology_created"] += 1
            LOGGER.info(f"Created Terminology: {term['name']}")


def _create_precedes_relationships(session, stats: Dict[str, int]) -> None:
    """创建 Stage 之间的 PRECEDES 关系链"""

    # 按 order 排序,建立线性流程链
    query = """
    MATCH (s1:Stage {order: $order1})
    MATCH (s2:Stage {order: $order2})
    MERGE (s1)-[r:PRECEDES {
        createdAt: datetime(),
        description: $description
    }]->(s2)
    RETURN s1.name AS from, s2.name AS to
    """

    for i in range(len(TRADE_NEGOTIATION_STAGES) - 1):
        stage1 = TRADE_NEGOTIATION_STAGES[i]
        stage2 = TRADE_NEGOTIATION_STAGES[i + 1]

        description = f"{stage1['name']}完成后进入{stage2['name']}"

        result = session.run(
            query,
            order1=stage1["order"],
            order2=stage2["order"],
            description=description,
        )

        record = result.single()
        if record:
            stats["precedes_relations"] += 1
            LOGGER.info(f"Created PRECEDES: {record['from']} -> {record['to']}")


def _create_terminology_relationships(session, stats: Dict[str, int]) -> None:
    """建立术语之间的关联关系"""

    query = """
    MATCH (t1:Terminology {name: $name1})
    MATCH (t2:Terminology {name: $name2})
    MERGE (t1)-[r:RELATED_TO {
        type: 'similar_concept',
        createdAt: datetime()
    }]-(t2)
    RETURN t1.name AS term1, t2.name AS term2
    """

    for term in CORE_TERMINOLOGY:
        related_terms = term.get("relatedTerms", [])
        for related_name in related_terms:
            result = session.run(
                query,
                name1=term["name"],
                name2=related_name,
            )

            record = result.single()
            if record:
                stats["defines_relations"] += 1
                LOGGER.info(f"Created RELATED_TO: {term['name']} <-> {related_name}")


def downgrade(driver) -> Dict[str, int]:
    """
    回滚迁移 (可选)

    注意: 谨慎使用,会删除所有新增的节点和关系
    """
    stats = {
        "stages_deleted": 0,
        "terminology_deleted": 0,
        "skills_deleted": 0,
        "relationships_deleted": 0,
    }

    with driver.session() as session:
        # 删除 Stage 节点及其关系
        result = session.run("""
            MATCH (s:Stage)
            DETACH DELETE s
            RETURN count(s) AS count
        """)
        stats["stages_deleted"] = result.single()["count"]

        # 删除 Terminology 节点及其关系
        result = session.run("""
            MATCH (t:Terminology)
            DETACH DELETE t
            RETURN count(t) AS count
        """)
        stats["terminology_deleted"] = result.single()["count"]

        # 删除 Skill 节点及其关系
        result = session.run("""
            MATCH (s:Skill)
            DETACH DELETE s
            RETURN count(s) AS count
        """)
        stats["skills_deleted"] = result.single()["count"]

        LOGGER.info(f"Migration 002 downgrade completed: {stats}")

    return stats


def get_migration_status(driver) -> Dict[str, object]:
    """
    检查迁移状态

    Returns:
        {
            "applied": bool,
            "stages_count": int,
            "terminology_count": int,
            "precedes_count": int,
        }
    """
    with driver.session() as session:
        # 检查 Stage 节点数量
        result = session.run("MATCH (s:Stage) RETURN count(s) AS count")
        stages_count = result.single()["count"]

        # 检查 Terminology 节点数量
        result = session.run("MATCH (t:Terminology) RETURN count(t) AS count")
        terminology_count = result.single()["count"]

        # 检查 PRECEDES 关系数量
        result = session.run("MATCH ()-[r:PRECEDES]->() RETURN count(r) AS count")
        precedes_count = result.single()["count"]

        applied = stages_count > 0 or terminology_count > 0

        return {
            "applied": applied,
            "stages_count": stages_count,
            "terminology_count": terminology_count,
            "precedes_count": precedes_count,
            "expected_stages": len(TRADE_NEGOTIATION_STAGES),
            "expected_terminology": len(CORE_TERMINOLOGY),
        }


# ============================================
# 辅助函数: 从现有 KnowledgePoint 迁移数据
# ============================================

def migrate_existing_knowledge_points(driver) -> Dict[str, int]:
    """
    可选: 将现有的 KnowledgePoint 节点迁移到新架构

    规则:
    - type='concept' -> Terminology
    - type='skill' -> Skill
    - 其他保留为 KnowledgePoint
    """
    stats = {
        "migrated_to_terminology": 0,
        "migrated_to_skill": 0,
        "preserved_as_knowledge_point": 0,
    }

    with driver.session() as session:
        # 迁移概念型知识点到 Terminology
        result = session.run("""
            MATCH (k:KnowledgePoint {type: 'concept'})
            WHERE NOT EXISTS((k)-[:MIGRATED_TO]->(:Terminology))
            CREATE (t:Terminology {
                name: k.name,
                chineseName: k.name,
                fullName: k.name,
                category: COALESCE(k.category, '通用'),
                definition: COALESCE(k.description, k.content, ''),
                difficulty: COALESCE(k.difficulty, 'beginner'),
                createdAt: COALESCE(k.createdAt, datetime()),
                createdBy: COALESCE(k.createdBy, 'migration'),
                updatedAt: datetime()
            })
            CREATE (k)-[:MIGRATED_TO]->(t)
            RETURN count(t) AS count
        """)
        stats["migrated_to_terminology"] = result.single()["count"]

        # 迁移技能型知识点到 Skill
        result = session.run("""
            MATCH (k:KnowledgePoint {type: 'skill'})
            WHERE NOT EXISTS((k)-[:MIGRATED_TO]->(:Skill))
            CREATE (s:Skill {
                name: k.name,
                description: COALESCE(k.description, k.content, ''),
                difficulty: COALESCE(k.difficulty, 'beginner'),
                estimatedDuration: COALESCE(k.estimatedDuration, 30),
                createdAt: COALESCE(k.createdAt, datetime()),
                createdBy: COALESCE(k.createdBy, 'migration'),
                updatedAt: datetime()
            })
            CREATE (k)-[:MIGRATED_TO]->(s)
            RETURN count(s) AS count
        """)
        stats["migrated_to_skill"] = result.single()["count"]

        LOGGER.info(f"Knowledge point migration completed: {stats}")

    return stats
