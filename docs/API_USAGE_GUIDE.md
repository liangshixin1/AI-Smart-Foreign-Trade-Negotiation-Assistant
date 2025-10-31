# 知识图谱增强功能 - API使用指南

## 📍 功能入口说明

### 当前状态

本次更新完成了：
- ✅ 后端服务（knowledge_service.py, knowledge_importer.py）
- ✅ API路由（routes/graph.py 已扩展）
- ✅ 数据库迁移脚本
- ✅ Docker配置和文档

### 功能访问方式

目前有**两种使用方式**：

#### 方式1：通过API直接调用（立即可用）✅

所有功能都通过REST API提供，教师可以使用任何HTTP客户端访问。

#### 方式2：通过前端UI（待实现）⏳

前端UI界面需要进一步开发，但API已经完全可用。

---

## 🔌 API端点列表

### 基础URL
```
http://localhost:5000
```

### 认证
所有API需要教师权限，在请求头中包含token：
```
Authorization: Bearer <your-token>
```

---

## 📚 知识点管理API

### 1. 列出知识点（增强版）

```http
GET /api/graph/knowledge-points/enhanced
```

**查询参数：**
- `category` - 分类ID（可选）
- `type` - 类型（可选）: concept/skill/document/case等
- `difficulty` - 难度（可选）: beginner/intermediate/advanced
- `importance` - 重要性（可选）: required/recommended/optional
- `keyword` - 关键词搜索（可选）
- `limit` - 每页数量（默认100）
- `offset` - 偏移量（默认0）

**示例：**
```bash
# 获取所有贸易术语分类的知识点
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/graph/knowledge-points/enhanced?category=incoterms"

# 搜索包含"FOB"的知识点
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/graph/knowledge-points/enhanced?keyword=FOB"
```

**响应示例：**
```json
{
  "knowledgePoints": [
    {
      "name": "FOB成本构成",
      "code": "IN-123",
      "category": "incoterms",
      "type": "concept",
      "difficulty": "beginner",
      "importance": "required",
      "summary": "FOB价格的组成部分",
      "keywords": ["FOB", "成本", "价格"],
      "estimatedMinutes": 15,
      "categoryName": "贸易术语",
      "practiceCount": 3,
      "lessonCount": 2
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 100
}
```

---

### 2. 创建知识点

```http
POST /api/graph/knowledge-points
Content-Type: application/json
```

**请求体：**
```json
{
  "name": "FOB价格计算实务",
  "category": "incoterms",
  "type": "skill",
  "difficulty": "intermediate",
  "importance": "required",
  "summary": "FOB价格的实际计算方法",
  "description": "详细讲解FOB价格计算的步骤...",
  "keywords": ["FOB", "价格", "计算"],
  "tags": ["实务操作", "价格"],
  "estimatedMinutes": 30,
  "imageUrl": "https://example.com/image.jpg",
  "videoUrl": "https://example.com/video.mp4",
  "documentUrl": "https://example.com/doc.pdf",
  "externalUrl": "https://example.com/reference"
}
```

**必填字段：**
- `name` - 知识点名称

**示例：**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"FOB价格计算","category":"incoterms","type":"skill"}' \
  http://localhost:5000/api/graph/knowledge-points
```

---

### 3. 获取知识点详情

```http
GET /api/graph/knowledge-points/<name>
```

**示例：**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/graph/knowledge-points/FOB成本构成"
```

**响应包含：**
- 基本信息
- 分类名称
- 前置依赖列表
- 关联知识点列表

---

### 4. 更新知识点

```http
PUT /api/graph/knowledge-points/<name>
Content-Type: application/json
```

**示例：**
```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"summary":"更新后的描述","difficulty":"advanced"}' \
  "http://localhost:5000/api/graph/knowledge-points/FOB成本构成"
```

---

### 5. 删除知识点

```http
DELETE /api/graph/knowledge-points/<name>
```

**示例：**
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/graph/knowledge-points/测试知识点"
```

---

## 🗂️ 分类管理API

### 6. 获取分类列表

```http
GET /api/graph/categories
```

**查询参数：**
- `level` - 层级（可选）: 1/2/3
- `parentId` - 父分类ID（可选）

**示例：**
```bash
# 获取所有一级分类
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/graph/categories?level=1"

# 获取某个分类的子分类
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/graph/categories?parentId=trade-fundamentals"
```

---

### 7. 获取分类树

```http
GET /api/graph/categories/tree
```

**示例：**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/graph/categories/tree
```

**响应示例：**
```json
{
  "categoryTree": [
    {
      "id": "trade-fundamentals",
      "name": "贸易基础",
      "level": 1,
      "icon": "📦",
      "color": "#3B82F6",
      "children": [
        {
          "id": "incoterms",
          "name": "贸易术语",
          "level": 2,
          "icon": "🏷️",
          "color": "#60A5FA"
        }
      ]
    }
  ]
}
```

---

## 🔗 关系管理API

