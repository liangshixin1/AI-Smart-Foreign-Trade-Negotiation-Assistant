# 多节点类型架构使用指南

## 概述

本系统已升级为支持多节点类型的知识图谱架构,从单一的 `KnowledgePoint` 节点扩展到包含 `Stage`(阶段)、`Skill`(技能)、`Terminology`(术语) 等专用节点类型。

## 核心概念

### 节点类型 (Node Types)

1. **Stage (阶段节点)** 🔴
   - 用途: 表示外贸谈判的核心流程阶段
   - 示例: 询盘、报盘、还盘、接受、签订合同...
   - 属性: name, englishName, order, description, difficulty, estimatedDuration, icon, color
   - 关系: `PRECEDES` (先后顺序), `HAS_TOPIC` (包含知识点)

2. **Terminology (术语节点)** ⚪
   - 用途: 存储贸易术语和概念定义
   - 示例: FOB, CIF, L/C, T/T...
   - 属性: name, fullName, chineseName, category, definition, difficulty
   - 关系: `RELATED_TO` (术语关联)

3. **Skill (技能节点)** 🔵
   - 用途: 可操作的技能和方法
   - 示例: 价格计算、报价单制作、谈判技巧...
   - 属性: name, description, difficulty, estimatedDuration
   - 关系: `REQUIRES` (前置技能)

4. **KnowledgePoint (通用知识点)** 🟢
   - 用途: 保留向后兼容,用于一般性知识
   - 关系: `REQUIRES`, `RELATED_TO`, `TESTS`, `EXPLAINS`

### 关系类型 (Relationship Types)

1. **PRECEDES** - 流程先后关系
   - 用于 Stage 之间,表达线性的业务流程
   - 示例: (询盘)-[:PRECEDES]->(报盘)

2. **HAS_TOPIC** - 阶段包含知识点
   - 将知识点关联到流程阶段
   - 示例: (Stage:报盘)-[:HAS_TOPIC]->(KnowledgePoint:Incoterms应用)

3. **RELATED_TO** - 语义关联
   - 表示概念之间的相关性
   - 示例: (FOB)-[:RELATED_TO]->(CIF)

4. **REQUIRES** - 前置依赖
   - 表示学习或技能的先后顺序
   - 示例: (高级谈判)-[:REQUIRES]->(基础谈判)

## 后端 API 使用

### 1. 运行迁移

首次使用前需要运行迁移脚本,创建 Stage 和 Terminology 节点:

```bash
POST /api/graph/migrations/multi-node-types/run
```

**响应示例:**
```json
{
  "success": true,
  "statistics": {
    "stages_created": 10,
    "terminology_created": 5,
    "precedes_relations": 9,
    "constraints_created": 3,
    "indexes_created": 2
  }
}
```

### 2. 检查迁移状态

```bash
GET /api/graph/migrations/multi-node-types/status
```

**响应示例:**
```json
{
  "status": {
    "applied": true,
    "stages_count": 10,
    "terminology_count": 5,
    "precedes_count": 9,
    "expected_stages": 10,
    "expected_terminology": 5
  }
}
```

### 3. 获取流程骨架

```bash
GET /api/graph/flow
```

**响应示例:**
```json
{
  "stages": [
    {
      "name": "询盘",
      "englishName": "Inquiry",
      "order": 1,
      "description": "买方向卖方询问商品信息和交易条件的阶段",
      "difficulty": "beginner",
      "icon": "🔍",
      "color": "#3B82F6",
      "topicsCount": 5
    },
    {
      "name": "报盘",
      "englishName": "Offer",
      "order": 2,
      "description": "卖方向买方报价和交易条件的阶段",
      "difficulty": "intermediate",
      "icon": "📊",
      "color": "#10B981",
      "topicsCount": 8
    }
  ],
  "flow": [
    {
      "from": "询盘",
      "to": "报盘",
      "description": "询盘完成后进入报盘",
      "fromOrder": 1,
      "toOrder": 2
    }
  ],
  "totalStages": 10,
  "totalFlows": 9
}
```

### 4. 获取 Stage 列表

```bash
GET /api/graph/stages?include_topics=true
```

**响应示例:**
```json
{
  "stages": [
    {
      "name": "询盘",
      "order": 1,
      "topics": ["客户需求分析", "产品信息准备", "询盘邮件模板"]
    }
  ]
}
```

### 5. 获取术语列表

```bash
GET /api/graph/terminology?category=Incoterms
```

