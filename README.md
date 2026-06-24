# AI Smart Foreign Trade Negotiation Assistant (Beta 3)

**AI智能外贸谈判助手** - 面向职业院校与高校外贸英语教学的智能训练平台

基于Flask + DeepSeek + Neo4j + DashScope技术栈，为教师和学生提供沉浸式的外贸谈判实战训练、语义网络知识图谱与智能语音交互能力。

---

## Beta 3 核心功能

### 沉浸式关卡式训练
- **10章关卡地图** - 询盘、报盘、还盘、签约、备货、报检报关、装运、保险、结汇、纠纷处理
- **3档难度系统** - balanced（标准）、challenging（挑战）、realistic（真实场景）
- **AI场景生成** - DeepSeek自动生成多样化谈判情境
- **实时AI对手** - 模拟真实外贸伙伴，支持流式对话
- **智能评估** - 自动打分并提供改进建议，支持SSE流式反馈

### 实战练习界面（Beta 3 新增）
- **Review Mode（单证审查模式）** - 模拟真实单证审核流程
- **界面重塑** - 接近真实阿里外贸软件体验
- **即时评估** - 评分与建议分离，实时展示评估结果
- **知识点匹配** - 理论实践与知识图谱实时关联

### 语义网络知识图谱（Beta 3 核心升级）
- **DAG风格架构** - 有向无环图结构，支持复杂知识依赖
- **心理语言学概念** - 引入语义网络、同族/同类/搭配关系
- **新增节点类型**：
  - `SemanticClass` - 语义类别节点
  - `Slot` - 槽位节点，支持上下文替换
- **新增关系类型**：
  - `IN_CLASS` - 语义类别归属
  - `FITS_SLOT` - 槽位匹配关系
- **知识点预计算** - 教师上传理论内容后自动预匹配，避免运行时负载
- **Neo4j本地部署** - Docker一键启动，<10ms延迟

### "词汇网"功能（Beta 3 新增）
- **语气替换** - 提供更柔和/更强硬/中性的表达替代
- **思政元素** - Win-Win、诚信、尊严、合规导向建议
- **地道性替换** - 更自然的本地化表达推荐
- **上下文锚点** - 基于相关知识点的精准建议
- **向量召回+图谱融合** - 多路召回，按得分排序

### 语音交互系统（Beta 3 新增）
- **语音输入（ASR）**
  - 实时语音转写，支持流式识别
  - WebSocket持续监听模式
  - PCM格式处理优化
  - DashScope语音识别集成
- **语音合成（TTS）**
  - 文本转语音功能
  - 多种音色选择（Ryan、Cherry、Jennifer等）
  - 24kHz高质量音频输出
  - 流式音频合成
- **语音通话模式**
  - 手动发送按钮，优化用户控制
  - 拖动操作支持
  - 挂断功能
  - 语音录制逻辑优化

### AI辅助功能（Beta 3 新增）
- **邮件助手** - `/api/ai/email/assist`
  - 生成邮件草稿
  - 润色现有邮件
  - 基于场景上下文的智能建议
- **聊天Copilot** - `/api/ai/chat/copilot`
  - 实时聊天建议
  - 流式响应输出
  - 谈判策略推荐

### 知识点召回增强（Beta 3 优化）
- **快速本地检索** - 优化知识点匹配速度
- **多模型嵌入缓存** - 支持模型热切换，避免冲突
- **召回限制优化** - 默认召回5条高相关知识点
- **来源区分** - 前端标识AI识别 vs 关键字识别
- **Reranker服务** - 结果重排序提升准确性

### 教师工作台（Beta 3 增强）
- **学生分析增强**
  - 知识标签标准化处理
  - 学生状态判定系统
  - 学习进度颜色标识
  - 学生列表筛选、排序与搜索
- **数据可视化**
  - 学习趋势图表（每周表现变化）
  - 行为热点渲染
  - 知识薄弱点详情视图
- **场景蓝图编辑** - 自定义关卡参数
- **理论课时编辑** - 富文本+知识点关联

### 学生成长中心
- **谈判会话存档** - 保存对话历史与评估
- **知识点讲解** - 个性化解释
- **学习档案** - 能力雷达图、成长曲线
- **即时反馈面板** - 分数先行显示

---

## 技术架构

### 后端
```
Python 3.8+  Flask  SQLite  Neo4j 5.15  DeepSeek API  DashScope API
sentence-transformers (嵌入模型)
```

### 前端
```
Vanilla JavaScript  Tailwind CSS  Chart.js  DOM课程地图
Vite + React (新增模板工程)
```

### 数据库
- **SQLite** (`app.db`) - 用户、会话、课时等业务数据（13张表）
- **Neo4j** (Docker) - 知识图谱（10种节点类型、15+种关系类型）

