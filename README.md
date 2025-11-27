# AI Smart Foreign Trade Negotiation Assistant

面向职业院校与高校外贸英语教学场景的智能谈判训练平台。系统结合 Flask 后端、SQLite 持久层与 DeepSeek 大语言模型，为教师与学生提供沉浸式的谈判任务、实时 AI 对手、自动化评估与教学分析能力。

## 核心功能

- **沉浸式关卡式训练**：章节—小节情境地图，学生按需选择行业场景与难度，开启外贸谈判模拟。
- **多模型协同生成**：分别配置场景生成、协作对话与评估批改的 DeepSeek Key，保证情境多样性、对话流畅度和学习反馈的专业性。
- **教师工作台**：关卡蓝图编辑、作业布置、班级看板、学生画像与成绩明细查询。
- **学生成长中心**：保存谈判会话、知识点与改进行动项，帮助学生形成可追踪的学习档案。
- **知识图谱管理**：Neo4j 驱动的知识点节点/关系维护；支持批量导入 Excel、拖拽分类、图谱可视化。
- **自动构建知识图谱 (Beta)**：上传教材 Word，一键生成草稿知识点，教师审核后写入图谱；后续可接入向量检索/异步任务。
- **智能知识点匹配 (Beta)**：DeepSeek 精排或 RAG(Beta) 匹配，将选中文本自动关联到知识点并插入知识卡。

## 系统架构概览

```
app.py                —— 应用工厂与蓝图注册
routes/
├── auth.py           —— 登录、个人信息维护接口
├── scenarios.py      —— 关卡层级、场景蓝图、AI 场景生成
├── assignments.py    —— 作业布置、会话流程、聊天与评估
└── admin.py          —— 学生名册导入、班级分析、关卡配置

services/
├── auth_service.py           —— 鉴权装饰器与当前用户上下文
├── scenario_generator.py     —— 难度画像、Prompt 渲染、AI 生成
├── document_composer.py      —— 开场邮件/合同片段生成
├── evaluation_service.py     —— 会话表现评估与结果入库
├── llm_service.py            —— DeepSeek OpenAI 接口封装
├── ai_matching.py            —— DeepSeek 精排知识点匹配
├── rag_matcher.py            —— 轻量 RAG/相似度匹配（Beta）
├── knowledge_generation.py   —— LLM 知识点草稿生成（Beta）
└── knowledge_job_service.py  —— 知识图谱构建任务与草稿持久化

utils/
├── normalizers.py    —— 文本、公司、产品等清洗工具
└── validators.py     —— 布尔转换、JSON 抽取、环境变量校验

database.py           —— SQLite 持久层封装
levels.py             —— 预置章节小节模板
static/               —— 前端单页应用与静态资源
docs/TODO.md          —— 待办清单
```

## 快速开始

### 1. 克隆与环境准备

```bash
python -m venv .venv
source .venv/bin/activate  # Windows 使用 .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 配置环境变量

项目依赖 DeepSeek OpenAI 兼容 API，需分别配置以下 Key：

| 变量名 | 用途 |
| --- | --- |
| `DEEPSEEK_GENERATOR_KEY` | 章节/小节情境生成 |
| `DEEPSEEK_COLLAB_KEY` | 学生实时对话 AI 对手 |
| `DEEPSEEK_CRITIC_KEY` | 会话结束后的评估打分 |

可在项目根目录创建 `.env` 文件，示例：

```
DEEPSEEK_GENERATOR_KEY=sk-xxxxxxxx
DEEPSEEK_COLLAB_KEY=sk-yyyyyyyy
DEEPSEEK_CRITIC_KEY=sk-zzzzzzzz
```

启动时 `.env` 会被自动读取；缺失必需 Key 时，对应功能会返回提示错误。

#### 知识图谱（Neo4j）配置

知识图谱相关功能默认可选；若未配置 Neo4j，学生端的“相关练习/推荐课时”会自动回退为空列表。要启用完整体验，请：

1. 安装并启动 Neo4j 5.x 服务，或使用 Docker 快速体验：

   ```bash
   docker run -it --rm \
     -p7474:7474 -p7687:7687 \
     -e NEO4J_AUTH=neo4j/testpass \
     neo4j:5
   ```

2. 在 `.env` 中补充以下变量，指向可连接的 Bolt 地址与认证：

   ```
   NEO4J_URI=bolt://127.0.0.1:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=testpass
   ```

3. 首次启动 Flask 应用时会自动创建唯一约束并导入章节/理论课时等静态数据。若连接失败，可查看控制台日志，系统会临时禁用图谱查询并退回 SQLite 结果。

### 3. 初始化数据库

首次运行会在项目目录生成 `app.db`，并写入默认账户与预置章节。如果需要自定义路径，可设置环境变量 `DATABASE_PATH`。

### 4. 启动应用

```bash
python app.py
```

默认在 `http://127.0.0.1:5000/` 提供界面与 API。部署生产环境时建议使用 `gunicorn` 等 WSGI 服务器并配置反向代理。

