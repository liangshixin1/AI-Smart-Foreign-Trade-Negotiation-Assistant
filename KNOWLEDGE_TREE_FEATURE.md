# 📚 知识分类树功能说明

## 🎯 功能概述

全新的**知识分类树管理系统**，实现了低门槛、高效率、智能辅助的知识点管理体验。

### ✨ 核心特性

1. **🌳 树形可视化管理**
   - 直观的层级分类结构
   - 支持多级分类（最多3级）
   - 折叠/展开分类查看

2. **🖱️ 拖拽式操作**
   - 拖拽知识点在分类间移动
   - 拖拽分类调整层级关系
   - 拖拽排序知识点顺序

3. **⚡ 高效管理**
   - 快速创建/编辑/删除分类
   - 批量导入知识点自动分类
   - 一键展开/收起所有分类

4. **🤝 与理论学习联动**
   - 在理论课程中插入知识点时使用树形选择器
   - 自动关联知识点与课程内容
   - 统一的知识点数据源

## 🚀 快速开始

### 1. 初始化分类数据

首次使用前，运行初始化脚本创建默认分类：

```bash
python scripts/init_knowledge_categories.py
```

这将创建以下默认分类结构：

```
📚 贸易基础
├─ 💼 贸易术语
│  ├─ FOB
│  ├─ CIF
│  └─ CFR
├─ 💳 支付方式
│  ├─ L/C
│  ├─ T/T
│  └─ D/P
└─ 🚢 物流运输

🤝 谈判技巧
├─ 💬 沟通技巧
├─ 🎯 谈判策略
└─ 📋 案例分析

⚖️ 法律法规

📄 贸易文档
```

### 2. 访问知识树视图

1. 登录教师账号
2. 进入"知识图谱"标签页
3. 点击"🌳 知识分类树视图"按钮
4. 开始管理知识分类和知识点

## 📖 使用指南

### 创建分类

1. 点击"➕ 新建分类"按钮
2. 填写分类信息：
   - **分类ID**: 唯一标识符（如：trade_terms）
   - **分类名称**: 显示名称（如：贸易术语）
   - **图标**: Emoji表情（如：💼）
   - **颜色**: 分类主题色
   - **描述**: 简短说明
3. 点击"保存"

### 管理子分类

1. 在分类右侧点击"➕"按钮
2. 创建子分类
3. 或者拖拽现有分类到目标分类下

### 移动知识点

**方式1：拖拽移动**
- 直接拖拽知识点到目标分类

**方式2：编辑移动**
- 点击知识点的"✏️"按钮
- 修改所属分类

### 排序调整

- **分类排序**: 拖拽分类上下移动
- **知识点排序**: 拖拽知识点调整顺序

## 🔧 API接口

### 分类管理

```javascript
// 获取分类树（含知识点）
GET /api/graph/categories/tree/with-knowledge

// 创建分类
POST /api/graph/categories
{
  "id": "category_id",
  "name": "分类名称",
  "icon": "📁",
  "color": "#3b82f6",
  "level": 1,
  "orderIndex": 0,
  "parentId": null  // 可选，父分类ID
}

// 更新分类
PUT /api/graph/categories/{category_id}
{
  "name": "新名称",
  "icon": "📚"
}

// 删除分类（软删除）
DELETE /api/graph/categories/{category_id}

// 移动分类
POST /api/graph/categories/{category_id}/move
{
  "newParentId": "parent_category_id",  // null表示移到根级别
  "orderIndex": 0
}

// 批量更新分类排序
POST /api/graph/categories/reorder
{
  "orders": [
    {"id": "category1", "orderIndex": 0},
    {"id": "category2", "orderIndex": 1}
  ]
}
```

### 知识点管理

```javascript
// 移动知识点到新分类
POST /api/graph/knowledge-points/{name}/move
{
  "newCategoryId": "category_id",
  "orderIndex": 0
}

// 批量更新知识点排序
POST /api/graph/knowledge-points/reorder
{
  "categoryId": "category_id",
  "orders": [
    {"name": "FOB", "orderIndex": 0},
    {"name": "CIF", "orderIndex": 1}
  ]
}
```

## 🎨 界面设计

