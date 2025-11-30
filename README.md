# AI Smart Foreign Trade Negotiation Assistant (Beta 2)

**AI智能外贸谈判助手** - 面向职业院校与高校外贸英语教学的智能训练平台

基于Flask + DeepSeek + Neo4j技术栈，为教师和学生提供沉浸式的外贸谈判实战训练与知识图谱管理能力。

---

## ✨ Beta 2 核心功能

### 🎯 沉浸式关卡式训练
- **10章关卡地图** - 询盘、报盘、还盘、签约、备货、报检报关、装运、保险、结汇、纠纷处理
- **3档难度系统** - balanced（标准）、challenging（挑战）、realistic（真实场景）
- **AI场景生成** - DeepSeek自动生成多样化谈判情境
- **实时AI对手** - 模拟真实外贸伙伴，支持流式对话
- **智能评估** - 自动打分并提供改进建议

### 🧠 知识图谱管理（核心亮点）
- **Neo4j本地部署** - Docker一键启动，无云端依赖，<10ms延迟
- **完整知识点CRUD** - Web UI + 13个REST API端点
- **批量导入导出** - Excel模板，支持一次性导入100+知识点
- **关系可视化** - AntV G6图谱，支持前置依赖、关联关系
- **Beta功能**：
  - **自动构建** - 上传Word教材 → AI生成知识点草稿 → 教师审核 → 写入图谱
  - **智能匹配** - 选中课文片段 → DeepSeek精排/RAG匹配 → 自动插入知识卡

### 👨‍🏫 教师工作台
- **作业管理** - 布置作业、查看进度、批量导出成绩
- **场景蓝图编辑** - 自定义关卡参数（公司、产品、市场、风险）
- **班级分析** - Chart.js可视化学生能力分布、成长趋势
- **学生名册导入** - Excel批量导入账号
- **理论课时编辑** - 富文本编辑器，支持知识点关联
- **知识图谱管理** - 可视化界面管理25+字段的知识点

### 👨‍🎓 学生成长中心
- **谈判会话存档** - 保存所有对话历史与评估结果
- **知识点讲解** - DeepSeek生成个性化解释
- **学习档案** - 能力雷达图、成长曲线
- **练习推荐** - 基于知识图谱的个性化推荐

---

## 🏗️ 技术架构

### 后端
```
Python 3.8+  Flask  SQLite  Neo4j 5.15  DeepSeek API (OpenAI兼容)
```

### 前端
```
Vanilla JavaScript  Tailwind CSS  Chart.js  AntV G6
```

### 数据库
- **SQLite** (`app.db`) - 用户、会话、作业、课时等业务数据（13张表）
- **Neo4j** (Docker) - 知识图谱（8种节点类型、12种关系类型）

### 核心文件
```
AI-Smart-Foreign-Trade-Negotiation-Assistant/
├── app.py                      # Flask应用入口
├── database.py                 # SQLite持久层
├── levels.py                   # 10章关卡配置 + Prompt模板
├── routes/                     # 7个蓝图模块
│   ├── auth.py                 # 登录、个人信息
│   ├── scenarios.py            # 场景生成
│   ├── assignments.py          # 作业与会话流程
│   ├── admin.py                # 教师端管理
│   ├── theory.py               # 理论课时
│   ├── graph.py                # 知识图谱API (13个端点)
│   └── knowledge.py            # 知识点讲解
├── services/                   # 18个业务服务
│   ├── llm_service.py          # DeepSeek API封装
│   ├── scenario_generator.py  # 场景生成引擎
│   ├── evaluation_service.py  # 会话评估
│   ├── graph_service.py        # Neo4j核心服务 (115KB)
│   ├── knowledge_service.py    # 知识点CRUD
│   ├── knowledge_importer.py   # Excel批量导入导出
│   ├── ai_matching.py          # DeepSeek精排知识点
│   ├── rag_matcher.py          # RAG相似度匹配 (Beta)
│   ├── docx_importer.py        # Word教材解析
│   └── knowledge_job_service.py # 知识图谱构建任务
├── static/
│   ├── index.html              # 单页应用 (4124行)
│   └── js/
│       ├── main.js             # 路由控制
│       ├── student.js          # 学生端功能 (95KB)
│       ├── admin.js            # 管理端功能 (253KB)
│       ├── graph-knowledge.js  # 知识图谱UI (56KB)
│       └── admin/              # 模块化脚本 (8个文件)
└── docs/                       # 完整文档
```

---

## 🚀 快速开始