### 核心文件
```
AI-Smart-Foreign-Trade-Negotiation-Assistant/
├── app.py                      # Flask应用入口
├── database.py                 # SQLite持久层
├── levels.py                   # 10章关卡配置 + Prompt模板
├── routes/                     # 11个蓝图模块
│   ├── auth.py                 # 登录、个人信息
│   ├── admin.py                # 教师端管理 (35KB)
│   ├── scenarios.py            # 场景生成
│   ├── assignments.py          # 会话流程 + SSE评估
│   ├── assistants.py           # AI邮件/聊天辅助
│   ├── theory.py               # 理论课时
│   ├── graph.py                # 知识图谱API (13个端点)
│   ├── knowledge.py            # 知识点讲解
│   ├── asr.py                  # 语音识别 (Beta 3)
│   └── tts.py                  # 语音合成 (Beta 3)
├── services/                   # 20个业务服务
│   ├── llm_service.py          # DeepSeek API封装
│   ├── scenario_generator.py   # 场景生成引擎
│   ├── evaluation_service.py   # 会话评估 (SSE增强)
│   ├── graph_service.py        # Neo4j核心服务 (120KB)
│   ├── knowledge_service.py    # 知识点CRUD
│   ├── knowledge_importer.py   # Excel批量导入导出
│   ├── lexical_suggestion_service.py  # 词汇网服务 (Beta 3)
│   ├── embedding_service.py    # 多模型嵌入缓存 (Beta 3)
│   ├── reranker_service.py     # 结果重排序 (Beta 3)
│   ├── ai_matching.py          # DeepSeek精排知识点
│   ├── rag_matcher.py          # RAG相似度匹配
│   ├── docx_importer.py        # Word教材解析
│   └── knowledge_graph_batch_importer.py # 批量导入
├── static/
│   ├── index.html              # 单页应用 (4124行)
│   └── js/
│       ├── main.js             # 路由控制
│       ├── student.js          # 学生端功能 (193KB)
│       ├── admin.js            # 管理端功能 (275KB)
│       ├── graph-knowledge.js  # 知识图谱UI (55KB)
│       └── admin/              # 模块化脚本 (8个文件)
├── foreign-trade/              # Vite+React前端模板 (Beta 3)
└── docs/                       # 完整文档
```

---

## 快速开始

