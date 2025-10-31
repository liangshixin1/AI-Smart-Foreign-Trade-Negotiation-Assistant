# 外贸教学知识图谱Schema设计文档

## 设计目标

1. **低门槛**：教师无需懂图数据库也能使用
2. **高效率**：支持批量操作和智能推荐
3. **可视化**：直观展示知识网络结构
4. **渐进式**：先简单后复杂，逐步完善

## 知识本体架构

### 三层架构

```
┌────────────────────────────────────────┐
│  应用层 (Application Layer)             │
│  - 知识问答                              │
│  - 学习路径推荐                          │
│  - 智能搜索                              │
└────────────────────────────────────────┘
          ↑
┌────────────────────────────────────────┐
│  模式层 (Schema Layer / 本体层)         │
│  - 概念定义                              │
│  - 关系定义                              │
│  - 约束规则                              │
└────────────────────────────────────────┘
          ↑
┌────────────────────────────────────────┐
│  数据层 (Data Layer)                    │
│  - 实体实例                              │
│  - 属性值                                │
│  - 关系实例                              │
└────────────────────────────────────────┘
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

**原有属性**：
```
name: String (UNIQUE)  # 知识点名称，如"FOB成本构成"
```

**新增属性**：
```cypher
{
  // 基础信息
  name: String (UNIQUE),           # 知识点名称（唯一标识）
  code: String,                    # 编码，如 "TT-BT-001"

  // 分类信息
  category: String,                # 大类：贸易术语/谈判技巧/文档/流程/法规
  type: String,                    # 类型：概念/技能/文档/案例/工具

  // 教学属性
  difficulty: String,              # 难度：beginner/intermediate/advanced
  importance: String,              # 重要性：required/recommended/optional
  estimatedMinutes: Integer,       # 预估学习时间（分钟）

  // 内容信息
  summary: String,                 # 简短描述（1-2句话）
  description: Text,               # 详细描述
  keywords: [String],              # 关键词列表
  tags: [String],                  # 标签列表

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
```

### 2. KnowledgeCategory (知识分类) - 新增节点

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

**约束**：
```cypher
CREATE CONSTRAINT knowledge_category_id IF NOT EXISTS
FOR (c:KnowledgeCategory) REQUIRE c.id IS UNIQUE;
```

### 3. 现有节点增强

#### Chapter (章节)
保持不变，已有属性足够

#### Practice (实战练习)
保持不变，通过TESTS关系关联知识点

#### TheoryTopic (理论主题)
保持不变

#### TheoryLesson (理论课时)
保持不变，通过EXPLAINS关系关联知识点

#### ProcessStep (流程步骤)
保持不变

## 关系类型定义

### 现有关系（保持）

1. `COVERS_PROCESS`: (Chapter)-[:COVERS_PROCESS]->(ProcessStep)
2. `HAS_PRACTICE`: (Chapter)-[:HAS_PRACTICE]->(Practice)
3. `HAS_TOPIC`: (Chapter)-[:HAS_TOPIC]->(TheoryTopic)
4. `HAS_LESSON`: (TheoryTopic)-[:HAS_LESSON]->(TheoryLesson)
5. `TESTS`: (Practice)-[:TESTS]->(KnowledgePoint)
6. `EXPLAINS`: (TheoryLesson)-[:EXPLAINS]->(KnowledgePoint)
7. `NEXT_STEP`: (ProcessStep)-[:NEXT_STEP]->(ProcessStep)

### 新增关系

#### 1. 知识点分类关系

```cypher
(KnowledgePoint)-[:BELONGS_TO]->(KnowledgeCategory)
{
  // 关系属性
  assignedAt: DateTime,           # 分配时间
  assignedBy: String,             # 分配者
  confidence: Float               # 置信度（自动分类时使用）
}
```

#### 2. 分类层级关系

```cypher
(KnowledgeCategory)-[:PARENT_OF]->(KnowledgeCategory)
{
  orderIndex: Integer             # 子分类排序
}
```

#### 3. 知识点关联关系

```cypher
(KnowledgePoint)-[:RELATES_TO]->(KnowledgePoint)
{
  relationType: String,           # 关系类型：
                                  # - prerequisite (前置依赖)
                                  # - similar (相似)
                                  # - contrast (对比)
                                  # - extension (扩展)
  strength: Float,                # 关联强度 0.0-1.0
  description: String,            # 关系描述
  createdAt: DateTime
}
```

#### 4. 前置依赖关系

```cypher
(KnowledgePoint)-[:REQUIRES]->(KnowledgePoint)
{
  isStrict: Boolean,              # 是否必须先学
  reason: String,                 # 依赖原因
  createdAt: DateTime
}
```

#### 5. 应用场景关系

```cypher
(KnowledgePoint)-[:APPLIES_TO]->(ProcessStep)
{
  relevance: Float,               # 相关度
  description: String,            # 应用说明
  examples: [String]              # 示例
}
```

## 默认知识分类体系

### 一级分类

```
1. 贸易基础 (trade-fundamentals)
2. 谈判流程 (negotiation-process)
3. 谈判技巧 (negotiation-skills)
4. 实战案例 (case-studies)
5. 法律法规 (legal-compliance)
```

### 二级分类（示例：贸易基础）

```
1.1 贸易术语 (incoterms)
    - FOB, CIF, CFR, EXW, DDP等
1.2 支付方式 (payment-terms)
    - 信用证, 电汇, 托收, 赊销
1.3 贸易文档 (trade-documents)
    - 商业发票, 装箱单, 提单, 产地证
```

### 三级分类（示例：贸易术语 > FOB）

```
1.1.1 FOB基础 (fob-basics)
1.1.2 FOB成本构成 (fob-costing)
1.1.3 FOB风险划分 (fob-risks)
1.1.4 FOB实务操作 (fob-operations)
```

## 知识点类型定义

### type 字段枚举值

```python
KNOWLEDGE_TYPES = {
    "concept": "概念型",        # 定义、术语解释
    "skill": "技能型",          # 操作方法、技巧
    "document": "文档型",       # 表格、模板、格式
    "case": "案例型",           # 实际案例、情景
    "tool": "工具型",           # 计算器、检查清单
    "theory": "理论型",         # 理论框架、模型
    "regulation": "法规型",     # 法律、规则、标准
}
```

### category 字段枚举值

```python
KNOWLEDGE_CATEGORIES = {
    "trade-terms": "贸易术语",
    "payment": "支付方式",
    "documents": "贸易文档",
    "negotiation": "谈判技巧",
    "pricing": "价格策略",
    "logistics": "物流运输",
    "legal": "法律法规",
    "risk": "风险管理",
    "communication": "沟通技巧",
    "culture": "跨文化交际",
}
```

### difficulty 字段枚举值

```python
DIFFICULTY_LEVELS = {
    "beginner": "初级",       # 入门必学
    "intermediate": "中级",   # 进阶内容
    "advanced": "高级",       # 深度专题
}
```

### importance 字段枚举值

```python
IMPORTANCE_LEVELS = {
    "required": "必修",       # 核心知识点
    "recommended": "推荐",    # 建议学习
    "optional": "选修",       # 扩展阅读
}
```

## 典型查询模式

### 1. 按分类浏览知识点

```cypher
MATCH (k:KnowledgePoint)-[:BELONGS_TO]->(c:KnowledgeCategory)
WHERE c.id = 'trade-terms'
RETURN k.name, k.difficulty, k.importance
ORDER BY k.importance DESC, k.difficulty
```

### 2. 查找学习路径（前置依赖）

```cypher
MATCH path = (start:KnowledgePoint {name: '信用证操作'})<-[:REQUIRES*]-(k:KnowledgePoint)
RETURN path
ORDER BY length(path)
```

### 3. 知识点推荐（基于相关性）

```cypher
MATCH (k1:KnowledgePoint {name: 'FOB价格计算'})-[r:RELATES_TO]-(k2:KnowledgePoint)
WHERE r.strength > 0.7
RETURN k2.name, r.relationType, r.strength
ORDER BY r.strength DESC
LIMIT 5
```

### 4. 查找某个流程步骤的相关知识点

```cypher
MATCH (s:ProcessStep {id: 'process-offer'})<-[:APPLIES_TO]-(k:KnowledgePoint)
RETURN k.name, k.category, k.type
ORDER BY k.importance DESC
```

### 5. 知识图谱可视化

```cypher
// 获取某个知识点及其周边网络
MATCH (center:KnowledgePoint {name: 'FOB成本构成'})
OPTIONAL MATCH (center)-[r]-(connected:KnowledgePoint)
RETURN center, r, connected
LIMIT 50
```

### 6. 统计分析

```cypher
// 各分类知识点数量统计
MATCH (k:KnowledgePoint)-[:BELONGS_TO]->(c:KnowledgeCategory)
RETURN c.name, count(k) AS pointCount
ORDER BY pointCount DESC

// 难度分布统计
MATCH (k:KnowledgePoint)
RETURN k.difficulty, k.importance, count(*) AS count
ORDER BY k.difficulty, k.importance
```

## 数据导入示例

### 方式1：通过Python API

```python
from services.knowledge_service import (
    create_knowledge_point,
    create_knowledge_category,
    link_knowledge_to_category
)

# 创建分类
category = create_knowledge_category(
    id="trade-terms",
    name="贸易术语",
    level=1,
    order_index=1
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
    estimated_minutes=15
)
```

### 方式2：通过Excel批量导入

Excel格式：

| 知识点名称 | 分类 | 类型 | 难度 | 重要性 | 简介 | 关键词 | 预估学时 |
|-----------|------|------|------|--------|------|--------|----------|
| FOB成本构成 | trade-terms | concept | beginner | required | FOB价格的组成部分 | FOB,成本 | 15 |
| 锚定效应 | negotiation | skill | intermediate | recommended | 谈判中的心理策略 | 锚定,心理 | 20 |

### 方式3：通过Web界面

教师端提供表单：
1. 基本信息：名称、分类、类型
2. 教学属性：难度、重要性、学时
3. 内容编辑：简介、详细描述、关键词
4. 资源上传：图片、视频、文档
5. 关系管理：前置依赖、相关知识点

## 迁移策略

### 阶段1：兼容现有数据

保持现有KnowledgePoint节点的name属性不变，逐步添加新属性。

```cypher
// 为现有知识点添加默认属性
MATCH (k:KnowledgePoint)
WHERE k.category IS NULL
SET k.category = 'uncategorized',
    k.type = 'concept',
    k.difficulty = 'intermediate',
    k.importance = 'recommended',
    k.updatedAt = datetime()
```

### 阶段2：数据丰富

教师通过界面逐步完善知识点信息。

### 阶段3：关系构建

建立知识点之间的关联关系，形成知识网络。

## 扩展方向

### 未来可能增加的节点类型

1. **LearningPath** (学习路径)
   - 预设的知识点学习序列

2. **Assessment** (评估)
   - 知识点掌握度评估记录

3. **Resource** (资源)
   - 外部学习资源链接

4. **Expert** (专家)
   - 知识点贡献者/审核者

### 未来可能增加的关系类型

1. `MASTERED_BY` - 学生掌握关系
2. `AUTHORED_BY` - 作者关系
3. `REVIEWED_BY` - 审核关系
4. `CITED_IN` - 引用关系

## 参考资源

- Neo4j图数据库最佳实践
- 知识图谱建模指南
- 教育领域本体设计案例