**响应示例:**
```json
{
  "terminology": [
    {
      "name": "FOB",
      "fullName": "Free On Board",
      "chineseName": "离岸价",
      "category": "Incoterms",
      "definition": "货物在指定装运港越过船舷,卖方即完成交货",
      "relatedTerms": ["CIF", "CFR"],
      "difficulty": "beginner"
    }
  ]
}
```

### 6. 将知识点关联到阶段

```bash
POST /api/graph/stages/报盘/knowledge-points/Incoterms应用
```

### 7. 获取增强的可视化数据

```bash
GET /api/graph/visualization/enhanced?node_types=Stage,KnowledgePoint&max_nodes=50
```

**响应示例:**
```json
{
  "nodes": [
    {
      "id": "询盘",
      "label": "询盘",
      "type": "Stage",
      "group": "Stage",
      "properties": {
        "name": "询盘",
        "order": 1,
        "color": "#3B82F6"
      }
    }
  ],
  "edges": [
    {
      "from": "询盘",
      "to": "报盘",
      "label": "PRECEDES",
      "type": "PRECEDES"
    }
  ],
  "statistics": {
    "totalNodes": 25,
    "totalEdges": 40,
    "nodesByType": {
      "Stage": 10,
      "KnowledgePoint": 15
    },
    "edgesByType": {
      "PRECEDES": 9,
      "HAS_TOPIC": 20,
      "REQUIRES": 11
    }
  }
}
```

## 前端可视化

### Vis-Network 配置示例

```javascript
// 节点样式配置
const nodeGroups = {
  // Stage 节点 - 红色大型六边形
  Stage: {
    shape: 'hexagon',
    size: 40,
    color: {
      background: '#FF6B6B',
      border: '#C92A2A',
      highlight: {
        background: '#FF8787',
        border: '#E03131'
      }
    },
    font: {
      size: 16,
      color: '#FFFFFF',
      bold: true
    },
    borderWidth: 3,
    shadow: true
  },

  // Skill 节点 - 青色中型圆形
  Skill: {
    shape: 'circle',
    size: 25,
    color: {
      background: '#4ECDC4',
      border: '#2C7A7B',
      highlight: {
        background: '#6EDDD6',
        border: '#38B2AC'
      }
    },
    font: {
      size: 14,
      color: '#FFFFFF'
    },
    borderWidth: 2
  },

  // Terminology 节点 - 白色小型虚线圆形
  Terminology: {
    shape: 'circle',
    size: 15,
    color: {
      background: '#F7FFF7',
      border: '#718096',
      highlight: {
        background: '#FFFFFF',
        border: '#4A5568'
      }
    },
    font: {
      size: 12,
      color: '#2D3748'
    },
    borderWidth: 2,
    shapeProperties: {
      borderDashes: [5, 5]
    }
  },

  // KnowledgePoint 节点 - 绿色中型圆点
  KnowledgePoint: {
    shape: 'dot',
    size: 20,
    color: {
      background: '#48BB78',
      border: '#2F855A',
      highlight: {
        background: '#68D391',
        border: '#38A169'
      }
    },
    font: {
      size: 13,
      color: '#FFFFFF'
    },
    borderWidth: 2
  }
};

// 边样式配置
const edgeStyles = {
  PRECEDES: {
    color: { color: '#2D3748' },
    width: 3,
    arrows: {
      to: { enabled: true, scaleFactor: 1.2 }
    },
    smooth: { type: 'curvedCW', roundness: 0.2 },
    label: 'Next Step'
  },
  HAS_TOPIC: {
    color: { color: '#A0AEC0' },
    width: 2,
    arrows: {
      to: { enabled: true, scaleFactor: 0.8 }
    },
    smooth: true
  },
  RELATED_TO: {
    color: { color: '#CBD5E0' },
    width: 1,
    arrows: false,
    dashes: true
  },
  REQUIRES: {
    color: { color: '#FC8181' },
    width: 2,
    arrows: {
      to: { enabled: true, scaleFactor: 1 }
    },
    smooth: { type: 'cubicBezier' }
  }
};

// 分层布局配置
const options = {
  layout: {
    hierarchical: {
      enabled: true,
      direction: 'LR',  // Left-Right 从左到右
      sortMethod: 'directed',
      levelSeparation: 200,
      nodeSpacing: 150,
      treeSpacing: 200
    }
  },
  physics: {
    enabled: false  // 关闭物理引擎,使用固定的分层布局
  },
  groups: nodeGroups,
  edges: {
    font: {
      size: 11,
      color: '#718096',
      align: 'top'
    }
  },
  interaction: {
    hover: true,
    tooltipDelay: 200,
    zoomView: true,
    dragView: true
  }
};

// 初始化网络
const container = document.getElementById('mynetwork');

// 从 API 获取数据
fetch('/api/graph/visualization/enhanced?node_types=Stage,KnowledgePoint&max_nodes=100')
  .then(response => response.json())
  .then(data => {
    const nodes = new vis.DataSet(data.nodes);
    const edges = new vis.DataSet(data.edges.map(edge => ({
      ...edge,
      ...edgeStyles[edge.type]
    })));

    const network = new vis.Network(container, {nodes, edges}, options);

    // 事件监听
    network.on('click', function(params) {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.get(nodeId);
        console.log('Clicked node:', node);
        // 显示节点详情
      }
    });
  });
```

