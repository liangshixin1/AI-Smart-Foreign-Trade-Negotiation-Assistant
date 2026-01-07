# 外贸教学知识图谱Schema设计文档

**版本**: Beta 3
**更新日期**: 2025年1月

## 设计目标

1. **低门槛**：教师无需懂图数据库也能使用
2. **高效率**：支持批量操作和智能推荐
3. **可视化**：直观展示知识网络结构
4. **渐进式**：先简单后复杂，逐步完善
5. **语义化**：支持心理语言学语义网络（Beta 3）

## 知识本体架构

### 三层架构

```
┌────────────────────────────────────────┐
│  应用层 (Application Layer)             │
│  - 知识问答                              │
│  - 学习路径推荐                          │
│  - 智能搜索                              │
│  - 词汇网建议 (Beta 3)                   │
└────────────────────────────────────────┘
          ↑
┌────────────────────────────────────────┐
│  模式层 (Schema Layer / 本体层)         │
│  - 概念定义                              │
│  - 关系定义                              │
│  - 约束规则                              │
│  - 语义类别 (Beta 3)                     │
└────────────────────────────────────────┘
          ↑
┌────────────────────────────────────────┐
│  数据层 (Data Layer)                    │
│  - 实体实例                              │
│  - 属性值                                │
│  - 关系实例                              │
│  - 槽位替换 (Beta 3)                     │
└────────────────────────────────────────┘
```

### DAG风格架构（Beta 3）

Beta 3引入有向无环图（DAG）架构，确保知识依赖关系的清晰性：

```
┌─────────────────────────────────────────────────────┐
│                    知识图谱 DAG                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│    [基础概念层]                                      │
│         ↓                                           │
│    [核心知识层]  ←→  [语义类别]                       │
│         ↓              ↓                            │
│    [应用知识层]  ←→  [槽位替换]                       │
│         ↓                                           │
│    [实战技能层]                                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### DIKW模型映射

```
智慧 (Wisdom)      → 策略建议、最佳实践
   ↑
知识 (Knowledge)   → 应用场景、操作技巧
   ↑
信息 (Information) → 结构化概念、定义
   ↑
数据 (Data)        → 原始事实、术语
```

## 节点类型定义

### 1. KnowledgePoint (知识点) - 核心节点

**完整属性**：
```cypher
{
  // 基础信息
  name: String (UNIQUE),           # 知识点名称（唯一标识）
  code: String,                    # 编码，如 "TT-BT-001"

  // 分类信息
  category: String,                # 大类：贸易术语/谈判技巧/文档/流程/法规
  type: String,                    # 类型：concept/skill/document/case/tool

  // 教学属性
  difficulty: String,              # 难度：beginner/intermediate/advanced
  importance: String,              # 重要性：required/recommended/optional
  estimatedMinutes: Integer,       # 预估学习时间（分钟）

  // 内容信息
  summary: String,                 # 简短描述（1-2句话）
  description: Text,               # 详细描述
  keywords: [String],              # 关键词列表
  tags: [String],                  # 标签列表

  // Beta 3 新增属性
  tone: String,                    # 语气标签：formal/informal/neutral
  civicsElements: [String],        # 思政元素：win-win/integrity/dignity
  idiomaticLevel: String,          # 地道性级别：native/natural/basic

  // 多媒体资源
  imageUrl: String,                # 图片URL
  videoUrl: String,                # 视频URL
  documentUrl: String,             # 文档URL

  // 关联信息
  sourceId: String,                # 来源ID（关联到理论课时等）
  externalUrl: String,             # 外部资源链接

  // 统计信息
  viewCount: Integer,              # 查看次数
  practiceCount: Integer,          # 练习次数
  averageScore: Float,             # 平均得分

  // 元数据
  createdAt: DateTime,             # 创建时间
  updatedAt: DateTime,             # 更新时间
  createdBy: String,               # 创建者
  version: Integer                 # 版本号
}
```

**约束**：
```cypher
CREATE CONSTRAINT knowledge_point_name IF NOT EXISTS
FOR (k:KnowledgePoint) REQUIRE k.name IS UNIQUE;

