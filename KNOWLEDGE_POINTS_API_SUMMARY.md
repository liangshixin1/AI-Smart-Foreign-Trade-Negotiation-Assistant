# 知识点管理系统API完整文档

## 概述

本文档记录了知识点管理系统的完整API端点实现，包括CRUD操作、关系管理、分类管理和导入导出功能。

## 数据模型

### Neo4j KnowledgePoint节点属性

```
- name: string (唯一标识)
- description: string (描述)
- category: string (分类)
- difficulty: string (难度: beginner/intermediate/advanced)
- importance: string (重要性: low/medium/high)
- estimatedDuration: int (预计学习时长，分钟)
- content: string (详细内容)
- tags: array[string] (标签列表)
```

### 关系类型

- `REQUIRES`: 知识点A -> 知识点B (A需要B作为前置依赖)
- `RELATED_TO`: 知识点A <-> 知识点B (双向关联)
- `TESTS`: Practice -> KnowledgePoint (实战练习测试知识点)
- `EXPLAINS`: TheoryLesson -> KnowledgePoint (理论课程解释知识点)

## API端点清单

### 1. 知识点CRUD操作

#### 1.1 获取知识点列表（旧版，向后兼容）
- **端点**: `GET /api/graph/knowledge-points`
- **权限**: teacher
- **参数**:
  - `search` (可选): 搜索关键词
  - `category` (可选): 分类过滤
  - `difficulty` (可选): 难度过滤
- **返回**: `{"knowledgePoints": [...]}`

#### 1.2 获取知识点列表（增强版）
- **端点**: `GET /api/graph/knowledge-points/enhanced`
- **权限**: teacher
- **参数**:
  - `search` (可选): 搜索关键词
  - `category` (可选): 分类过滤
  - `difficulty` (可选): 难度过滤
- **返回**: `{"knowledge_points": [...]}`
- **说明**: 返回更详细的知识点信息，包括前置依赖和关联关系

#### 1.3 获取单个知识点详情
- **端点**: `GET /api/graph/knowledge-points/<name>`
- **权限**: teacher
- **返回**: 知识点详细信息对象

#### 1.4 创建知识点
- **端点**: `POST /api/graph/knowledge-points`
- **权限**: teacher
- **请求体**:
```json
{
  "name": "知识点名称" (必需),
  "description": "描述",
  "category": "分类",
  "difficulty": "beginner|intermediate|advanced",
  "importance": "low|medium|high",
  "estimated_duration": 30,
  "content": "详细内容",
  "tags": ["标签1", "标签2"]
}
```
- **返回**: 创建的知识点对象

#### 1.5 更新知识点
- **端点**: `PUT /api/graph/knowledge-points/<name>`
- **权限**: teacher
- **请求体**: 同创建接口
- **返回**: 更新后的知识点对象

#### 1.6 删除知识点
- **端点**: `DELETE /api/graph/knowledge-points/<name>`
- **权限**: teacher
- **返回**: `{"message": "Knowledge point '...' deleted successfully"}`

### 2. 关系管理

#### 2.1 添加前置依赖
- **端点**: `POST /api/graph/knowledge-points/<name>/prerequisites`
- **权限**: teacher
- **请求体**:
```json
{
  "prerequisite_name": "前置知识点名称"
}
```
- **返回**: 更新后的知识点对象

#### 2.2 移除前置依赖
- **端点**: `DELETE /api/graph/knowledge-points/<name>/prerequisites/<prerequisite_name>`
- **权限**: teacher
- **返回**: 更新后的知识点对象

#### 2.3 添加关联关系
- **端点**: `POST /api/graph/knowledge-points/<name>/relations`
- **权限**: teacher
- **请求体**:
```json
{
  "related_name": "关联知识点名称",
  "relationship_type": "RELATED_TO" (可选，默认RELATED_TO)
}
```
- **返回**: 更新后的知识点对象

#### 2.4 移除关联关系
- **端点**: `DELETE /api/graph/knowledge-points/<name>/relations/<related_name>`
- **权限**: teacher
- **返回**: 更新后的知识点对象

### 3. 分类管理

#### 3.1 获取分类列表
- **端点**: `GET /api/graph/categories`
- **权限**: teacher
- **返回**: `{"categories": ["分类1", "分类2", ...]}`

#### 3.2 获取分类树
- **端点**: `GET /api/graph/categories/tree`
- **权限**: teacher
- **返回**:
```json
{
  "categories": [
    {"name": "分类1", "count": 10},
    {"name": "分类2", "count": 5}
  ]
}
```

### 4. 导入导出

