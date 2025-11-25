# 知识图谱导入功能 - 架构文档

## 📋 概述

本文档描述知识图谱导入功能的**重构版**实现，采用简洁清晰的三表统一导入方案。

### 设计目标

- ✅ **简单易懂**：单一的导入流程，没有复杂的分支逻辑
- ✅ **清晰的数据流**：Excel → 解析 → 验证 → 导入Neo4j
- ✅ **完整的错误处理**：详细的错误和警告信息
- ✅ **结构化的图谱**：生成有层级的网络图，不是"一团乱麻"

---

## 🏗️ 数据模型

### 节点类型

#### 1. Stage (阶段节点)
外贸谈判流程的各个阶段。

```cypher
(:Stage {
  name: String,           // 阶段名称（必填，唯一）
  englishName: String,    // 英文名称
  description: String,    // 阶段描述
  difficulty: String,     // 难度：beginner/intermediate/advanced
  estimatedDuration: Int, // 预计时长（天）
  icon: String,          // 图标 emoji
  color: String,         // 颜色代码
  createdAt: DateTime,
  createdBy: String,
  updatedAt: DateTime,
  updatedBy: String
})
```

#### 2. KnowledgePoint (知识点节点)
具体的知识点内容。

```cypher
(:KnowledgePoint {
  name: String,        // 知识点名称（必填，唯一）
  type: String,        // 类型：概念型/技能型/文档型/案例型
  difficulty: String,  // 难度：beginner/intermediate/advanced
  importance: String,  // 重要性：必修/推荐/选修
  summary: String,     // 内容简介
  description: String, // 详细描述
  chapter: String,     // 章节
  createdAt: DateTime,
  updatedAt: DateTime
})
```

#### 3. Practice (案例节点)
实践案例和场景。

```cypher
(:Practice {
  id: String,          // 案例ID（自动生成）
  title: String,       // 案例标题
  scenario: String,    // 案例场景
  content: String,     // 案例内容
  createdAt: DateTime,
  createdBy: String
})
```

### 关系类型

#### 1. PRECEDES (先后关系)
连接Stage节点，形成流程的"脊梁骨"。

```cypher
(Stage)-[:PRECEDES]->(Stage)
```

**示例**：
```
(询盘)-[:PRECEDES]->(报盘)-[:PRECEDES]->(还盘)-[:PRECEDES]->(成交)
```

#### 2. HAS_TOPIC (包含关系)
Stage包含KnowledgePoint。

```cypher
(Stage)-[:HAS_TOPIC]->(KnowledgePoint)
```

**示例**：
```
(询盘)-[:HAS_TOPIC]->(询盘基本流程)
(询盘)-[:HAS_TOPIC]->(询盘函电写作)
```

#### 3. HAS_PRACTICE (关联关系)
KnowledgePoint关联Practice。

```cypher
(KnowledgePoint)-[:HAS_PRACTICE]->(Practice)
```

---

## 📊 Excel文件格式

### Sheet 1: 谈判流程（必填）

定义外贸谈判的各个阶段和顺序。

| 列名 | 必填 | 说明 | 示例 |
|------|------|------|------|
| 阶段名称* | ✅ | 阶段的中文名称 | 询盘 |
| 英文名称 | ❌ | 阶段的英文名称 | Inquiry |
| 阶段描述 | ❌ | 简要说明该阶段 | 买方向卖方询问商品信息 |
| 难度级别 | ❌ | 初级/中级/高级 | 初级 |
| 预计时长(天) | ❌ | 该阶段所需天数 | 7 |
| 图标 | ❌ | Emoji图标 | 🔍 |
| 颜色 | ❌ | 十六进制颜色 | #3B82F6 |

**重要说明**：
- 数据从**第3行**开始填写（第1行表头，第2行示例说明）
- 阶段的顺序由Excel中的行顺序决定
- 第3行的阶段是第一个，第4行是第二个，以此类推

**示例数据**：
```
第3行: 询盘 | Inquiry | 买方向卖方询问商品信息和交易条件的阶段 | 初级 | 7 | 🔍 | #3B82F6
第4行: 报盘 | Offer | 卖方向买方报价和交易条件的阶段 | 中级 | 5 | 📊 | #10B981
第5行: 还盘 | Counter-Offer | 买卖双方针对报价和条件进行协商和调整 | 高级 | 10 | 🔄 | #F59E0B
```

---