CREATE INDEX knowledge_point_category IF NOT EXISTS
FOR (k:KnowledgePoint) ON (k.category);

CREATE INDEX knowledge_point_type IF NOT EXISTS
FOR (k:KnowledgePoint) ON (k.type);

CREATE INDEX knowledge_point_difficulty IF NOT EXISTS
FOR (k:KnowledgePoint) ON (k.difficulty);

// Beta 3 新增索引
CREATE INDEX knowledge_point_tone IF NOT EXISTS
FOR (k:KnowledgePoint) ON (k.tone);
```

### 2. KnowledgeCategory (知识分类)

```cypher
{
  id: String (UNIQUE),             # 分类ID，如 "trade-terms"
  name: String,                    # 分类名称，如 "贸易术语"
  code: String,                    # 分类编码
  level: Integer,                  # 层级（1=一级，2=二级，3=三级）
  orderIndex: Integer,             # 排序索引
  icon: String,                    # 图标
  color: String,                   # 颜色
  description: String,             # 描述
  isActive: Boolean,               # 是否启用
  createdAt: DateTime,
  updatedAt: DateTime
}
```

### 3. SemanticClass (语义类别) - Beta 3 新增

用于表示心理语言学中的语义类别，支持同族/同类词汇的关联。

```cypher
{
  id: String (UNIQUE),             # 语义类别ID
  name: String,                    # 类别名称，如 "价格术语"、"时间表达"
  nameEn: String,                  # 英文名称
  description: String,             # 描述
  category: String,                # 所属领域：trade/negotiation/document

  // 语义网络属性
  semanticDomain: String,          # 语义域：price/time/quantity/quality
  abstractionLevel: String,        # 抽象层级：abstract/concrete

  // 示例
  examples: [String],              # 示例词汇列表
  examplesEn: [String],            # 英文示例

  // 元数据
  createdAt: DateTime,
  updatedAt: DateTime
}
```

**约束**：
```cypher
CREATE CONSTRAINT semantic_class_id IF NOT EXISTS
FOR (s:SemanticClass) REQUIRE s.id IS UNIQUE;

CREATE INDEX semantic_class_domain IF NOT EXISTS
FOR (s:SemanticClass) ON (s.semanticDomain);
```

### 4. Slot (槽位节点) - Beta 3 新增

用于支持上下文相关的词汇替换建议。

```cypher
{
  id: String (UNIQUE),             # 槽位ID
  type: String,                    # 类型：tone/civics/idiomatic
  name: String,                    # 槽位名称

  // 上下文信息
  context: String,                 # 适用上下文描述
  contextKeywords: [String],       # 上下文关键词

  // 替换建议
  suggestions: [String],           # 替换建议列表
  suggestionsEn: [String],         # 英文替换建议

  // 语气维度（当type=tone时）
  toneVariant: String,             # softer/neutral/stronger

  // 思政维度（当type=civics时）
  civicsOrientation: String,       # win-win/integrity/dignity/compliance

  // 地道性维度（当type=idiomatic时）
  idiomaticStyle: String,          # native/natural/formal

  // 优先级
  priority: Integer,               # 建议优先级

  // 元数据
  createdAt: DateTime,
  updatedAt: DateTime
}
```

**约束**：
```cypher
CREATE CONSTRAINT slot_id IF NOT EXISTS
FOR (s:Slot) REQUIRE s.id IS UNIQUE;

CREATE INDEX slot_type IF NOT EXISTS
FOR (s:Slot) ON (s.type);