### 视觉特点

- **现代扁平化设计**: 简洁清爽的界面
- **渐变色彩**: 美观的主题色渐变
- **流畅动画**: 平滑的交互反馈
- **响应式布局**: 适配不同屏幕尺寸

### 交互特性

- **悬停高亮**: 鼠标悬停时显示操作按钮
- **拖拽预览**: 拖拽时显示蓝色虚线框提示
- **即时反馈**: 操作成功/失败即时提示
- **防误操作**: 删除前需要确认

## 🔄 与理论学习管理的联动

### 插入知识点时

1. 在理论课程编辑器中点击"插入关键知识点"
2. 弹出知识点选择器（未来将升级为树形选择器）
3. 选择知识点后自动插入到编辑器
4. 保存时自动创建知识图谱关系

### 数据同步

- 知识点在分类树中的修改会实时反映到理论学习管理
- 理论课程中使用的知识点会在分类树中显示使用次数
- 删除知识点前会检查是否被课程使用

## 🛠️ 技术架构

### 后端

- **框架**: Flask
- **数据库**: Neo4j图数据库
- **服务层**: `services/knowledge_service.py`
- **路由层**: `routes/graph.py`

### 前端

- **主要文件**:
  - `static/js/knowledge-tree.js` - 树形视图逻辑
  - `static/css/knowledge-tree.css` - 样式定义
- **核心技术**:
  - 原生JavaScript
  - HTML5 Drag & Drop API
  - CSS3动画

### 数据模型

**KnowledgeCategory节点**:
```cypher
{
  id: string,           // 唯一标识
  name: string,         // 分类名称
  code: string,         // 分类代码
  level: int,           // 层级（1/2/3）
  orderIndex: int,      // 排序索引
  icon: string,         // 图标emoji
  color: string,        // 主题色
  description: string,  // 描述
  isActive: boolean,    // 是否启用
  createdAt: datetime,
  updatedAt: datetime
}
```

**关系**:
- `BELONGS_TO`: KnowledgePoint -> KnowledgeCategory
- `PARENT_OF`: KnowledgeCategory -> KnowledgeCategory

## 📝 最佳实践

### 分类命名

- **使用清晰的名称**: 如"贸易术语"而不是"术语"
- **保持层级简洁**: 最多3级分类
- **使用图标增强可读性**: 为每个分类选择合适的emoji

### 知识点组织

- **按主题分类**: 相关知识点放在同一分类下
- **控制每个分类下的知识点数量**: 建议不超过20个
- **使用子分类细分**: 当某个分类知识点过多时

### 性能优化

- **批量操作**: 使用批量API而不是循环调用
- **懒加载**: 大量分类时按需展开
- **缓存**: 前端缓存分类树减少请求

## 🐛 故障排除

### 问题：拖拽不工作

**解决方案**:
1. 检查浏览器是否支持Drag & Drop API
2. 确保JavaScript已正确加载
3. 查看浏览器控制台是否有错误

### 问题：分类树不显示

**解决方案**:
1. 检查Neo4j数据库连接
2. 运行初始化脚本创建分类
3. 查看后端日志排查API错误

### 问题：知识点移动后不更新

**解决方案**:
1. 刷新页面重新加载数据
2. 检查API响应是否成功
3. 查看Neo4j数据库中的关系是否正确更新

## 🔮 未来规划

### 即将推出

1. **智能分类推荐**
   - AI自动分析知识点内容
   - 推荐最合适的分类

2. **批量导入时自动分类**
   - Excel导入时自动识别分类
   - 基于关键词匹配分类

3. **分类模板**
   - 预设常用分类结构
   - 一键导入分类模板

4. **统计分析**
   - 各分类知识点数量统计
   - 知识点使用热度分析

5. **权限管理**
   - 分类级别的访问控制
   - 知识点编辑权限管理

## 📞 支持

如有问题或建议，请通过以下方式联系：

- 📧 邮箱: [项目负责人邮箱]
- 💬 Issue: [GitHub Issues链接]
- 📖 文档: [完整文档链接]

---

**版本**: 1.0.0
**更新日期**: 2025-11-01
**作者**: AI外贸谈判实训平台团队