### Sheet 2: 知识点主表（必填）

定义具体的知识点内容。

| 列名 | 必填 | 说明 | 示例 |
|------|------|------|------|
| 知识点名称* | ✅ | 知识点的名称 | 询盘基本流程 |
| 所属阶段 | ❌ | 关联的阶段名称 | 询盘 |
| 知识点类型 | ❌ | 概念型/技能型/文档型/案例型 | 技能型 |
| 难度 | ❌ | 初级/中级/高级 | 初级 |
| 重要性 | ❌ | 必修/推荐/选修 | 必修 |
| 内容简介 | ❌ | 一句话描述 | 掌握询盘的基本流程和注意事项 |
| 详细描述 | ❌ | 详细说明 | 询盘是外贸业务的第一步... |
| 章节 | ❌ | 所属章节 | 第一章 询盘 |

**重要说明**：
- 数据从**第3行**开始填写
- "所属阶段"字段应填写**Sheet 1中定义的阶段名称**
- 如果阶段名称不存在，会给出警告，但知识点仍会创建

**示例数据**：
```
第3行: 询盘基本流程 | 询盘 | 技能型 | 初级 | 必修 | 掌握询盘的基本流程和注意事项 | 询盘是外贸业务的第一步... | 第一章 询盘
```

---

### Sheet 3: 案例库表（可选）

提供实践案例和场景。

| 列名 | 必填 | 说明 | 示例 |
|------|------|------|------|
| 关联知识点 | ❌ | 关联的知识点名称 | 询盘基本流程 |
| 案例标题 | ❌ | 案例的标题 | 某服装公司收到询盘的处理 |
| 案例场景 | ❌ | 案例的背景场景 | 2023年春季... |
| 案例内容 | ❌ | 详细的案例描述 | 客户通过邮件询问... |

**重要说明**：
- 此Sheet是**可选的**，可以不包含
- 数据从**第3行**开始填写
- "关联知识点"应填写**Sheet 2中定义的知识点名称**
- 如果知识点不存在，该案例会被跳过

---

## 🔄 导入流程

### 整体流程

```
1. 读取Excel文件内容到内存
   ↓
2. 解析三个Sheet的数据
   - 解析谈判流程 → stages_data[]
   - 解析知识点主表 → points_data[]
   - 解析案例库表 → practices_data[]
   ↓
3. 验证数据完整性
   - 检查阶段引用是否存在
   - 检查知识点引用是否存在
   ↓
4. 导入到Neo4j（分步骤）
   - Step 1: 创建Stage节点
   - Step 2: 创建Stage之间的PRECEDES关系
   - Step 3: 创建KnowledgePoint节点
   - Step 4: 创建Stage-KnowledgePoint的HAS_TOPIC关系
   - Step 5: 创建Practice节点和HAS_PRACTICE关系
   ↓
5. 返回导入结果
```

### 详细步骤

#### Step 1: 创建Stage节点

遍历 `stages_data`，为每个阶段创建节点：

```cypher
MERGE (s:Stage {name: $name})
SET s.englishName = $englishName,
    s.description = $description,
    ...
```

- 使用 `MERGE` 确保不重复创建
- 如果节点已存在，更新其属性

#### Step 2: 创建PRECEDES关系

按照Excel中的顺序，创建阶段之间的关系：

```cypher
MATCH (s1:Stage {name: "询盘"})
MATCH (s2:Stage {name: "报盘"})
MERGE (s1)-[:PRECEDES]->(s2)
```

这形成了流程的"脊梁骨"：
```
询盘 → 报盘 → 还盘 → 接受 → 订立合同 → 履行合同 → 支付 → 索赔 → 仲裁 → 结汇
```

#### Step 3: 创建KnowledgePoint节点

遍历 `points_data`，为每个知识点创建节点：

```cypher
// 如果不存在，创建
CREATE (k:KnowledgePoint {
  name: $name,
  type: $type,
  ...
})

// 如果已存在，更新
MATCH (k:KnowledgePoint {name: $name})
SET k.type = $type,
    k.difficulty = $difficulty,
    ...
```

#### Step 4: 创建HAS_TOPIC关系

将知识点连接到对应的阶段：

```cypher
MATCH (s:Stage {name: "询盘"})
MATCH (k:KnowledgePoint {name: "询盘基本流程"})
MERGE (s)-[:HAS_TOPIC]->(k)
```

#### Step 5: 创建Practice节点和关系