### 前置要求
- Python 3.8+
- Docker 20.10+ (用于Neo4j)
- DeepSeek API Key ([获取地址](https://platform.deepseek.com))

### 1. 克隆项目
```bash
git clone https://github.com/liangshixin1/AI-Smart-Foreign-Trade-Negotiation-Assistant.git
cd AI-Smart-Foreign-Trade-Negotiation-Assistant
```

### 2. 启动Neo4j (Docker)
```bash
docker-compose -f docker-compose.neo4j.yml up -d

# 验证启动成功（等待30秒）
curl http://localhost:7474
```

### 3. 配置环境变量
```bash
cp .env.example .env
vim .env
```

**必填配置**：
```bash
# Neo4j连接
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=foreign-trade-2024

# DeepSeek API Keys (多Key隔离不同功能)
DEEPSEEK_GENERATOR_KEY=sk-xxx    # 场景生成
DEEPSEEK_COLLAB_KEY=sk-xxx       # 对话
DEEPSEEK_CRITIC_KEY=sk-xxx       # 评估
DEEPSEEK_LECTURE_API_KEY=sk-xxx  # 讲解
DEEPSEEK_KP_API_KEY=sk-xxx       # 知识点匹配

# 或使用单个通用Key
DEEPSEEK_API_KEY=sk-xxx
```

### 4. 安装依赖
```bash
pip install -r requirements.txt
```

### 5. 启动应用
```bash
python app.py
# 访问 http://localhost:5000
```

### 6. 登录体验
| 角色 | 用户名 | 密码 |
|------|--------|------|
| 学生 | `0000` | `0000` |
| 教师 | `0001` | `0001` |

---

## 📖 主要功能演示

### 学生端：谈判训练
1. 选择章节（如"第一章 询盘"）→ 选择小节（如"1-1 产品询盘"）
2. 选择难度 → 点击"开始训练"
3. AI生成场景（开场邮件 + 对手信息）
4. 实时对话（支持流式输出）
5. 结束会话 → 查看评估结果与改进建议

### 教师端：知识图谱管理
1. 进入"知识图谱"标签页
2. **方式1：手动创建**
   - 点击"新增" → 填写知识点信息（名称、分类、难度等）
   - 添加前置依赖和关联关系 → 保存
3. **方式2：Excel批量导入**
   - 下载模板 → 填写100+知识点 → 上传导入
   - 系统显示导入统计（创建/更新/失败数量）
4. **方式3：Word教材自动构建 (Beta)**
   - 上传教材DOCX → AI生成知识点草稿
   - 教师勾选审核通过 → 批量写入Neo4j

### 教师端：作业管理
1. 进入"作业管理"标签页
2. 点击"布置作业" → 选择章节、难度、截止时间
3. 选择学生名单 → 发布
4. 查看学生完成进度 → 导出成绩Excel

---

## 🧩 知识图谱Schema

### 节点类型 (8种)
```cypher
KnowledgePoint      # 知识点（25+属性：name, category, difficulty, tags等）
KnowledgeCategory   # 知识分类（三级分类体系）
Stage               # 谈判阶段（询盘、报盘、还盘等）
Topic               # 理论主题
Practice            # 实战练习
TheoryLesson        # 理论课时
ProcessStep         # 流程步骤
Terminology         # 术语 (FOB, CIF等)
```

### 关系类型 (12种)
```cypher
REQUIRES            # 前置依赖 (strict: true/false)
RELATES_TO          # 关联 (prerequisite/similar/contrast/extension)
BELONGS_TO          # 属于分类
PARENT_OF           # 分类层级
APPLIES_TO          # 应用到流程
COVERS_PROCESS      # 覆盖流程
HAS_PRACTICE        # 包含练习
HAS_TOPIC           # 包含主题
HAS_LESSON          # 包含课时
TESTS               # 考察知识点
EXPLAINS            # 解释知识点
NEXT_STEP           # 流程顺序
```

### 典型查询示例
```cypher
// 查找知识点的学习路径
MATCH path = (k:KnowledgePoint {name: '信用证操作'})<-[:REQUIRES*]-(pre)
RETURN path ORDER BY length(path);

// 按分类浏览知识点
MATCH (k:KnowledgePoint)-[:BELONGS_TO]->(c:KnowledgeCategory {id: 'incoterms'})
RETURN k.name, k.difficulty, k.importance;

// 查看谈判流程骨架
MATCH (s:Stage)-[:NEXT_STEP]->(next:Stage)
RETURN s.name, next.name;
```

---

## 🔌 API接口示例

### 知识点管理API (13个端点)
```bash
# 获取知识点列表（支持过滤）
GET /api/graph/knowledge-points/enhanced?category=贸易术语&difficulty=beginner

# 创建知识点
POST /api/graph/knowledge-points
Content-Type: application/json
{
  "name": "FOB价格计算",
  "category": "贸易术语",
  "difficulty": "beginner",
  "importance": "required",
  "summary": "FOB价格的构成及计算方法",
  "tags": ["FOB", "价格", "计算"]
}

# 更新知识点
PUT /api/graph/knowledge-points/FOB价格计算

# 删除知识点
DELETE /api/graph/knowledge-points/FOB价格计算

# 添加前置依赖
POST /api/graph/knowledge-points/信用证操作/prerequisites
{"prerequisite_name": "国际支付工具", "is_strict": true}

# Excel导入导出
GET  /api/graph/import/template      # 下载模板
POST /api/graph/import/excel         # 导入
GET  /api/graph/export/excel         # 导出
```

### 场景生成API
```bash
POST /api/generator/scenario
{
  "chapter_id": "chapter-1",
  "section_id": "section-1-1",
  "difficulty": "balanced",
  "custom_params": {
    "student_company": "XX进出口公司",
    "target_product": "儿童玩具"
  }
}
```

### 聊天API
```bash
POST /api/chat
{
  "session_id": "session-xxx",
  "message": "Hello, I'm interested in your toy products.",
  "stream": true  # 流式输出
}
```

完整API文档请查看 `routes/` 目录下的蓝图定义。

---

## 📊 系统对比 (Beta 1 → Beta 2)

| 功能 | Beta 1 | Beta 2 |
|------|--------|--------|
| 知识图谱部署 | Neo4j Aura云端（不稳定） | Docker本地部署（<10ms） |
| 知识点属性 | 1个 (name) | 25+ 个 |
| 知识图谱可视化 | ECharts | AntV G6 |
| 知识点管理 | 无UI | 完整Web UI + 13个API |
| 批量导入 | 无 | Excel/CSV批量导入 |
| 自动构建图谱 | 无 | ✅ Word教材自动解析 (Beta) |
| 智能匹配 | 无 | ✅ DeepSeek精排 + RAG (Beta) |
| 关系类型 | 7种 | 12种 |
| 节点类型 | 5种 | 8种 |
| 前端模块化 | 单文件 | 8个模块化脚本 |

---

## 📁 重要文档

| 文档 | 说明 |
|------|------|
| [快速开始指南](QUICK_START.md) | 5分钟快速部署 |
| [Neo4j本地部署](docs/NEO4J_LOCAL_SETUP.md) | Docker配置详解 |
| [知识图谱Schema](docs/KNOWLEDGE_GRAPH_SCHEMA.md) | 节点/关系设计 |
| [知识点管理UI使用指南](docs/知识点管理UI使用指南.md) | 教师操作手册 |
| [智能批量导入指南](docs/智能批量导入使用指南.md) | Excel批量操作 |
| [故障排查](TROUBLESHOOTING.md) | 常见问题解决 |
| [TODO](docs/TODO.md) | 未来规划 |

---

## 🛠️ 生产环境部署

### 1. 使用Gunicorn
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 2. Nginx反向代理
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 禁止访问敏感文件
    location ~ /\. {
        deny all;
    }
    location ~ \.env$ {
        deny all;
    }
}
```

### 3. 数据备份
```bash
# SQLite备份
cp app.db backups/app-$(date +%Y%m%d).db

# Neo4j备份
docker exec foreign-trade-neo4j neo4j-admin database dump neo4j \
  --to-path=/data/backups/backup-$(date +%Y%m%d).dump
```

### 4. 安全加固
- 修改默认账号密码（0000/0001）
- 修改Neo4j默认密码
- 启用HTTPS
- 限制Neo4j远程访问（127.0.0.1:7687）
- 定期更新依赖包

---

## 🔧 故障排查

### 问题1：Neo4j连接失败
```bash
# 检查Neo4j是否运行
docker ps | grep neo4j

# 查看日志
docker-compose -f docker-compose.neo4j.yml logs neo4j

# 重启Neo4j
docker-compose -f docker-compose.neo4j.yml restart
```

### 问题2：DeepSeek API调用失败
- 检查API Key是否正确
- 检查账户余额
- 检查网络连接
- 查看后端日志：`tail -f app.log`

### 问题3：理论内容无法创建（401错误）
详见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 🤝 贡献指南

欢迎提交Issue和Pull Request：

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交Pull Request

**代码规范**：
- 遵循现有代码风格
- 添加必要的注释
- 更新相关文档

---

## 📜 开源协议

MIT License

---

## 👥 致谢

**项目组成员**：
- 梁诗忻 - 程序设计与实现

**技术栈**：
- [Flask](https://flask.palletsprojects.com/) - Web框架
- [Neo4j](https://neo4j.com/) - 图数据库
- [DeepSeek](https://www.deepseek.com/) - 大语言模型
- [AntV G6](https://g6.antv.antgroup.com/) - 图可视化
- [Tailwind CSS](https://tailwindcss.com/) - UI框架

**教材参考**：
《AI赋能：智能时代的外贸谈判策略与实战》

---

## 📞 联系方式

- GitHub Issues: [提交问题](https://github.com/liangshixin1/AI-Smart-Foreign-Trade-Negotiation-Assistant/issues)
- 项目地址: https://github.com/liangshixin1/AI-Smart-Foreign-Trade-Negotiation-Assistant

---

**© 2025 AI赋能：智能时代的外贸谈判策略与实战 项目组**