CREATE INDEX slot_context IF NOT EXISTS
FOR (s:Slot) ON (s.context);
```

### 5. 其他节点类型

#### Stage (谈判阶段)
```cypher
{
  id: String (UNIQUE),
  name: String,                    # 如 "询盘"、"报盘"
  orderIndex: Integer,
  description: String
}
```

#### Topic (理论主题)
```cypher
{
  id: String (UNIQUE),
  name: String,
  chapterId: String,
  orderIndex: Integer
}
```

#### Practice (实战练习)
```cypher
{
  id: String (UNIQUE),
  name: String,
  type: String,                    # negotiation/review (Beta 3新增review)
  difficulty: String,
  chapterId: String
}
```

#### TheoryLesson (理论课时)
```cypher
{
  id: String (UNIQUE),
  title: String,
  content: Text,
  topicId: String,
  orderIndex: Integer
}
```

#### ProcessStep (流程步骤)
```cypher
{
  id: String (UNIQUE),
  name: String,
  description: String,
  orderIndex: Integer
}
```

#### Terminology (术语)
```cypher
{
  id: String (UNIQUE),
  term: String,                    # 如 "FOB", "CIF"
  fullName: String,                # 全称
  definition: String,
  category: String
}
```

## 关系类型定义

### 现有关系

| 关系 | 方向 | 说明 | 属性 |
|------|------|------|------|
| `REQUIRES` | (A)-[:REQUIRES]->(B) | A前置依赖B | isStrict, reason |
| `RELATES_TO` | (A)-[:RELATES_TO]->(B) | A与B关联 | relationType, strength |
| `BELONGS_TO` | (K)-[:BELONGS_TO]->(C) | 知识点属于分类 | assignedAt, confidence |
| `PARENT_OF` | (C1)-[:PARENT_OF]->(C2) | 分类层级 | orderIndex |
| `COVERS_PROCESS` | (Ch)-[:COVERS_PROCESS]->(P) | 章节覆盖流程 | - |
| `HAS_PRACTICE` | (Ch)-[:HAS_PRACTICE]->(Pr) | 章节包含练习 | - |
| `HAS_TOPIC` | (Ch)-[:HAS_TOPIC]->(T) | 章节包含主题 | - |
| `HAS_LESSON` | (T)-[:HAS_LESSON]->(L) | 主题包含课时 | - |
| `TESTS` | (Pr)-[:TESTS]->(K) | 练习考察知识点 | - |
| `EXPLAINS` | (L)-[:EXPLAINS]->(K) | 课时解释知识点 | - |
| `APPLIES_TO` | (K)-[:APPLIES_TO]->(P) | 知识点应用到流程 | relevance |
| `NEXT_STEP` | (P1)-[:NEXT_STEP]->(P2) | 流程顺序 | - |

### Beta 3 新增关系

#### IN_CLASS (语义类别归属)

```cypher
(KnowledgePoint)-[:IN_CLASS]->(SemanticClass)
{
  membershipType: String,          # primary/secondary
  confidence: Float,               # 归属置信度 0.0-1.0
  assignedAt: DateTime,
  assignedBy: String               # manual/auto
}
```

**示例**：
```cypher
// FOB属于价格术语类别
MATCH (k:KnowledgePoint {name: 'FOB成本构成'})
MATCH (s:SemanticClass {name: '价格术语'})
CREATE (k)-[:IN_CLASS {membershipType: 'primary', confidence: 0.95}]->(s)
```

#### FITS_SLOT (槽位匹配)

```cypher
(KnowledgePoint)-[:FITS_SLOT]->(Slot)
{
  slotType: String,                # tone/civics/idiomatic
  priority: Integer,               # 匹配优先级
  contextMatch: Float,             # 上下文匹配度
  createdAt: DateTime
}
```

**示例**：
```cypher
// 知识点适用于语气柔和槽位
MATCH (k:KnowledgePoint {name: '礼貌询价表达'})
MATCH (s:Slot {type: 'tone', toneVariant: 'softer'})
CREATE (k)-[:FITS_SLOT {slotType: 'tone', priority: 1, contextMatch: 0.9}]->(s)
```

#### RELATED_TO (语义关联) - Beta 3 增强

扩展RELATES_TO关系，支持心理语言学语义网络：

```cypher
(KnowledgePoint)-[:RELATED_TO]->(KnowledgePoint)
{
  relationType: String,            # 关系类型（见下表）
  strength: Float,                 # 关联强度 0.0-1.0
  semanticDistance: Float,         # 语义距离
  description: String,
  createdAt: DateTime
}
```

**relationType枚举值**：

| 类型 | 说明 | 示例 |
|------|------|------|
| `sibling` | 同族关系（词根相同） | price/pricing/pricey |
| `synonym` | 同义关系 | cost/expense |
| `antonym` | 反义关系 | profit/loss |
| `collocation` | 搭配关系 | competitive + price |
| `hypernym` | 上位关系（抽象） | payment → wire transfer |
| `hyponym` | 下位关系（具体） | trade terms → FOB |
| `part_of` | 部分关系 | LC → beneficiary |
| `similar` | 相似关系 | CIF/CFR |
| `contrast` | 对比关系 | FOB/CIF |
| `extension` | 扩展关系 | basic → advanced |

## 默认知识分类体系

### 一级分类

```
1. 贸易基础 (trade-fundamentals)
2. 谈判流程 (negotiation-process)
3. 谈判技巧 (negotiation-skills)
4. 实战案例 (case-studies)
5. 法律法规 (legal-compliance)
6. 语义网络 (semantic-network)    # Beta 3新增
```

### Beta 3 语义域分类

```
价格语义域 (price-domain)
├── 价格术语 (price-terms)
├── 价格策略 (pricing-strategy)
└── 价格谈判 (price-negotiation)