#### 4.1 下载导入模板
- **端点**: `GET /api/graph/import/template`
- **权限**: teacher
- **返回**: Excel文件下载

#### 4.2 导入Excel文件
- **端点**: `POST /api/graph/import/excel`
- **权限**: teacher
- **请求**: `multipart/form-data`, 文件字段名为 `file`
- **返回**:
```json
{
  "created": 5,
  "updated": 3,
  "failed": 1,
  "errors": ["错误信息1", "错误信息2"]
}
```

#### 4.3 导入CSV文件
- **端点**: `POST /api/graph/import/csv`
- **权限**: teacher
- **请求**: `multipart/form-data`, 文件字段名为 `file`
- **返回**: 同Excel导入

#### 4.4 导出Excel文件
- **端点**: `GET /api/graph/export/excel`
- **权限**: teacher
- **返回**: Excel文件下载

#### 4.5 导出CSV文件
- **端点**: `GET /api/graph/export/csv`
- **权限**: teacher
- **返回**: CSV文件下载

## Excel/CSV文件格式

### 列定义

| 列名 | 说明 | 必需 |
|------|------|------|
| 名称 | 知识点唯一名称 | 是 |
| 描述 | 知识点描述 | 否 |
| 分类 | 知识点分类 | 否 |
| 难度 | beginner/intermediate/advanced | 否 |
| 重要性 | low/medium/high | 否 |
| 预计学习时长(分钟) | 整数 | 否 |
| 标签(逗号分隔) | 多个标签用逗号分隔 | 否 |
| 内容 | 详细内容 | 否 |
| 前置依赖(逗号分隔) | 多个依赖用逗号分隔 | 否 |
| 关联知识点(逗号分隔) | 多个关联用逗号分隔 | 否 |

## 前后端数据同步

### 新旧功能统一

1. **理论学习管理中的"插入关键知识点"**
   - 使用API: `GET /api/graph/knowledge-points`
   - 数据来源: Neo4j KnowledgePoint节点
   - 状态存储: `state.admin.graph.knowledgePoints`

2. **知识图谱中的知识点管理UI**
   - 使用API: 所有上述API端点
   - 数据来源: 同一个Neo4j数据库
   - 前端代码: `static/js/graph-knowledge.js`

### 数据同步保证

- 两个功能使用同一套API和数据源
- 旧的`GET /api/graph/knowledge-points`端点已增强，支持过滤参数
- 所有创建、更新、删除操作立即反映在Neo4j数据库
- 前端刷新时获取最新数据

## 测试清单

### 功能测试

- [x] 创建知识点
- [x] 获取知识点列表
- [x] 获取单个知识点详情
- [x] 更新知识点
- [x] 删除知识点
- [x] 添加前置依赖
- [x] 移除前置依赖
- [x] 添加关联关系
- [x] 移除关联关系
- [x] 获取分类列表
- [x] 获取分类树
- [x] 导出Excel
- [x] 导出CSV
- [x] 导入Excel
- [x] 导入CSV

### 集成测试

- [ ] 理论学习管理插入知识点功能与新UI数据同步
- [ ] 知识点在知识图谱网络中正确显示
- [ ] 前置依赖关系在图谱中正确显示
- [ ] 关联关系在图谱中正确显示

## 实现细节

### 服务层 (services/graph_service.py)

新增函数：
- `list_knowledge_points_enhanced()`: 增强的知识点列表查询
- `get_knowledge_point()`: 获取单个知识点
- `create_knowledge_point()`: 创建知识点
- `update_knowledge_point()`: 更新知识点
- `delete_knowledge_point()`: 删除知识点
- `add_knowledge_prerequisite()`: 添加前置依赖
- `remove_knowledge_prerequisite()`: 移除前置依赖
- `add_knowledge_relation()`: 添加关联关系
- `remove_knowledge_relation()`: 移除关联关系
- `list_knowledge_categories()`: 获取分类列表
- `get_knowledge_categories_tree()`: 获取分类树
- `export_knowledge_points_to_excel()`: 导出Excel
- `export_knowledge_points_to_csv()`: 导出CSV
- `import_knowledge_points_from_excel()`: 导入Excel
- `import_knowledge_points_from_csv()`: 导入CSV

### 路由层 (routes/graph.py)

新增端点：13个API端点（见上述清单）

## 部署说明

1. 确保Neo4j数据库正在运行
2. 确保环境变量配置正确（NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD）
3. 重启Flask应用以加载新的API端点
4. 前端已配置完成，无需额外部署

## 未来改进

1. 添加知识点版本历史追踪
2. 支持批量操作API
3. 添加知识点学习进度跟踪
4. 支持知识点推荐算法
5. 添加知识点评论和评分功能