### 流程轴渲染示例

```javascript
// 使用 D3.js 渲染流程轴
async function renderProcessFlow() {
  const response = await fetch('/api/graph/flow');
  const data = await response.json();

  const svg = d3.select('#flow-diagram')
    .append('svg')
    .attr('width', '100%')
    .attr('height', 200);

  const margin = { left: 50, right: 50 };
  const width = svg.node().getBoundingClientRect().width;
  const stageWidth = (width - margin.left - margin.right) / data.stages.length;

  // 绘制阶段节点
  const stages = svg.selectAll('.stage')
    .data(data.stages)
    .enter()
    .append('g')
    .attr('class', 'stage')
    .attr('transform', (d, i) => `translate(${margin.left + i * stageWidth + stageWidth / 2}, 100)`);

  stages.append('circle')
    .attr('r', 30)
    .attr('fill', d => d.color)
    .attr('stroke', '#FFF')
    .attr('stroke-width', 3);

  stages.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', 5)
    .attr('fill', '#FFF')
    .attr('font-size', 24)
    .text(d => d.icon);

  stages.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', 50)
    .attr('font-size', 14)
    .text(d => d.name);

  // 绘制连接线
  const lines = svg.selectAll('.flow-line')
    .data(data.flow)
    .enter()
    .append('line')
    .attr('class', 'flow-line')
    .attr('x1', (d) => margin.left + (d.fromOrder - 1) * stageWidth + stageWidth / 2 + 35)
    .attr('y1', 100)
    .attr('x2', (d) => margin.left + (d.toOrder - 1) * stageWidth + stageWidth / 2 - 35)
    .attr('y2', 100)
    .attr('stroke', '#2D3748')
    .attr('stroke-width', 3)
    .attr('marker-end', 'url(#arrowhead)');

  // 添加箭头标记
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('markerWidth', 10)
    .attr('markerHeight', 10)
    .attr('refX', 9)
    .attr('refY', 3)
    .attr('orient', 'auto')
    .append('polygon')
    .attr('points', '0 0, 10 3, 0 6')
    .attr('fill', '#2D3748');
}
```

## 数据迁移与兼容性

### 向后兼容

- 现有的 `KnowledgePoint` 节点和关系保持不变
- 新旧节点类型可以共存
- API 接口向后兼容

### 数据迁移

如需将现有 KnowledgePoint 迁移到新架构:

```python
from services.graph_service import _get_driver
from migrations.migration_002 import migrate_existing_knowledge_points

driver = _get_driver()
stats = migrate_existing_knowledge_points(driver)
print(stats)
# 输出: {'migrated_to_terminology': 10, 'migrated_to_skill': 15, ...}
```

## 最佳实践

1. **流程设计**
   - Stage 节点用于表达线性的业务流程
   - 每个 Stage 的 order 属性必须唯一且连续

2. **知识点组织**
   - 将知识点通过 HAS_TOPIC 关联到对应的 Stage
   - 使用 Terminology 节点存储可复用的术语定义
   - Skill 节点用于表示可操作的技能

3. **可视化优化**
   - 使用分层布局展示流程骨架
   - 通过颜色和形状区分节点类型
   - PRECEDES 关系使用粗箭头突出主流程

4. **性能考虑**
   - 使用 node_types 参数过滤不需要的节点类型
   - 通过 max_nodes 限制节点数量
   - 分批查询大型图谱

## 故障排查

### 迁移失败

如果迁移失败,检查:
1. Neo4j 连接是否正常
2. 是否已存在同名的 Stage 节点
3. 日志中的详细错误信息

### 可视化性能问题

如果图谱渲染缓慢:
1. 减少 max_nodes 参数
2. 使用 node_types 过滤
3. 禁用物理引擎 (physics.enabled = false)
4. 使用分层布局而不是力导向布局

## 下一步

- [ ] 升级 Excel 导入逻辑支持多节点类型
- [ ] 添加节点类型转换功能
- [ ] 实现智能路径推荐(基于 PRECEDES 关系)
- [ ] 添加流程验证(检测循环依赖)