时间语义域 (time-domain)
├── 交货时间 (delivery-time)
├── 付款期限 (payment-term)
└── 有效期 (validity-period)

质量语义域 (quality-domain)
├── 质量标准 (quality-standard)
├── 检验条款 (inspection-terms)
└── 质量保证 (quality-assurance)
```

## 典型查询模式

### 基础查询

```cypher
// 按分类浏览知识点
MATCH (k:KnowledgePoint)-[:BELONGS_TO]->(c:KnowledgeCategory)
WHERE c.id = 'trade-terms'
RETURN k.name, k.difficulty, k.importance
ORDER BY k.importance DESC, k.difficulty

// 查找学习路径（前置依赖）
MATCH path = (start:KnowledgePoint {name: '信用证操作'})<-[:REQUIRES*]-(k:KnowledgePoint)
RETURN path
ORDER BY length(path)
```

### Beta 3 语义网络查询

```cypher
// 按语义类别查找同类词汇
MATCH (k:KnowledgePoint)-[:IN_CLASS]->(c:SemanticClass {name: '价格术语'})
RETURN k.name, k.difficulty, k.tone
ORDER BY k.name

// 查找语气替换建议
MATCH (k:KnowledgePoint)-[:FITS_SLOT]->(s:Slot {type: 'tone'})
WHERE s.toneVariant = 'softer'
RETURN k.name, s.suggestions, s.context

// 查找同族词汇
MATCH (k1:KnowledgePoint {name: 'price'})-[:RELATED_TO {relationType: 'sibling'}]->(k2:KnowledgePoint)
RETURN k2.name, k2.summary

// 查找搭配关系
MATCH (k1:KnowledgePoint)-[r:RELATED_TO {relationType: 'collocation'}]->(k2:KnowledgePoint)
WHERE r.strength > 0.8
RETURN k1.name, k2.name, r.strength
ORDER BY r.strength DESC

// 综合语义查询：获取知识点及其所有语义关联
MATCH (k:KnowledgePoint {name: 'FOB成本构成'})
OPTIONAL MATCH (k)-[:IN_CLASS]->(sc:SemanticClass)
OPTIONAL MATCH (k)-[:FITS_SLOT]->(sl:Slot)
OPTIONAL MATCH (k)-[r:RELATED_TO]-(related:KnowledgePoint)
RETURN k, sc, sl, r, related
```

### 词汇网查询

```cypher
// 获取词汇的多维度建议
MATCH (k:KnowledgePoint {name: '请给我报价'})

// 语气替换
OPTIONAL MATCH (k)-[:FITS_SLOT]->(tone:Slot {type: 'tone'})

// 思政元素
OPTIONAL MATCH (k)-[:FITS_SLOT]->(civics:Slot {type: 'civics'})

// 地道表达
OPTIONAL MATCH (k)-[:FITS_SLOT]->(idiomatic:Slot {type: 'idiomatic'})

