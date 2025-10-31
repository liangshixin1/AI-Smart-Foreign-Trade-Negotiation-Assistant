# 外贸谈判教学知识图谱设计方案

## 📋 目录

1. [当前系统分析](#当前系统分析)
2. [知识图谱理论基础](#知识图谱理论基础)
3. [外贸领域知识本体设计](#外贸领域知识本体设计)
4. [教师端知识管理方案](#教师端知识管理方案)
5. [学生端知识发现机制](#学生端知识发现机制)
6. [实施路线图](#实施路线图)

---

## 一、当前系统分析

### 1.1 现有架构

**节点类型（6种）**：
```
Chapter (章节)
Practice (实战练习)
TheoryTopic (理论主题)
TheoryLesson (理论课时)
KnowledgePoint (知识点) ★核心★
ProcessStep (谈判流程步骤)
```

**关系类型（7种）**：
```cypher
(Chapter)-[:COVERS_PROCESS]->(ProcessStep)
(Chapter)-[:HAS_PRACTICE]->(Practice)
(Chapter)-[:HAS_TOPIC]->(TheoryTopic)
(TheoryTopic)-[:HAS_LESSON]->(TheoryLesson)
(Practice)-[:TESTS]->(KnowledgePoint)
(TheoryLesson)-[:EXPLAINS]->(KnowledgePoint)
(ProcessStep)-[:NEXT_STEP]->(ProcessStep)
```

### 1.2 核心问题诊断

#### 问题1：知识点粒度过粗

**现状**：
```python
KnowledgePoint {
  name: "FOB 成本构成"  # 仅有名称
}
```

**问题**：
- ❌ 没有类型分类（概念？技能？文档？）
- ❌ 没有层次结构（FOB是贸易术语的一种）
- ❌ 没有难度标记
- ❌ 没有前置依赖

#### 问题2：关系语义单一

**现状**：
只有两种关系：
- `TESTS` - 练习考察知识点
- `EXPLAINS` - 课时解释知识点

**缺失的关系**：
- ❌ 知识点之间的关联（如"FOB"和"价格谈判"）
- ❌ 前置依赖（学习"信用证"需先了解"国际支付"）
- ❌ 对比关系（"FOB" vs "CIF"）
- ❌ 应用场景（"报盘技巧"应用于"询盘阶段"）

#### 问题3：缺乏领域本体

**现状**：
知识点是扁平列表，如：
```python
"FOB 成本构成"
"首轮报价锚点策略"
"询盘结构要素"
```

**问题**：
- ❌ 没有体现外贸领域的概念层次
- ❌ 没有体现知识的类型（术语/流程/技巧/文档）
- ❌ 难以系统化管理

#### 问题4：静态预设，缺乏灵活性

**现状**：
```python
SECTION_KNOWLEDGE_PRESETS = {
    "chapter-0-section-1": ("首轮报价锚点策略", "FOB 成本构成", ...),
    # 硬编码在代码中
}
```

**问题**：
- ❌ 教师无法动态管理知识点
- ❌ 修改需要改代码、重新部署
- ❌ 无法根据教学需求调整

---

## 二、知识图谱理论基础

### 2.1 知识图谱的三层架构

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

### 2.2 知识表示的DIKW模型

```
      ┌─────────────┐
      │  智慧 Wisdom │  (为什么这样做？)
      └──────┬──────┘
             │
      ┌──────▼──────┐
      │  知识 Knowledge │ (如何做？)
      └──────┬──────┘
             │
      ┌──────▼──────┐
      │  信息 Information │ (是什么？)
      └──────┬──────┘
             │
      ┌──────▼──────┐
      │  数据 Data   │ (原始事实)
      └─────────────┘
```

**应用到外贸教学**：
- **Data**: "FOB价格是$100"
- **Information**: "FOB是离岸价，不包含运费和保险"
- **Knowledge**: "在价格谈判中，使用FOB可以降低报价，更具竞争力"
- **Wisdom**: "根据客户的地理位置和采购量，选择合适的贸易术语策略"

### 2.3 知识图谱的关键概念

#### 实体（Entity）
外贸领域的"对象"：
- 贸易术语（FOB, CIF, CFR）
- 文档（商业发票、装箱单、信用证）
- 谈判技巧（锚定效应、条件让步）
- 流程阶段（询盘、报盘、还盘）

#### 关系（Relation）
实体之间的连接：
- `IS_A` (分类): FOB IS_A 贸易术语
- `PART_OF` (组成): 商检 PART_OF 交易流程
- `REQUIRES` (前置): 信用证 REQUIRES 国际支付知识
- `APPLIES_TO` (应用): 锚定策略 APPLIES_TO 报盘阶段

#### 属性（Property）
实体的特征：
- 难度等级：初级/中级/高级
- 知识类型：概念/技能/文档/流程
- 重要程度：必修/选修
- 学习时长：10分钟/30分钟

---

## 三、外贸领域知识本体设计

### 3.1 核心概念分类体系

```
外贸谈判知识体系
├── 1. 贸易基础 (Trade Fundamentals)
│   ├── 1.1 贸易术语 (Incoterms)
│   │   ├── FOB (Free On Board)
│   │   ├── CIF (Cost, Insurance, Freight)
│   │   ├── CFR (Cost and Freight)
│   │   ├── EXW (Ex Works)
│   │   └── DDP (Delivered Duty Paid)
│   ├── 1.2 支付方式 (Payment Terms)
│   │   ├── 信用证 (L/C)
│   │   ├── 电汇 (T/T)
│   │   ├── 托收 (D/P, D/A)
│   │   └── 赊销 (O/A)
│   └── 1.3 贸易文档 (Documents)
│       ├── 商业发票 (Commercial Invoice)
│       ├── 装箱单 (Packing List)
│       ├── 提单 (B/L)
│       └── 产地证 (C/O)
│
├── 2. 谈判流程 (Negotiation Process)
│   ├── 2.1 询盘阶段 (Inquiry)
│   │   ├── 询盘邮件结构
│   │   ├── 需求澄清技巧
│   │   └── 产品规格确认
│   ├── 2.2 报盘阶段 (Offer)
│   │   ├── 报价单制作
│   │   ├── 价格梯度设计
│   │   └── 价值陈述
│   ├── 2.3 还盘阶段 (Counter-Offer)
│   │   ├── 还盘策略
│   │   ├── 底线管理
│   │   └── 让步技巧
│   └── 2.4 成交阶段 (Acceptance)
│       ├── 合同审阅
│       ├── 条款确认
│       └── 付款安排
│
├── 3. 谈判技巧 (Negotiation Skills)
│   ├── 3.1 价格谈判 (Price Negotiation)
│   │   ├── 锚定效应 (Anchoring)
│   │   ├── 条件让步 (Conditional Concession)
│   │   ├── 价格拆分 (Price Breakdown)
│   │   └── BATNA策略
│   ├── 3.2 沟通技巧 (Communication)
│   │   ├── 邮件礼仪
│   │   ├── 跨文化沟通
│   │   ├── 异议处理
│   │   └── 关系建立
│   └── 3.3 风险管理 (Risk Management)
│       ├── 信用调查
│       ├── 支付条款选择
│       └── 保险与仲裁
│
├── 4. 实战案例 (Case Studies)
│   ├── 4.1 按产品分类
│   │   ├── 机械设备出口
│   │   ├── 纺织品出口
│   │   └── 电子产品出口
│   ├── 4.2 按市场分类
│   │   ├── 欧美市场
│   │   ├── 东南亚市场
│   │   └── 非洲市场
│   └── 4.3 按问题分类
│       ├── 价格争议
│       ├── 质量投诉
│       └── 交期延误
│
└── 5. 法律法规 (Legal & Compliance)
    ├── 5.1 国际公约 (Conventions)
    │   ├── CISG (国际货物销售合同公约)
    │   ├── UCP600 (信用证统一惯例)
    │   └── Incoterms 2020
    ├── 5.2 海关与物流
    │   ├── 报关流程
    │   ├── 商检要求
    │   └── 退税政策
    └── 5.3 知识产权
        ├── 商标保护
        ├── 专利权
        └── 侵权应对
```

### 3.2 增强的Neo4j节点模型

#### 节点1：KnowledgePoint（知识点）- 增强版

```cypher
CREATE (k:KnowledgePoint {
  id: "kp-fob-001",                    # 唯一标识
  name: "FOB (Free On Board)",          # 名称
  nameZh: "离岸价",                     # 中文名
  nameEn: "FOB",                        # 英文缩写

  // 分类属性
  category: "贸易术语",                 # 所属大类
  subcategory: "价格术语",              # 所属小类
  type: "concept",                      # 类型：concept/skill/document/process

  // 难度与重要性
  difficulty: "beginner",               # 难度：beginner/intermediate/advanced
  importance: "high",                   # 重要性：high/medium/low
  mandatory: true,                      # 是否必修

  // 内容属性
  definition: "FOB是指卖方在...",       # 定义
  summary: "离岸价，适用于海运...",     # 摘要
  detailHtml: "<h2>详细说明</h2>...",  # 详细内容（HTML）
  keyPoints: ["不含运费", "风险转移点在船上"], # 关键要点

  // 学习属性
  estimatedMinutes: 15,                 # 预计学习时长（分钟）
  prerequisites: ["kp-price-001"],      # 前置知识ID列表

  // 元数据
  tags: ["国际贸易", "价格谈判", "海运"], # 标签
  keywords: ["FOB", "离岸价", "装运港"], # 关键词
  relatedTerms: ["CIF", "CFR"],        # 相关术语

  // 多媒体
  imageUrl: "/images/fob-diagram.png",  # 图片
  videoUrl: "https://...",              # 视频教程
  exampleUrl: "/examples/fob-case.pdf", # 案例文档

  // 审计字段
  createdBy: "teacher-001",
  createdAt: datetime(),
  updatedAt: datetime(),
  version: 1
})
```

#### 节点2：KnowledgeCategory（知识分类）- 新增

```cypher
CREATE (c:KnowledgeCategory {
  id: "cat-incoterms",
  name: "贸易术语",
  nameEn: "Incoterms",
  description: "国际商会制定的贸易术语规则",
  parentId: "cat-trade-fundamentals",  # 父分类ID
  level: 2,                            # 层级
  orderIndex: 1,                       # 排序
  icon: "📦"                           # 图标
})
```

#### 节点3：LearningPath（学习路径）- 新增

```cypher
CREATE (lp:LearningPath {
  id: "path-beginner",
  name: "外贸新手入门",
  description: "适合零基础学员的学习路径",
  difficulty: "beginner",
  estimatedHours: 20,
  targetAudience: "外贸专业大一学生",
  goals: ["掌握基础贸易术语", "了解询盘报盘流程"],
  createdBy: "teacher-001"
})
```

### 3.3 增强的关系类型

#### 3.3.1 知识点内部关系

```cypher
# 1. 分类关系
(k:KnowledgePoint)-[:BELONGS_TO]->(c:KnowledgeCategory)

# 2. 层次关系
(k1:KnowledgePoint)-[:IS_SUBTYPE_OF]->(k2:KnowledgePoint)
例：(FOB)-[:IS_SUBTYPE_OF]->(贸易术语)

# 3. 前置依赖
(k1:KnowledgePoint)-[:REQUIRES {
  strength: "strong",  # strong/medium/weak
  reason: "必须先了解价格构成"
}]->(k2:KnowledgePoint)
例：(FOB价格计算)-[:REQUIRES]->(FOB基本概念)

# 4. 对比关系
(k1:KnowledgePoint)-[:COMPARES_WITH {
  aspect: "成本差异",
  difference: "FOB不含运费和保险"
}]->(k2:KnowledgePoint)
例：(FOB)-[:COMPARES_WITH]->(CIF)

# 5. 应用关系
(k:KnowledgePoint)-[:APPLIES_TO]->(ps:ProcessStep)
例：(锚定策略)-[:APPLIES_TO]->(报盘阶段)

# 6. 关联关系（泛化）
(k1:KnowledgePoint)-[:RELATED_TO {
  type: "often_used_together",
  weight: 0.8
}]->(k2:KnowledgePoint)
例：(信用证)-[:RELATED_TO]->(国际支付)
```

#### 3.3.2 教学内容关系（原有+增强）

```cypher
# 原有关系（保留）
(TheoryLesson)-[:EXPLAINS {
  anchorId: "section-2",
  emphasis: "high",  # 强调程度
  coverage: "comprehensive"  # 覆盖深度：brief/moderate/comprehensive
}]->(KnowledgePoint)

(Practice)-[:TESTS {
  level: "application",  # 考察层次：remember/understand/apply/analyze
  weight: 0.3  # 权重（该知识点占练习分值的比例）
}]->(KnowledgePoint)

# 新增关系
(Practice)-[:REQUIRES_KNOWLEDGE]->(KnowledgePoint)
例：(FOB价格谈判练习)-[:REQUIRES_KNOWLEDGE]->(FOB基本概念)

(TheoryLesson)-[:DEMONSTRATES {
  exampleType: "case_study"
}]->(KnowledgePoint)
例：(询盘案例分析课)-[:DEMONSTRATES]->(询盘邮件结构)
```

#### 3.3.3 学习路径关系

```cypher
(lp:LearningPath)-[:INCLUDES {
  step: 1,
  mandatory: true
}]->(k:KnowledgePoint)

(lp:LearningPath)-[:RECOMMENDS_PRACTICE]->(p:Practice)

(lp:LearningPath)-[:RECOMMENDS_LESSON]->(l:TheoryLesson)
```

### 3.4 知识图谱示例

```cypher
// 示例1：FOB知识点的完整图谱

// 创建知识分类
CREATE (cat1:KnowledgeCategory {
  id: "cat-incoterms",
  name: "贸易术语"
})

CREATE (cat2:KnowledgeCategory {
  id: "cat-price-negotiation",
  name: "价格谈判"
})

// 创建知识点
CREATE (fob:KnowledgePoint {
  id: "kp-fob",
  name: "FOB离岸价",
  type: "concept",
  difficulty: "beginner",
  definition: "卖方在装运港将货物装上买方指定的船只后，风险和费用即转移给买方"
})

CREATE (cif:KnowledgePoint {
  id: "kp-cif",
  name: "CIF到岸价",
  type: "concept",
  difficulty: "beginner"
})

CREATE (fobCalc:KnowledgePoint {
  id: "kp-fob-calculation",
  name: "FOB价格计算",
  type: "skill",
  difficulty: "intermediate"
})

CREATE (anchor:KnowledgePoint {
  id: "kp-anchoring",
  name: "锚定策略",
  type: "skill",
  difficulty: "intermediate"
})

// 创建关系
CREATE (fob)-[:BELONGS_TO]->(cat1)
CREATE (fobCalc)-[:BELONGS_TO]->(cat2)
CREATE (fobCalc)-[:REQUIRES {strength: "strong"}]->(fob)
CREATE (fob)-[:COMPARES_WITH {aspect: "成本差异"}]->(cif)
CREATE (anchor)-[:APPLIES_TO_CONCEPT]->(fob)

// 连接到教学内容
MATCH (lesson:TheoryLesson {id: "lesson-trade-terms"})
MATCH (practice:Practice {id: "chapter-0-section-1"})
CREATE (lesson)-[:EXPLAINS {emphasis: "high"}]->(fob)
CREATE (practice)-[:TESTS {level: "apply"}]->(fob)
CREATE (practice)-[:REQUIRES_KNOWLEDGE]->(fob)
```

---

## 四、教师端知识管理方案

### 4.1 设计原则

1. **低门槛**：教师不需要懂图数据库
2. **高效率**：批量操作、智能推荐
3. **可视化**：直观的知识网络展示
4. **渐进式**：先简单后复杂，逐步完善

### 4.2 教师工作流程

#### 阶段1：基础知识录入（当前已实现）

```
教师操作：
1. 上传Word文档或手动创建理论课时
2. 在富文本编辑器中插入"知识卡片"
3. 填写知识点名称、摘要、详细内容

系统自动：
- 创建KnowledgePoint节点
- 建立EXPLAINS关系
- 保存到SQLite和Neo4j
```

**优点**：
✅ 操作简单，类似Word编辑
✅ 知识卡片直观展示在课时中

**局限**：
❌ 知识点之间没有关联
❌ 缺乏分类和层次
❌ 难以复用和管理

#### 阶段2：知识点分类管理（建议新增）

**UI设计**：
```
┌─────────────────────────────────────────────────┐
│  知识图谱管理                              [刷新] │
├─────────────────┬───────────────────────────────┤
│ 📁 知识分类      │  知识点列表                    │
│                 │                               │
│ ▼ 贸易基础       │  □ FOB离岸价   [编辑] [删除]  │
│   ├─ 贸易术语    │  □ CIF到岸价   [编辑] [删除]  │
│   │  ├─ FOB     │  □ CFR成本加运费 [编辑] [删除] │
│   │  ├─ CIF     │                               │
│   │  └─ CFR     │  [+ 添加知识点]               │
│   ├─ 支付方式    │                               │
│   └─ 贸易文档    │  批量操作：                    │
│                 │  [导入Excel] [导出] [批量标签] │
│ ▼ 谈判流程       │                               │
│   ├─ 询盘阶段    │  快速搜索：                    │
│   └─ 报盘阶段    │  [搜索框]  [高级筛选]         │
└─────────────────┴───────────────────────────────┘
```

**操作流程**：
```
1. 教师创建知识分类树
   - 点击"添加分类" → 输入名称 → 选择父分类

2. 为知识点指定分类
   - 拖拽知识点到分类 或
   - 编辑知识点 → 选择分类

3. 批量操作
   - 从Excel导入知识点列表
   - 批量添加标签
   - 批量修改难度/重要性
```

#### 阶段3：知识关联管理（建议新增）

**UI设计**：
```
┌─────────────────────────────────────────────────┐
│  知识点详情：FOB离岸价                     [保存] │
├─────────────────────────────────────────────────┤
│                                                 │
│  基本信息                                        │
│  ├─ 名称：FOB (Free On Board)                   │
│  ├─ 分类：贸易基础 > 贸易术语                    │
│  ├─ 类型：● 概念 ○ 技能 ○ 文档 ○ 流程           │
│  ├─ 难度：● 初级 ○ 中级 ○ 高级                  │
│  └─ 标签：[国际贸易] [价格谈判] [海运]          │
│                                                 │
│  内容编辑                                        │
│  ├─ 定义：[富文本编辑器]                         │
│  ├─ 关键要点：                                   │
│  │   • 不含运费和保险                            │
│  │   • 风险在装运港船上转移                       │
│  ├─ 图片：[上传]                                 │
│  └─ 视频：[上传或粘贴链接]                       │
│                                                 │
│  知识关联 ★重点★                                │
│  ┌───────────────────────────────────────────┐ │
│  │ 前置知识（学习本知识点需要先掌握）：         │ │
│  │   • 国际贸易基础概念        [强依赖] [删除]  │ │
│  │   • 价格构成                [中依赖] [删除]  │ │
│  │   [+ 添加前置知识]                          │ │
│  │                                             │ │
│  │ 后续知识（掌握本知识点后可以学习）：         │ │
│  │   • FOB价格计算             [推荐] [删除]   │ │
│  │   • FOB价格谈判技巧         [推荐] [删除]   │ │
│  │   [+ 添加后续知识]                          │ │
│  │                                             │ │
│  │ 对比知识（常与本知识点对比）：               │ │
│  │   • CIF 到岸价              [对比点：成本差异]│ │
│  │   • CFR 成本加运费          [对比点：保险费]│  │
│  │   [+ 添加对比知识]                          │ │
│  │                                             │ │
│  │ 应用场景（本知识点常用于）：                 │ │
│  │   • 报盘阶段                [适用] [删除]   │ │
│  │   • 价格谈判                [适用] [删除]   │ │
│  │   [+ 添加应用场景]                          │ │
│  │                                             │ │
│  │ 智能推荐：                                   │ │
│  │   系统分析发现，经常与"国际支付方式"同时出现 │ │
│  │   [添加关联]  [忽略]                        │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  关联内容                                        │
│  ├─ 出现在课时：                                 │
│  │   • 第1章 > 贸易术语详解    [跳转]           │
│  │   • 第2章 > 价格谈判基础    [跳转]           │
│  ├─ 考察于练习：                                 │
│  │   • 报盘实战练习            [跳转]           │
│  └─ 学习路径：                                   │
│      • 外贸新手入门（第3步）   [查看]           │
│                                                 │
│  [保存]  [取消]  [预览知识网络]                  │
└─────────────────────────────────────────────────┘
```

**智能辅助功能**：

1. **自动关联推荐**
```python
# 基于共现分析
def recommend_related_knowledge(knowledge_id):
    """
    分析该知识点在课时和练习中的共现情况，
    推荐可能相关的其他知识点
    """
    query = """
    MATCH (k1:KnowledgePoint {id: $kid})
    MATCH (k1)<-[:EXPLAINS|TESTS]-(content)
    MATCH (content)-[:EXPLAINS|TESTS]->(k2:KnowledgePoint)
    WHERE k1 <> k2 AND NOT (k1)-[:RELATED_TO]-(k2)
    WITH k2, count(content) as cooccurrence
    WHERE cooccurrence >= 2
    RETURN k2.name, cooccurrence
    ORDER BY cooccurrence DESC
    LIMIT 5
    """
    # 返回推荐列表
```

2. **知识依赖检测**
```python
# 检测前置依赖
def detect_prerequisites(knowledge_id):
    """
    分析学习该知识点的学生，
    他们之前通常学过哪些知识点
    """
    # 通过学习记录数据分析
    # 推荐可能的前置知识
```

3. **知识图谱完整性检查**
```python
# 检查孤立节点、缺失关系等
def check_graph_quality():
    """
    检查：
    - 没有分类的知识点
    - 没有前置知识的中高级知识点
    - 没有被任何课时解释的知识点
    - 没有被任何练习考察的知识点
    """
    # 返回待完善的项目列表
```

#### 阶段4：学习路径设计（建议新增）

**UI设计**：
```
┌─────────────────────────────────────────────────┐
│  学习路径设计器                            [保存] │
├─────────────────────────────────────────────────┤
│                                                 │
│  路径信息                                        │
│  ├─ 名称：外贸新手入门                           │
│  ├─ 目标学员：外贸专业大一学生                    │
│  ├─ 难度：初级                                   │
│  ├─ 预计时长：20小时                             │
│  └─ 学习目标：                                   │
│      • 掌握基础贸易术语                          │
│      • 了解询盘报盘流程                          │
│                                                 │
│  学习路径（可拖拽排序）                          │
│  ┌───────────────────────────────────────────┐ │
│  │  步骤1  [必修]                              │ │
│  │  ├─ 知识点：国际贸易基础概念                │ │
│  │  ├─ 推荐课时：国际贸易概论 (30分钟)         │ │
│  │  └─ 推荐练习：基础概念测试                  │ │
│  │                                             │ │
│  │  步骤2  [必修]                              │ │
│  │  ├─ 知识点：FOB离岸价                       │ │
│  │  ├─ 推荐课时：贸易术语详解 (45分钟)         │ │
│  │  └─ 推荐练习：FOB案例分析                   │ │
│  │                                             │ │
│  │  步骤3  [选修]                              │ │
│  │  ├─ 知识点：CIF到岸价                       │ │
│  │  ├─ 推荐课时：贸易术语对比 (30分钟)         │ │
│  │  └─ 推荐练习：CIF vs FOB实战                │ │
│  │                                             │ │
│  │  [+ 添加步骤]                               │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  智能助手                                        │
│  ├─ 💡 建议：步骤2缺少前置依赖检查              │
│  ├─ ⚠️ 警告：步骤5的练习难度超过当前路径难度    │
│  └─ ✅ 完整性：所有步骤都有对应的学习资源       │
│                                                 │
│  [自动生成路径] [预览学生视图] [发布]           │
└─────────────────────────────────────────────────┘
```

**自动生成学习路径**：
```python
def generate_learning_path(target_knowledge, difficulty):
    """
    基于目标知识点，自动生成学习路径

    算法：
    1. 找到目标知识点
    2. 递归查找所有前置知识（深度优先）
    3. 按依赖关系拓扑排序
    4. 为每个知识点匹配课时和练习
    5. 根据难度过滤和调整
    """
    query = """
    MATCH path = (target:KnowledgePoint {id: $target_id})
                  <-[:REQUIRES*]-(prerequisite)
    WHERE prerequisite.difficulty <= $max_difficulty
    WITH nodes(path) as knowledge_sequence
    UNWIND knowledge_sequence as k
    MATCH (k)<-[:EXPLAINS]-(lesson:TheoryLesson)
    OPTIONAL MATCH (k)<-[:TESTS]-(practice:Practice)
    RETURN k, collect(lesson), collect(practice)
    """
    # 构建学习路径
```

---

## 五、学生端知识发现机制

### 5.1 设计目标

1. **降低认知负荷**：不让学生看到复杂的图谱
2. **主动推荐**：根据学习进度智能推荐
3. **直观导航**：像导航地图一样找到知识点
4. **个性化路径**：根据学生水平调整

### 5.2 学生视角的知识发现

#### 场景1：知识点详情页

当学生点击某个知识点时：

```
┌─────────────────────────────────────────────────┐
│  📦 FOB 离岸价                                   │
├─────────────────────────────────────────────────┤
│                                                 │
│  🎯 学习目标                                     │
│  掌握FOB贸易术语的定义、适用场景和价格计算方法   │
│                                                 │
│  📚 知识内容                                     │
│  FOB（Free On Board）是国际贸易中常用的价格术语... │
│  [展开全文]                                      │
│                                                 │
│  💡 关键要点                                     │
│  • 卖方负责到装运港船上                          │
│  • 不含运费和保险                                │
│  • 适用于海运和内河运输                          │
│                                                 │
│  ⏱️ 学习时长：15分钟  |  难度：⭐⭐☆☆☆          │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  📖 推荐课时（点击直接跳转）                     │
│  ┌─────────────────────────────────────────┐   │
│  │ ▶ 第1章 - 贸易术语详解        45分钟    │   │
│  │   详细讲解FOB的定义、适用场景和计算方法  │   │
│  │   [开始学习]                             │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  🎮 相关练习（测试掌握程度）                     │
│  ┌─────────────────────────────────────────┐   │
│  │ ▶ 报盘实战：FOB价格谈判      预计20分钟  │   │
│  │   模拟买方角色，练习FOB价格谈判          │   │
│  │   [开始练习] ✓ 已完成                    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  🔗 相关知识（扩展学习）                         │
│  • CIF 到岸价 - 对比学习成本差异                 │
│  • FOB价格计算 - 深入学习价格构成                │
│  • 价格谈判技巧 - 了解如何应用FOB报价            │
│                                                 │
│  🛤️ 学习路径                                    │
│  你正在学习：外贸新手入门 (第2/10步)             │
│  ┌──[✓]───[●]───[ ]───[ ]───[ ]──┐           │
│  │  基础  FOB  CIF  询盘  报盘    │           │
│  └───────────────────────────────┘           │
│  [继续下一步]                                    │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  📊 你的学习状态                                 │
│  • 已学习：5分钟                                 │
│  • 完成度：60%                                   │
│  • 相关练习得分：85分 (良好)                     │
│  [标记为已掌握]                                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### 场景2：智能学习推荐

在学生完成一个练习后：

```
┌─────────────────────────────────────────────────┐
│  🎉 恭喜！你完成了"报盘实战练习"                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  📊 练习得分：85分 (良好)                        │
│                                                 │
│  ✅ 掌握较好的知识点：                           │
│  • FOB离岸价                                     │
│  • 报价单结构                                    │
│                                                 │
│  ⚠️ 需要加强的知识点：                           │
│  • 价格梯度设计 (得分：60分)                     │
│    建议复习：第2章 - 价格策略与技巧              │
│    [复习课时]                                    │
│                                                 │
│  ─────────────────────────────────────────────  │
│                                                 │
│  💡 为你推荐                                     │
│                                                 │
│  1. 下一步学习（基于学习路径）                   │
│     ▶ CIF到岸价                                 │
│       学习FOB后，了解CIF可以更全面掌握价格术语   │
│       预计15分钟  [开始学习]                     │
│                                                 │
│  2. 深化练习（巩固当前知识）                     │
│     ▶ FOB价格计算实战                           │
│       通过实际案例，深入理解FOB成本构成          │
│       预计20分钟  [开始练习]                     │
│                                                 │
│  3. 对比学习（横向扩展）                         │
│     ▶ FOB vs CIF 对比分析                       │
│       通过对比，更深刻理解两种术语的区别         │
│       预计10分钟  [查看对比]                     │
│                                                 │
│  [返回主页]  [查看学习报告]                      │
└─────────────────────────────────────────────────┘
```

#### 场景3：知识地图导航

提供可视化的知识地图：

```
┌─────────────────────────────────────────────────┐
│  🗺️ 知识地图 - 外贸新手入门                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  [全局视图] [我的进度] [推荐路径]               │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │                                           │ │
│  │          [国际贸易基础]                    │ │
│  │               ✓                           │ │
│  │               │                           │ │
│  │       ┌───────┴───────┐                   │ │
│  │       │               │                   │ │
│  │  [FOB离岸价]    [价格构成]                │ │
│  │       ●               ✓                   │ │
│  │       │                                   │ │
│  │   ┌───┴───┐                               │ │
│  │   │       │                               │ │
│  │[CIF]  [FOB计算]                           │ │
│  │   ○       ○                               │ │
│  │                                           │ │
│  │  图例：                                    │ │
│  │  ✓ 已掌握  ● 学习中  ○ 未学习             │ │
│  │  ─ 前置依赖  ┄ 推荐学习                   │ │
│  │                                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  📍 当前位置：FOB离岸价                          │
│  📊 总体进度：3/10 (30%)                        │
│  ⏱️ 预计剩余时间：14小时                        │
│                                                 │
│  [显示详细路径]  [切换视图]                      │
└─────────────────────────────────────────────────┘
```

### 5.3 推荐算法设计

#### 算法1：基于学习路径的推荐

```python
def recommend_next_step(student_id, learning_path_id):
    """
    基于学习路径推荐下一步
    """
    # 1. 获取学生当前进度
    completed_knowledge = get_student_completed_knowledge(student_id)

    # 2. 获取学习路径的所有步骤
    path_steps = get_learning_path_steps(learning_path_id)

    # 3. 找到第一个未完成且前置知识已满足的步骤
    for step in path_steps:
        if step.knowledge_id not in completed_knowledge:
            prerequisites = get_prerequisites(step.knowledge_id)
            if all(pre in completed_knowledge for pre in prerequisites):
                return step

    return None  # 路径已完成
```

#### 算法2：基于薄弱点的推荐

```python
def recommend_weak_knowledge(student_id):
    """
    分析练习记录，推荐需要加强的知识点
    """
    query = """
    MATCH (s:Student {id: $student_id})-[r:PRACTICED]->(p:Practice)
    MATCH (p)-[:TESTS]->(k:KnowledgePoint)
    WHERE r.score < 70
    WITH k, avg(r.score) as avgScore, count(r) as attempts
    MATCH (k)<-[:EXPLAINS]-(lesson:TheoryLesson)
    RETURN k, avgScore, attempts, collect(lesson)
    ORDER BY avgScore ASC, attempts DESC
    LIMIT 3
    """
    # 返回得分最低且练习次数较多的知识点
    # 说明学生多次尝试但仍未掌握
```

#### 算法3：基于知识图谱的推荐

```python
def recommend_related_knowledge(current_knowledge_id):
    """
    基于知识图谱的关系推荐相关知识
    """
    query = """
    MATCH (current:KnowledgePoint {id: $kid})

    // 推荐1：后续知识（当前知识的应用）
    OPTIONAL MATCH (current)<-[:REQUIRES]-(next:KnowledgePoint)

    // 推荐2：对比知识（横向扩展）
    OPTIONAL MATCH (current)-[:COMPARES_WITH]-(compare:KnowledgePoint)

    // 推荐3：相关知识（共现知识）
    OPTIONAL MATCH (current)<-[:EXPLAINS|TESTS]-(content)
    MATCH (content)-[:EXPLAINS|TESTS]->(related:KnowledgePoint)
    WHERE current <> related

    WITH next, compare, related
    RETURN {
      next: collect(DISTINCT next)[..3],
      compare: collect(DISTINCT compare)[..2],
      related: collect(DISTINCT related)[..3]
    }
    """
    # 返回多维度的推荐
```

---

## 六、实施路线图

### Phase 1：基础增强（2-3周）

**目标**：完善现有知识点功能

**任务**：
1. ✅ 增强KnowledgePoint节点属性
   - 添加category, type, difficulty, importance等字段
   - 数据库迁移脚本

2. ✅ 创建KnowledgeCategory节点
   - 设计分类树结构
   - 提供默认分类（贸易术语、谈判技巧等）

3. ✅ 教师端UI改进
   - 知识点编辑表单增加新字段
   - 添加分类选择器

4. ✅ 数据导入工具
   - Excel批量导入知识点
   - Word文档自动提取知识点

**产出**：
- 更完善的知识点数据模型
- 教师可以为知识点分类和添加属性

### Phase 2：知识关联（3-4周）

**目标**：建立知识点之间的关系

**任务**：
1. ✅ 新增关系类型
   - REQUIRES (前置依赖)
   - COMPARES_WITH (对比关系)
   - RELATED_TO (相关知识)
   - APPLIES_TO (应用场景)

2. ✅ 教师端关联管理UI
   - 知识点详情页添加"知识关联"板块
   - 拖拽或搜索添加关联
   - 可视化展示关联网络

3. ✅ 智能推荐功能
   - 基于共现的关联推荐
   - 基于学习路径的依赖推荐

4. ✅ 知识图谱完整性检查
   - 检测孤立节点
   - 检测缺失的前置依赖
   - 生成待完善列表

**产出**：
- 丰富的知识关联网络
- 教师可以轻松管理知识关系

### Phase 3：学习路径（3-4周）

**目标**：设计和发布学习路径

**任务**：
1. ✅ 创建LearningPath节点和关系
   - 定义学习路径数据模型
   - 支持多个并行路径

2. ✅ 学习路径设计器
   - 拖拽式路径构建
   - 自动生成路径功能
   - 路径完整性验证

3. ✅ 学习路径发布
   - 学生可以选择学习路径
   - 显示路径进度

4. ✅ 路径推荐算法
   - 根据学生水平推荐路径
   - 根据学习目标推荐路径

**产出**：
- 多条可选的学习路径
- 学生可以按路径学习

### Phase 4：学生端体验（2-3周）

**目标**：优化学生学习体验

**任务**：
1. ✅ 知识点详情页优化
   - 显示推荐课时和练习
   - 显示相关知识
   - 显示学习进度

2. ✅ 智能推荐引擎
   - 完成练习后推荐下一步
   - 根据薄弱点推荐复习
   - 根据学习路径推荐

3. ✅ 知识地图导航
   - 可视化学习路径
   - 显示学习进度
   - 点击跳转到知识点

4. ✅ 个性化学习报告
   - 知识点掌握度分析
   - 学习路径进度
   - 薄弱点诊断

**产出**：
- 直观的学习导航
- 智能的学习推荐
- 个性化的学习体验

### Phase 5：高级功能（可选，2-3周）

**任务**：
1. 知识图谱查询（Graph Query）
   - 学生可以搜索知识点
   - 显示知识点的关系网络

2. 协作学习
   - 学生可以讨论知识点
   - 教师可以看到学生的疑问点

3. 知识点版本管理
   - 跟踪知识点的修改历史
   - 支持回滚

4. 知识图谱分析
   - 知识覆盖度分析
   - 学习路径热度分析
   - 知识点难度校准

---

## 七、技术实现建议

### 7.1 数据库 Schema 设计

**Neo4j Cypher 示例**：

```cypher
// ==================== 节点定义 ====================

// 知识点（增强版）
CREATE (k:KnowledgePoint {
  id: "kp-fob-001",
  name: "FOB离岸价",
  nameEn: "FOB",
  category: "贸易术语",
  type: "concept",
  difficulty: "beginner",
  importance: "high",
  definition: "...",
  summary: "...",
  detailHtml: "...",
  keyPoints: ["...", "..."],
  tags: ["...", "..."],
  estimatedMinutes: 15,
  createdAt: datetime(),
  updatedAt: datetime()
})

// 知识分类
CREATE (c:KnowledgeCategory {
  id: "cat-incoterms",
  name: "贸易术语",
  nameEn: "Incoterms",
  parentId: "cat-trade-fundamentals",
  level: 2,
  orderIndex: 1
})

// 学习路径
CREATE (lp:LearningPath {
  id: "path-beginner",
  name: "外贸新手入门",
  difficulty: "beginner",
  estimatedHours: 20,
  targetAudience: "外贸专业大一学生"
})

// ==================== 关系定义 ====================

// 知识点分类
CREATE (k:KnowledgePoint)-[:BELONGS_TO]->(c:KnowledgeCategory)

// 前置依赖
CREATE (k1:KnowledgePoint)-[:REQUIRES {
  strength: "strong",  // strong/medium/weak
  reason: "..."
}]->(k2:KnowledgePoint)

// 对比关系
CREATE (k1:KnowledgePoint)-[:COMPARES_WITH {
  aspect: "成本差异",
  difference: "..."
}]->(k2:KnowledgePoint)

// 相关知识
CREATE (k1:KnowledgePoint)-[:RELATED_TO {
  type: "often_used_together",
  weight: 0.8
}]->(k2:KnowledgePoint)

// 应用场景
CREATE (k:KnowledgePoint)-[:APPLIES_TO]->(ps:ProcessStep)

// 学习路径包含
CREATE (lp:LearningPath)-[:INCLUDES {
  step: 1,
  mandatory: true
}]->(k:KnowledgePoint)

// 教学关系（保留原有）
CREATE (lesson:TheoryLesson)-[:EXPLAINS {
  anchorId: "...",
  emphasis: "high"
}]->(k:KnowledgePoint)

CREATE (practice:Practice)-[:TESTS {
  level: "apply",
  weight: 0.3
}]->(k:KnowledgePoint)
```

### 7.2 API 设计

**新增API端点**：

```python
# ========== 知识分类管理 ==========
GET    /api/admin/knowledge/categories
POST   /api/admin/knowledge/categories
PUT    /api/admin/knowledge/categories/{id}
DELETE /api/admin/knowledge/categories/{id}

# ========== 知识点管理（增强） ==========
GET    /api/admin/knowledge/points
GET    /api/admin/knowledge/points/{id}
POST   /api/admin/knowledge/points
PUT    /api/admin/knowledge/points/{id}
DELETE /api/admin/knowledge/points/{id}
POST   /api/admin/knowledge/points/batch-import  # Excel导入

# ========== 知识关联管理 ==========
GET    /api/admin/knowledge/points/{id}/relations
POST   /api/admin/knowledge/points/{id}/relations
DELETE /api/admin/knowledge/points/{id}/relations/{relation_id}
GET    /api/admin/knowledge/points/{id}/recommend-relations  # 智能推荐

# ========== 学习路径管理 ==========
GET    /api/admin/learning-paths
GET    /api/admin/learning-paths/{id}
POST   /api/admin/learning-paths
PUT    /api/admin/learning-paths/{id}
DELETE /api/admin/learning-paths/{id}
POST   /api/admin/learning-paths/auto-generate  # 自动生成路径

# ========== 学生端知识发现 ==========
GET    /api/knowledge/points/{id}                   # 知识点详情
GET    /api/knowledge/points/{id}/related           # 相关知识
GET    /api/knowledge/points/{id}/recommended       # 推荐学习
GET    /api/learning-paths                          # 可用的学习路径
GET    /api/learning-paths/{id}/progress            # 我的学习进度
GET    /api/students/me/recommendations             # 个性化推荐
GET    /api/students/me/knowledge-map               # 知识地图
```

### 7.3 前端组件设计

**新增React/Vue组件**：

```javascript
// 教师端组件
components/
├── KnowledgeManager/
│   ├── KnowledgeCategoryTree.vue      // 分类树
│   ├── KnowledgePointList.vue         // 知识点列表
│   ├── KnowledgePointEditor.vue       // 知识点编辑器
│   ├── KnowledgeRelationManager.vue   // 关系管理
│   └── KnowledgeGraphViewer.vue       // 图谱可视化
├── LearningPathDesigner/
│   ├── PathEditor.vue                 // 路径编辑器
│   ├── PathStepList.vue               // 步骤列表
│   └── PathValidator.vue              // 完整性检查
└── Analytics/
    ├── KnowledgeCoverage.vue          // 知识覆盖度
    └── StudentProgress.vue            // 学生进度

// 学生端组件
components/
├── KnowledgePoint/
│   ├── KnowledgeDetail.vue            // 知识点详情
│   ├── RelatedKnowledge.vue           // 相关知识
│   └── LearningResources.vue          // 推荐资源
├── LearningPath/
│   ├── PathList.vue                   // 路径列表
│   ├── PathProgress.vue               // 进度显示
│   └── KnowledgeMap.vue               // 知识地图
└── Recommendations/
    ├── NextStepCard.vue               // 下一步推荐
    ├── ReviewCard.vue                 // 复习推荐
    └── RecommendationList.vue         // 推荐列表
```

---

## 八、总结与建议

### 8.1 核心价值

**对教师**：
1. ✅ **降低管理复杂度**：通过分类、标签、搜索快速管理大量知识点
2. ✅ **智能辅助**：系统自动推荐关联、检测缺失、生成路径
3. ✅ **可视化洞察**：直观看到知识网络、学生掌握情况

**对学生**：
1. ✅ **清晰的学习导航**：知道当前位置、下一步去哪里
2. ✅ **个性化推荐**：根据水平和进度推荐学习内容
3. ✅ **高效的学习路径**：避免盲目学习，按最优路径前进

### 8.2 关键成功因素

1. **渐进式实施**：先完善基础，再添加高级功能
2. **用户参与**：邀请教师试用并反馈，迭代优化UI
3. **数据质量**：初期投入精力建立高质量的知识本体
4. **平衡复杂度**：功能强大但操作简单

### 8.3 风险与应对

**风险1**：教师不愿意花时间管理知识关联
- **应对**：提供智能推荐、批量操作、Excel导入等低门槛工具

**风险2**：知识图谱过于复杂，学生看不懂
- **应对**：简化学生端展示，只显示必要信息，隐藏复杂关系

**风险3**：知识点粒度难以统一
- **应对**：提供最佳实践指南，推荐合适的粒度（如：一个术语、一个技巧、一个流程步骤）

### 8.4 度量指标

**教师端**：
- 知识点数量和覆盖度
- 知识关联密度（平均每个知识点的关联数）
- 学习路径数量和使用率

**学生端**：
- 学习路径完成率
- 知识点平均得分
- 推荐点击率
- 学习时长和效率

---

## 附录：参考资源

1. **知识图谱理论**：
   - 《知识图谱：方法、实践与应用》
   - Neo4j Graph Data Science文档

2. **外贸领域本体**：
   - Incoterms 2020官方规则
   - UCP 600 (信用证统一惯例)
   - CISG (国际货物销售合同公约)

3. **教育技术**：
   - 布鲁姆认知层次理论
   - 个性化学习路径设计
   - 自适应学习系统

4. **技术实现**：
   - Neo4j官方文档
   - vis-network可视化库
   - Cypher查询语言参考

---

**文档版本**：v1.0
**创建日期**：2025-10-31
**作者**：AI Assistant
**状态**：设计方案 - 待审批