如果提供了案例库：

```cypher
// 创建案例节点
CREATE (p:Practice {
  id: $id,
  title: $title,
  ...
})

// 关联到知识点
MATCH (k:KnowledgePoint {name: "询盘基本流程"})
MATCH (p:Practice {id: $id})
MERGE (k)-[:HAS_PRACTICE]->(p)
```

---

## 🎨 前端展示（ECharts）

### 图谱结构

导入后的知识图谱应该呈现**清晰的层级结构**：

```
        Stage层（脊梁骨）
    询盘 → 报盘 → 还盘 → 成交
     ↓      ↓      ↓      ↓
    知识点层（肋骨）
   询盘1   报盘1   还盘1  成交1
   询盘2   报盘2   还盘2  成交2
   询盘3   报盘3   还盘3
     ↓      ↓      ↓
    案例层（叶子）
   案例1   案例2   案例3
```

### ECharts配置示例

```javascript
{
  nodes: [
    // Stage节点（蓝色，大圆）
    { id: 'stage_1', name: '询盘', category: 'stage', symbolSize: 50, itemStyle: { color: '#3B82F6' } },
    { id: 'stage_2', name: '报盘', category: 'stage', symbolSize: 50, itemStyle: { color: '#10B981' } },

    // KnowledgePoint节点（绿色，中圆）
    { id: 'kp_1', name: '询盘基本流程', category: 'knowledge', symbolSize: 30 },
    { id: 'kp_2', name: '询盘函电', category: 'knowledge', symbolSize: 30 },

    // Practice节点（黄色，小圆）
    { id: 'practice_1', name: '案例：某服装公司的询盘', category: 'practice', symbolSize: 20 },
  ],

  links: [
    // PRECEDES关系（粗线，深色）
    { source: 'stage_1', target: 'stage_2', lineStyle: { width: 3, color: '#1E40AF' } },

    // HAS_TOPIC关系（中线）
    { source: 'stage_1', target: 'kp_1', lineStyle: { width: 2 } },
    { source: 'stage_1', target: 'kp_2', lineStyle: { width: 2 } },

    // HAS_PRACTICE关系（细线，虚线）
    { source: 'kp_1', target: 'practice_1', lineStyle: { width: 1, type: 'dashed' } },
  ],

  layout: 'force',
  force: {
    repulsion: 1000,        // 节点之间的斥力
    edgeLength: [100, 200], // 边的长度范围
    layoutAnimation: true,
  }
}
```

---

## 🛠️ 代码结构

### 文件组织

```
services/
  knowledge_graph_importer.py  # 新的统一导入器（重构版）
  knowledge_graph_batch_importer.py  # 旧版本（已废弃）

routes/
  graph.py  # API端点

docs/
  KNOWLEDGE_GRAPH_IMPORT.md  # 本文档
```

### 核心类

#### KnowledgeGraphImporter

主导入器类，负责整个导入流程。

**核心方法**：

```python
def import_from_excel(excel_file: BinaryIO, created_by: str) -> ImportResult:
    """
    从Excel文件导入知识图谱

    统一的入口方法，自动处理三个Sheet
    """
```

**辅助方法**：

- `_parse_stages()` - 解析谈判流程表
- `_parse_knowledge_points()` - 解析知识点主表
- `_parse_practices()` - 解析案例库表
- `_validate_data()` - 验证数据完整性
- `_import_to_neo4j()` - 导入到Neo4j
- `_create_stage()` - 创建Stage节点
- `_create_precedes_relation()` - 创建PRECEDES关系
- `_create_knowledge_point()` - 创建KnowledgePoint节点
- `_create_has_topic_relation()` - 创建HAS_TOPIC关系
- `_create_practice()` - 创建Practice节点
- `_create_has_practice_relation()` - 创建HAS_PRACTICE关系

---

## 📡 API接口

### POST /api/graph/import/batch

智能批量导入知识图谱。

**请求格式**：`multipart/form-data`

**参数**：
- `points_file` (必填): Excel文件，包含三个Sheet
- `mode` (可选): 导入模式，默认为 `merge`

**响应格式**：