RETURN k.name,
       collect(DISTINCT {type: 'tone', variant: tone.toneVariant, suggestion: tone.suggestions}) AS toneSuggestions,
       collect(DISTINCT {type: 'civics', orientation: civics.civicsOrientation, suggestion: civics.suggestions}) AS civicsSuggestions,
       collect(DISTINCT {type: 'idiomatic', style: idiomatic.idiomaticStyle, suggestion: idiomatic.suggestions}) AS idiomaticSuggestions
```

## 数据导入示例

### 方式1：通过Python API

```python
from services.knowledge_service import (
    create_knowledge_point,
    create_semantic_class,
    create_slot,
    link_to_semantic_class,
    link_to_slot
)

# 创建语义类别（Beta 3）
semantic_class = create_semantic_class(
    id="price-terms",
    name="价格术语",
    nameEn="Price Terms",
    semanticDomain="price",
    examples=["FOB", "CIF", "CFR", "EXW"]
)

# 创建槽位（Beta 3）
slot = create_slot(
    id="tone-softer-inquiry",
    type="tone",
    name="柔和询价",
    toneVariant="softer",
    context="询盘阶段",
    suggestions=[
        "Could you kindly provide...",
        "We would appreciate if..."
    ]
)

# 创建知识点
point = create_knowledge_point(
    name="FOB成本构成",
    category="trade-terms",
    type="concept",
    difficulty="beginner",
    importance="required",
    summary="FOB价格的组成部分及计算方法",
    keywords=["FOB", "成本", "价格计算"],
    tone="formal",  # Beta 3新增
    estimated_minutes=15
)

# 关联到语义类别（Beta 3）
link_to_semantic_class(
    point_name="FOB成本构成",
    class_id="price-terms",
    membership_type="primary"
)

# 关联到槽位（Beta 3）
link_to_slot(
    point_name="FOB成本构成",
    slot_id="tone-softer-inquiry",
    priority=1
)
```

### 方式2：通过Excel批量导入

Excel格式（Beta 3增强版）：

| 知识点名称 | 分类 | 类型 | 难度 | 语气 | 思政元素 | 地道性 | 语义类别 |
|-----------|------|------|------|------|----------|--------|----------|
| FOB成本构成 | trade-terms | concept | beginner | formal | win-win | native | price-terms |

### 方式3：通过Web界面

教师端表单新增（Beta 3）：
1. 语义属性：语气、思政元素、地道性
2. 语义类别关联
3. 槽位替换配置

## 迁移策略

### 从Beta 2迁移到Beta 3

```cypher
// 1. 创建新节点类型的约束
CREATE CONSTRAINT semantic_class_id IF NOT EXISTS
FOR (s:SemanticClass) REQUIRE s.id IS UNIQUE;

CREATE CONSTRAINT slot_id IF NOT EXISTS
FOR (s:Slot) REQUIRE s.id IS UNIQUE;

// 2. 为现有知识点添加Beta 3新属性
MATCH (k:KnowledgePoint)
WHERE k.tone IS NULL
SET k.tone = 'neutral',
    k.civicsElements = [],
    k.idiomaticLevel = 'natural',
    k.updatedAt = datetime()

// 3. 创建默认语义类别
CREATE (s:SemanticClass {
  id: 'uncategorized-semantic',
  name: '未分类',
  semanticDomain: 'general',
  createdAt: datetime()
})
```

## 扩展方向

### 未来可能增加的节点类型

1. **LearningPath** (学习路径) - 预设的知识点学习序列
2. **Assessment** (评估) - 知识点掌握度评估记录
3. **Resource** (资源) - 外部学习资源链接
4. **Expert** (专家) - 知识点贡献者/审核者
5. **SemanticRelation** (语义关系) - 更复杂的语义关系表示

### 未来可能增加的关系类型

1. `MASTERED_BY` - 学生掌握关系
2. `AUTHORED_BY` - 作者关系
3. `REVIEWED_BY` - 审核关系
4. `CITED_IN` - 引用关系
5. `SEMANTIC_BRIDGE` - 语义桥接关系

---

## 参考资源

- Neo4j图数据库最佳实践
- 知识图谱建模指南
- 教育领域本体设计案例
- 心理语言学语义网络理论
- WordNet词汇数据库

---

**版本**: Beta 3
**最后更新**: 2025-01-07
**维护者**: 项目组