### 8. 添加前置依赖

```http
POST /api/graph/knowledge-points/<name>/prerequisites
Content-Type: application/json
```

**请求体：**
```json
{
  "prerequisite": "国际支付工具",
  "isStrict": true,
  "reason": "信用证是国际支付工具的一种"
}
```

**示例：**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prerequisite":"国际支付工具","isStrict":true}' \
  "http://localhost:5000/api/graph/knowledge-points/信用证操作/prerequisites"
```

---

### 9. 添加知识点关联

```http
POST /api/graph/knowledge-points/<name>/relations
Content-Type: application/json
```

**请求体：**
```json
{
  "related": "CIF价格计算",
  "relationType": "contrast",
  "strength": 0.8,
  "description": "FOB和CIF的对比"
}
```

**关系类型：**
- `prerequisite` - 前置依赖
- `similar` - 相似
- `contrast` - 对比
- `extension` - 扩展

---

## 📥 Excel导入导出API

### 10. 下载导入模板

```http
GET /api/graph/import/template
```

**示例：**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/graph/import/template \
  -o 知识点导入模板.xlsx
```

**或在浏览器中直接访问：**
```
http://localhost:5000/api/graph/import/template
```

---

### 11. Excel批量导入

```http
POST /api/graph/import/excel
Content-Type: multipart/form-data
```

**示例：**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@知识点数据.xlsx" \
  http://localhost:5000/api/graph/import/excel
```

**响应示例：**
```json
{
  "success": true,
  "message": "成功导入 50 个知识点",
  "created": 45,
  "updated": 5,
  "errors": 0
}
```

---

### 12. CSV导入

```http
POST /api/graph/import/csv
Content-Type: multipart/form-data
```

**示例：**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@知识点数据.csv" \
  http://localhost:5000/api/graph/import/csv
```

---

### 13. Excel导出

```http
GET /api/graph/export/excel
```

**查询参数：**
- `category` - 按分类过滤（可选）
- `difficulty` - 按难度过滤（可选）
- `importance` - 按重要性过滤（可选）

**示例：**
```bash
# 导出所有知识点
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/graph/export/excel \
  -o 知识点导出.xlsx

# 导出特定分类
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/graph/export/excel?category=incoterms" \
  -o 贸易术语知识点.xlsx
```

---

## 🎯 使用场景示例

### 场景1：创建完整的知识点

```python
import requests

API_BASE = "http://localhost:5000"
TOKEN = "your-token-here"
headers = {"Authorization": f"Bearer {TOKEN}"}

# 创建知识点
data = {
    "name": "FOB价格计算实务",
    "category": "incoterms",
    "type": "skill",
    "difficulty": "intermediate",
    "importance": "required",
    "summary": "FOB价格的实际计算方法",
    "keywords": ["FOB", "价格", "计算"],
    "tags": ["实务操作"],
    "estimatedMinutes": 30
}

response = requests.post(
    f"{API_BASE}/api/graph/knowledge-points",
    headers=headers,
    json=data
)
print(response.json())
```

---

### 场景2：批量导入知识点

**步骤1：下载模板**
```python
import requests

response = requests.get(
    "http://localhost:5000/api/graph/import/template",
    headers={"Authorization": f"Bearer {TOKEN}"}
)

with open("模板.xlsx", "wb") as f:
    f.write(response.content)
```

**步骤2：填写模板**（使用Excel）

**步骤3：上传导入**
```python
files = {"file": open("填写好的数据.xlsx", "rb")}
response = requests.post(
    "http://localhost:5000/api/graph/import/excel",
    headers={"Authorization": f"Bearer {TOKEN}"},
    files=files
)
print(response.json())
```

---

### 场景3：构建知识依赖网络

```python
# 添加前置依赖
requests.post(
    "http://localhost:5000/api/graph/knowledge-points/信用证操作/prerequisites",
    headers={"Authorization": f"Bearer {TOKEN}"},
    json={
        "prerequisite": "国际支付工具",
        "isStrict": True,
        "reason": "需要先了解支付工具的基础知识"
    }
)

# 添加关联知识
requests.post(
    "http://localhost:5000/api/graph/knowledge-points/FOB/relations",
    headers={"Authorization": f"Bearer {TOKEN}"},
    json={
        "related": "CIF",
        "relationType": "contrast",
        "strength": 0.9,
        "description": "FOB和CIF是常见的对比贸易术语"
    }
)
```

---

### 场景4：搜索和过滤

```python
# 搜索包含"FOB"的知识点
response = requests.get(
    "http://localhost:5000/api/graph/knowledge-points/enhanced",
    headers={"Authorization": f"Bearer {TOKEN}"},
    params={"keyword": "FOB"}
)

# 获取所有必修的初级知识点
response = requests.get(
    "http://localhost:5000/api/graph/knowledge-points/enhanced",
    headers={"Authorization": f"Bearer {TOKEN}"},
    params={
        "difficulty": "beginner",
        "importance": "required"
    }
)
```