## 默认账号

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 学生 | `0000` | `0000` |
| 教师 | `0001` | `0001` |

登录后可在「修改密码」中更新个人密码。教师端可批量导入学生账号或手动创建。

## 主要 API 一览

| 路由 | 方法 | 说明 |
| --- | --- | --- |
| `/api/login` | POST | 用户登录获取 Token |
| `/api/levels` | GET | 获取章节/小节层级及关卡元数据 |
| `/api/generator/scenario` | POST | 教师/学生按章节生成候选情境 |
| `/api/blueprints` | GET/POST/PUT/DELETE | 教师管理积木式场景蓝图 |
| `/api/start_level` | POST | 学生选择关卡后生成场景并创建会话 |
| `/api/assignments` | GET/POST | 教师布置作业并查看汇总 |
| `/api/student/assignments` | GET | 学生查看个人作业与状态 |
| `/api/assignments/<id>/start` | POST | 学生领取作业并进入对话 |
| `/api/chat` | POST | 学生与 AI 对手对话，可选流式输出 |
| `/api/admin/analytics` | GET | 教师端班级洞察与能力分析 |
| `/api/sessions` | GET | 获取个人历史会话与评估结果 |
| `/api/admin/students/import` | POST | Excel 导入学生账号 |

更多端点可参考 `routes/` 目录下各模块的蓝图定义。

## 前端体验亮点

- Tailwind CSS 打造的玻璃拟态界面，支持暗色调视觉。
- 学生端含任务导航、关卡地图、谈判经验区与成长档案。
- 教师端提供学生进度、作业管理、蓝图编辑、班级分析等多个仪表板。
- Chart.js 用于课堂数据与能力趋势可视化。

## 部署建议

- 使用 `pip install gunicorn` 并通过 `gunicorn app:app` 部署生产环境。
- 配合 `supervisor` 或 systemd 守护进程保证高可用。
- 将 `app.db` 存放于持久化卷或外部数据库，定期备份。
- 对公网部署时，请通过 HTTPS 代理加密流量并在前端增加访问控制（如学校 OAuth 或 SSO）。

### 常见线上故障排查

- **Nginx 日志出现 `connect() failed (111: Connection refused)`**：说明反向代理尝试转发到 `127.0.0.1:<端口>` 的后端进程但未成功。请确认 Gunicorn/Uvicorn 是否已启动、监听端口与 Nginx `proxy_pass` 配置一致，并检查防火墙或 SELinux 是否阻断了本地环回访问。
- **持续请求 `.env` 等敏感路径**：公网环境会遭遇扫描器探测。务必禁用将 `.env` 等配置文件通过 Nginx 暴露的路由，确保服务器返回 404 并限制只读权限，避免被下载到密钥。
- **上传 Excel 导入名册后无响应**：后端依赖 `openpyxl` 解析 `.xlsx`。确认部署环境的虚拟环境中已安装 `openpyxl`，并使用支持的 Excel 格式；如仍失败，请检查 Gunicorn/Flask 日志中的异常堆栈定位原因。

## 贡献指南

欢迎提交 Issue 与 Pull Request：

1. Fork 仓库并创建特性分支。
2. 遵循项目现有的代码风格，优先在局部复用已有工具函数。
3. 增补必要的单元测试或交互录屏说明。
4. 提交前请运行本地测试，确保数据库迁移与接口兼容性。

## 版权说明

© 2025 《AI赋能：智能时代的外贸谈判策略与实战》项目组。梁诗忻 程序设计 · 基于 Flask 和 AI 技术构建。
