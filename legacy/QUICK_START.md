# 快速开始指南

## 🎯 概述

这是一个基于本地Neo4j知识图谱的外贸谈判智能教学系统。本指南将帮助你在5分钟内完成环境配置。

## ✅ 前置要求

- **Docker** 20.10+ ([安装指南](https://docs.docker.com/get-docker/))
- **Python** 3.8+
- **2GB+** 可用内存
- **OpenAI API Key** (或兼容的API服务)

## 🚀 快速开始（推荐）

### 方式1：一键脚本（Linux/Mac）

```bash
# 1. 进入项目目录
cd AI-Smart-Foreign-Trade-Negotiation-Assistant

# 2. 运行一键配置脚本
./scripts/setup_neo4j.sh

# 3. 编辑.env文件，填入你的API Key
vim .env
# 修改: OPENAI_API_KEY=your-api-key-here

# 4. 安装Python依赖
pip install -r requirements.txt

# 5. 启动应用
python app.py
```

### 方式2：手动配置

#### Step 1: 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件
vim .env
```

确保以下配置正确：
```bash
# Neo4j配置
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=CHANGE_ME

# OpenAI配置
OPENAI_API_KEY=your-api-key-here
```

#### Step 2: 启动Neo4j

```bash
# 启动Neo4j（后台运行）
docker-compose -f docker-compose.neo4j.yml up -d

# 查看日志，等待启动完成
docker-compose -f docker-compose.neo4j.yml logs -f neo4j
# 看到 "Started." 表示启动成功，按 Ctrl+C 退出日志查看
```

#### Step 3: 运行数据库迁移（可选但推荐）

```bash
# 安装Python依赖
pip install -r requirements.txt

# 运行迁移脚本
python migrations/001_enhance_knowledge_graph.py
```

#### Step 4: 启动应用

```bash
# 启动Flask应用
python app.py
```

## ✨ 访问系统

### 应用主页
- **URL**: http://localhost:5000
- **学生账号**: 0000 / 0000
- **教师账号**: 0001 / 0001

### Neo4j Browser
- **URL**: http://localhost:7474
- **用户名**: neo4j
- **密码**: 使用 `.env` 中自行设置的强密码

## 📚 核心功能

### 1. 知识图谱可视化
访问教师端 → 知识图谱选项卡，查看知识网络结构

### 2. 批量导入知识点

#### 下载模板
```python
# 在Python中生成模板
from services.knowledge_importer import generate_excel_template

template = generate_excel_template()
with open("知识点导入模板.xlsx", "wb") as f:
    f.write(template)
```

#### 填写模板
| 知识点名称* | 分类ID | 类型 | 难度 | 重要性 | 简介 |
|------------|--------|------|------|--------|------|
| FOB成本构成 | incoterms | concept | beginner | required | FOB价格的组成部分及计算方法 |

#### 导入数据
访问教师端 → 知识图谱 → 批量导入 → 选择Excel文件

### 3. 知识点分类管理

查看默认分类体系：
```cypher
// 在Neo4j Browser中运行
MATCH (c:KnowledgeCategory)
RETURN c.name, c.level, c.orderIndex
ORDER BY c.level, c.orderIndex
```

### 4. 知识点查询

```cypher
// 查看所有知识点
MATCH (k:KnowledgePoint)
RETURN k.name, k.category, k.difficulty, k.importance
LIMIT 20

// 按分类浏览
MATCH (k:KnowledgePoint)-[:BELONGS_TO]->(c:KnowledgeCategory {id: 'incoterms'})
RETURN k.name, k.summary
```

## 🛠️ 常用操作

### 查看系统状态

```bash
# 检查Docker容器
docker ps | grep neo4j

# 查看Neo4j日志
docker-compose -f docker-compose.neo4j.yml logs -f neo4j

# 检查应用健康
curl http://localhost:5000/api/health
```

### 管理Neo4j服务

```bash
# 停止服务
docker-compose -f docker-compose.neo4j.yml stop

# 启动服务
docker-compose -f docker-compose.neo4j.yml start

# 重启服务
docker-compose -f docker-compose.neo4j.yml restart

# 完全移除（包括数据）
docker-compose -f docker-compose.neo4j.yml down -v
```

### 数据备份与恢复

```bash
# 备份
docker exec foreign-trade-neo4j neo4j-admin database dump neo4j \
  --to-path=/data/backups

# 恢复
docker exec foreign-trade-neo4j neo4j-admin database load neo4j \
  --from-path=/data/backups
```

## 🔧 故障排查

### 问题1：端口被占用
```bash
# 查找占用进程
lsof -i :7474
lsof -i :7687

# 修改端口（编辑docker-compose.neo4j.yml）
ports:
  - "17474:7474"
  - "17687:7687"
```

### 问题2：应用无法连接Neo4j
```bash
# 1. 检查Neo4j是否运行
docker ps | grep neo4j

# 2. 检查.env配置
cat .env | grep NEO4J

# 3. 测试连接
curl http://localhost:7474
```

### 问题3：迁移失败
```bash
# 1. 确认Neo4j已启动
docker-compose -f docker-compose.neo4j.yml ps

# 2. 检查Python依赖
pip install neo4j

# 3. 重新运行迁移
python migrations/001_enhance_knowledge_graph.py
```

### 问题4：内存不足
```bash
# 减小Neo4j内存配置（编辑docker-compose.neo4j.yml）
environment:
  - NEO4J_server_memory_heap_max__size=512m
  - NEO4J_server_memory_pagecache_size=256m

# 重启服务
docker-compose -f docker-compose.neo4j.yml restart
```

## 📖 详细文档

- [本地Neo4j部署指南](docs/NEO4J_LOCAL_SETUP.md)
- [知识图谱Schema设计](docs/KNOWLEDGE_GRAPH_SCHEMA.md)
- [故障排查文档](TROUBLESHOOTING.md)

## 🎓 教师使用指南

### 创建知识点

1. 登录教师账号（0001/0001）
2. 进入"知识图谱"选项卡
3. 点击"新建知识点"
4. 填写表单：
   - 名称：必填，如"FOB成本构成"
   - 分类：选择分类或留空
   - 类型：concept/skill/document等
   - 难度：beginner/intermediate/advanced
   - 重要性：required/recommended/optional
   - 简介：一句话描述
5. 保存

### 批量导入

1. 下载Excel模板（教师端 → 批量导入 → 下载模板）
2. 填写知识点数据
3. 上传文件
4. 查看导入结果

### 构建知识网络

1. 在知识点详情页面
2. 点击"添加前置依赖"
3. 选择前置知识点
4. 保存

### 查看知识图谱

1. 进入"知识图谱"选项卡
2. 点击"可视化"
3. 选择过滤条件（分类、难度等）
4. 交互式浏览网络

## 🎯 学生使用指南

1. 登录学生账号
2. 选择章节进入学习
3. 查看相关理论内容
4. 完成实战练习
5. 查看评估报告
6. 查看学习路径推荐

## 🤝 贡献与反馈

- **Issues**: https://github.com/liangshixin1/AI-Smart-Foreign-Trade-Negotiation-Assistant/issues
- **文档**: 项目根目录的 docs/ 文件夹

## 📝 更新日志

### v2.0 - 2024 知识图谱增强版

- ✨ 完全本地化Neo4j部署
- ✨ 增强的知识点模型（15+属性）
- ✨ 五级知识分类体系
- ✨ Excel批量导入功能
- ✨ 知识点关系管理（依赖、相关等）
- ✨ 一键配置脚本
- ✨ 完整的文档和示例

## 📄 许可证

MIT License

---

**祝你使用愉快！如有问题，请查看详细文档或提交Issue。**