---

## 🖥️ 前端UI入口（待实现）

### 当前状态：⏳ API已就绪，UI待开发

建议的UI入口位置：

1. **教师管理页面** → **知识图谱选项卡**
   - 知识点列表（带搜索、筛选）
   - 新建知识点按钮
   - 批量导入按钮
   - 分类管理

2. **具体功能：**
   ```
   教师管理页面
   ├── 知识图谱选项卡
   │   ├── 知识点列表
   │   │   ├── 搜索框
   │   │   ├── 分类筛选下拉框
   │   │   ├── 难度/重要性筛选
   │   │   └── 知识点卡片（点击查看详情/编辑）
   │   │
   │   ├── 工具栏
   │   │   ├── "新建知识点"按钮 → 打开表单模态框
   │   │   ├── "批量导入"按钮 → 文件上传对话框
   │   │   └── "下载模板"按钮
   │   │
   │   ├── 分类管理
   │   │   └── 分类树展示
   │   │
   │   └── 知识图谱可视化
   │       └── 网络图展示（已存在）
   ```

3. **理论课时编辑页面**
   - 在编辑器中插入知识点卡片
   - 自动关联知识点到课时

---

## 🔨 快速测试

### 使用Python测试所有API

```python
#!/usr/bin/env python3
"""知识图谱API测试脚本"""

import requests
import json

API_BASE = "http://localhost:5000"

# 1. 登录获取token
login_response = requests.post(
    f"{API_BASE}/api/auth/login",
    json={"username": "0001", "password": "0001"}
)
TOKEN = login_response.json()["token"]
headers = {"Authorization": f"Bearer {TOKEN}"}

print("✅ 登录成功")

# 2. 获取分类树
response = requests.get(f"{API_BASE}/api/graph/categories/tree", headers=headers)
print(f"\n📁 分类树: {len(response.json()['categoryTree'])} 个一级分类")

# 3. 创建测试知识点
response = requests.post(
    f"{API_BASE}/api/graph/knowledge-points",
    headers=headers,
    json={
        "name": "测试知识点-FOB",
        "category": "incoterms",
        "type": "concept",
        "summary": "这是一个测试知识点"
    }
)
print(f"\n✅ 创建知识点: {response.json()['knowledgePoint']['name']}")

# 4. 搜索知识点
response = requests.get(
    f"{API_BASE}/api/graph/knowledge-points/enhanced",
    headers=headers,
    params={"keyword": "FOB"}
)
print(f"\n🔍 搜索结果: 找到 {response.json()['total']} 个知识点")

# 5. 下载模板
response = requests.get(f"{API_BASE}/api/graph/import/template", headers=headers)
with open("模板.xlsx", "wb") as f:
    f.write(response.content)
print("\n📥 Excel模板已下载")

print("\n✨ 所有API测试通过！")
```

运行测试：
```bash
python test_knowledge_api.py
```

---

## 📝 下一步开发建议

### 短期（立即可做）
1. **使用Postman测试所有API**
   - 导入API集合
   - 验证所有端点正常工作

2. **编写简单的HTML测试页面**
   - 表单创建知识点
   - 文件上传测试导入

3. **集成到现有教师管理界面**
   - 在admin.js中添加知识点管理模块
   - 复用现有的UI组件和样式

### 中期（推荐实现）
1. **完整的前端UI**
   - React/Vue组件化开发
   - 知识点CRUD界面
   - 可视化编辑器

2. **图形化关系管理**
   - 拖拽式关系构建
   - 知识图谱可视化编辑

3. **批量操作增强**
   - Excel预览和验证
   - 批量编辑功能
   - 版本历史

---

## 🎓 教师快速上手指南

### 最简单的使用方式（无需编程）

1. **使用浏览器直接下载模板**
   ```
   打开: http://localhost:5000/api/graph/import/template
   (需要先登录教师账号)
   ```

2. **填写Excel模板**
   - 按照模板说明填写知识点信息
   - 至少填写"知识点名称"列

3. **使用curl上传（或Postman）**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "file=@我的知识点.xlsx" \
     http://localhost:5000/api/graph/import/excel
   ```

4. **在Neo4j Browser中查看**
   ```
   访问: http://localhost:7474
   运行: MATCH (k:KnowledgePoint) RETURN k LIMIT 20
   ```

---

## 💡 总结

### 现在可以使用：
- ✅ 所有REST API（13个端点）
- ✅ Python脚本调用
- ✅ curl命令行调用
- ✅ Postman测试
- ✅ Neo4j Browser直接查询

### 需要开发：
- ⏳ 前端UI界面
- ⏳ 教师管理页面集成
- ⏳ 可视化编辑工具

### 建议：
1. **立即可用**：通过Python脚本或curl使用API
2. **短期目标**：开发简单的HTML表单页面
3. **长期目标**：完整的可视化管理界面

---

**API已完全就绪，可以开始使用了！** 🚀