### 前置要求
- Python 3.8+
- Docker 20.10+ (用于Neo4j)
- DeepSeek API Key ([获取地址](https://platform.deepseek.com))
- DashScope API Key (用于语音功能，可选)

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

# DashScope配置（语音功能，可选）
DASHSCOPE_API_KEY=sk-xxx
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

## 主要功能演示

### 学生端：谈判训练
1. 选择章节（如"第一章 询盘"）→ 选择小节
2. 选择难度 → 点击"开始训练"
3. AI生成场景（开场邮件 + 对手信息）
4. 实时对话（支持流式输出 + 语音输入）
5. 结束会话 → 查看评估结果与改进建议

### 学生端：语音通话模式（Beta 3）
1. 开始谈判训练后，点击语音模式切换
2. 按住录音按钮进行语音输入
3. 系统实时转写并发送消息
4. AI回复可选择语音播放

### 教师端：知识图谱管理
1. 进入"知识图谱"标签页
2. **方式1：手动创建** - 填写知识点信息
3. **方式2：Excel批量导入** - 下载模板填写上传
4. **方式3：Word教材自动构建** - 上传教材自动生成草稿

### 教师端：学生分析（Beta 3）
1. 进入学生管理界面
2. 使用筛选/排序/搜索功能
3. 查看学习趋势图表
4. 分析行为热点与知识薄弱点

---

## 知识图谱Schema

### 节点类型 (10种)
```cypher
KnowledgePoint      # 知识点（25+属性）
KnowledgeCategory   # 知识分类（三级分类体系）
Stage               # 谈判阶段
Topic               # 理论主题
Practice            # 实战练习
TheoryLesson        # 理论课时
ProcessStep         # 流程步骤
Terminology         # 术语 (FOB, CIF等)
SemanticClass       # 语义类别 (Beta 3)
Slot                # 槽位节点 (Beta 3)
```

### 关系类型 (15+种)
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
IN_CLASS            # 语义类别归属 (Beta 3)
FITS_SLOT           # 槽位匹配 (Beta 3)
RELATED_TO          # 同族/同类/搭配 (Beta 3)
```

### 典型查询示例
```cypher
// 查找知识点的学习路径
MATCH path = (k:KnowledgePoint {name: '信用证操作'})<-[:REQUIRES*]-(pre)
RETURN path ORDER BY length(path);

// 按语义类别查找同类词汇
MATCH (k:KnowledgePoint)-[:IN_CLASS]->(c:SemanticClass {name: '价格术语'})
RETURN k.name, k.difficulty;

// 查找槽位替换建议
MATCH (k:KnowledgePoint)-[:FITS_SLOT]->(s:Slot {type: 'tone'})
RETURN k.name, s.suggestion;
```

---

## API接口示例

### 知识点管理API (13个端点)
```bash
GET  /api/graph/knowledge-points/enhanced   # 列表查询
POST /api/graph/knowledge-points            # 创建
PUT  /api/graph/knowledge-points/<name>     # 更新
DELETE /api/graph/knowledge-points/<name>   # 删除
```

### 词汇建议API (Beta 3)
```bash
POST /api/graph/lexical-suggestions
{
  "text": "请给我报价",
  "context_anchors": ["询盘", "价格谈判"],
  "suggestion_types": ["tone", "civics", "idiomatic"]
}
```

### 语音API (Beta 3)
```bash
# 语音识别
POST /api/asr/transcribe    # 文件上传转写
WS   /api/asr/stream        # WebSocket流式识别

# 语音合成
POST /api/tts/synthesize
{
  "text": "Hello, thank you for your inquiry.",
  "voice": "Ryan"
}
```

### AI辅助API (Beta 3)
```bash
# 邮件助手
POST /api/ai/email/assist
{
  "action": "draft",  # draft/polish
  "context": "询盘回复",
  "content": "..."
}

# 聊天Copilot
POST /api/ai/chat/copilot
{
  "session_id": "xxx",
  "message": "对方要求降价10%",
  "stream": true
}
```

---

## 系统对比 (Beta 2 → Beta 3)

| 功能 | Beta 2 | Beta 3 |
|------|--------|--------|
| 知识图谱架构 | 普通图结构 | DAG风格 + 语义网络 |
| 节点类型 | 8种 | 10种 (新增SemanticClass, Slot) |
| 关系类型 | 12种 | 15+种 (新增IN_CLASS, FITS_SLOT等) |
| 语音交互 | 无 | ASR + TTS + 语音通话 |
| 词汇建议 | 无 | 词汇网（语气/思政/地道性） |
| AI辅助 | 无 | 邮件助手 + 聊天Copilot |
| 实战界面 | 基础 | 接近真实阿里外贸软件 |
| 知识点匹配 | 运行时计算 | 预计算 + 快速检索 |
| 嵌入模型 | 单一 | 多模型缓存 |
| 学生分析 | 基础 | 趋势图表 + 热点分析 |

---

## 重要文档

| 文档 | 说明 |
|------|------|
| [快速开始指南](QUICK_START.md) | 5分钟快速部署 |
| [Beta 3功能总结](docs/BETA3_FEATURES.md) | 完整新功能介绍 |
| [Neo4j本地部署](docs/NEO4J_LOCAL_SETUP.md) | Docker配置详解 |
| [知识图谱Schema](docs/KNOWLEDGE_GRAPH_SCHEMA.md) | 节点/关系设计 |
| [知识点管理UI使用指南](docs/知识点管理UI使用指南.md) | 教师操作手册 |
| [智能批量导入指南](docs/智能批量导入使用指南.md) | Excel批量操作 |
| [故障排查](TROUBLESHOOTING.md) | 常见问题解决 |
| [TODO](docs/TODO.md) | 未来规划 |

---

## 生产环境部署

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

    # WebSocket支持（语音功能）
    location /api/asr/stream {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
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

---

## 贡献指南

欢迎提交Issue和Pull Request：

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交Pull Request

---

## 开源协议

MIT License

---

## 致谢

**项目组成员**：
- 梁诗忻 - 程序设计与实现

**技术栈**：
- [Flask](https://flask.palletsprojects.com/) - Web框架
- [Neo4j](https://neo4j.com/) - 图数据库
- [DeepSeek](https://www.deepseek.com/) - 大语言模型
- [DashScope](https://dashscope.aliyun.com/) - 语音服务
- [sentence-transformers](https://www.sbert.net/) - 向量嵌入
- [Tailwind CSS](https://tailwindcss.com/) - UI框架

**教材参考**：
《AI赋能：智能时代的外贸谈判策略与实战》

---

## 联系方式

- GitHub Issues: [提交问题](https://github.com/liangshixin1/AI-Smart-Foreign-Trade-Negotiation-Assistant/issues)
- 项目地址: https://github.com/liangshixin1/AI-Smart-Foreign-Trade-Negotiation-Assistant

---

**2025 AI赋能：智能时代的外贸谈判策略与实战 项目组**