```json
{
  "success": true,
  "statistics": {
    "stages": {
      "total": 10,
      "created": 10,
      "updated": 0,
      "failed": 0,
      "success_rate": "100%"
    },
    "points": {
      "total": 50,
      "created": 45,
      "updated": 5,
      "failed": 0,
      "success_rate": "100%"
    },
    "practices": {
      "total": 30,
      "created": 30,
      "failed": 0,
      "success_rate": "100%"
    },
    "relations": {
      "total": 95,
      "created": 95,
      "failed": 0,
      "success_rate": "100%"
    }
  },
  "errors": [],
  "warnings": [
    {
      "level": "WARNING",
      "sheet": "知识点主表",
      "row": 10,
      "field": "所属阶段",
      "value": "未知阶段",
      "message": "阶段'未知阶段'不存在",
      "suggestion": "可用阶段: 询盘, 报盘, 还盘..."
    }
  ],
  "execution_time": "2.35s"
}
```

---

## ❓ 常见问题

### Q1: 为什么我的图谱是"一团乱麻"？

**原因**：Sheet 1（谈判流程）中没有数据，或者阶段之间没有建立 PRECEDES 关系。

**解决方案**：
1. 检查Excel文件是否包含名为"谈判流程"的Sheet
2. 确保该Sheet的第3行及以后有阶段数据
3. 不要删除模板中的示例数据，或者按照模板格式添加自己的数据

### Q2: 导入成功但节点数为0？

**原因**：可能是函数调用参数错误，或者Neo4j连接失败。

**解决方案**：
1. 检查后端日志，查看详细错误信息
2. 确认Neo4j服务正在运行
3. 使用新版导入器（本文档描述的版本）

### Q3: 知识点创建失败？

**原因**：知识点名称重复，或者必填字段缺失。

**解决方案**：
1. 确保每个知识点的名称是唯一的
2. 检查"知识点名称"列不能为空
3. 查看导入结果中的错误信息

### Q4: 如何清空数据库重新导入？

**方法1**：使用Neo4j浏览器
```cypher
MATCH (n) DETACH DELETE n
```

**方法2**：使用清空脚本
```bash
python scripts/clear_neo4j.py
```

---

## 📝 更新日志

### v2.0 (2025-11-20) - 重构版

- ✅ 完全重写导入逻辑，采用简洁清晰的实现
- ✅ 统一三表导入流程，移除复杂的两表/三表分支
- ✅ 修复所有已知的函数调用和参数错误
- ✅ 改进错误处理和日志记录
- ✅ 更新文档，提供完整的使用指南

### v1.x (历史版本)

- 旧版本包含两表法和三表法两套逻辑
- 存在多处函数调用错误
- 文件流处理问题
- 已废弃，不推荐使用

---

## 🎯 最佳实践

1. **使用模板**：
   - 下载官方模板文件
   - 不要删除示例数据，在示例数据后面添加自己的内容
   - 保持Sheet名称不变

2. **数据准备**：
   - 先填写"谈判流程"Sheet，定义所有阶段
   - 再填写"知识点主表"Sheet，引用已定义的阶段
   - 最后填写"案例库表"Sheet（可选）

3. **验证数据**：
   - 导入前使用"数据预览"功能检查
   - 关注警告信息，及时修正

4. **增量更新**：
   - 使用 `merge` 模式进行增量导入
   - 已存在的知识点会被更新，不会重复创建

5. **查看日志**：
   - 导入失败时查看后端日志
   - 日志会显示详细的错误位置和原因

---

## 🚀 自动构建知识图谱 (Beta)

- 入口：教师端“自动构建知识图谱 (Beta)”卡片，上传 Word 文档。
- 流程：`POST /api/admin/theory/import-docx/drafts` 解析章节/小节 → 生成知识点草稿并持久化（表 `knowledge_jobs` / `knowledge_drafts`）。
- 审核：`GET /api/admin/theory/drafts/{jobId}` 查看草稿；`POST /api/admin/theory/drafts/{jobId}/approve` 勾选通过，写入 Neo4j（节点字段含 summary/content/bodyHtml/tags）。当前不自动生成关系，可后续补充关系草稿。
- 扩展：可接入向量检索 + 异步 LLM 任务，替换现有同步草稿生成，支持大文本分批处理与关系草稿生成。

---

## 📞 技术支持

如有问题，请：
1. 查看本文档的"常见问题"章节
2. 检查后端日志获取详细错误信息
3. 使用调试脚本 `scripts/debug_excel_file.py` 检查Excel文件
4. 提交Issue到项目仓库

---

**文档版本**: 2.0
**最后更新**: 2025-11-20
**维护者**: AI Smart Foreign Trade Negotiation Assistant Team
