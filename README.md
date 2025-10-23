# AI Smart Foreign Trade Negotiation Assistant

面向职业院校与高校外贸英语教学场景的智能谈判训练平台。系统结合 Flask 后端、SQLite 持久层与 DeepSeek 大语言模型，为教师与学生提供沉浸式的谈判任务、实时 AI 对手、自动化评估与教学分析能力。

## 核心功能

- **沉浸式关卡式训练**：内置章节—小节层级的情境地图，学生可按需选择行业场景与难度，快速开启外贸谈判模拟。
- **多模型协同生成**：分别配置场景生成、协作对话与评估批改的 DeepSeek Key，保证情境多样性、对话流畅度和学习反馈的专业性。
- **教师工作台**：支持关卡蓝图积木式编辑、统一作业布置、班级学习看板、学生画像与成绩明细查询。
- **学生成长中心**：保存所有谈判会话、知识点与改进行动项，帮助学生形成可追踪的学习档案。
- **多维评价与复盘**：自动生成谈判评分、评语、改进建议、知识点提取以及讨价还价胜率等指标。
- **批量账号导入**：读取 Excel 模板快速导入学生账号，默认生成安全密码，便于大规模课堂部署。

## 系统架构概览

```
Flask API (app.py)
├── 账户登录、鉴权与 Token 管理
├── 关卡/蓝图/作业 CRUD
├── DeepSeek 场景生成、对话流、评估接口
├── 教师与学生仪表板 API
└── 静态资源分发 (static/index.html)

database.py (SQLite 数据库)
├── 初始化表结构与默认账户
├── 关卡层级、蓝图、作业、会话、评估数据存取
└── 统计分析与教学指标查询

levels.py
└── 预置的章节/小节结构与 Prompt 模板

static/
├── index.html  —— 单页富界面，Tailwind CSS + Chart.js
└── main.js     —— 与 API 交互的前端逻辑
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
| `/api/start_level` | POST | 学生选择关卡后生成场景并创建会话 |
| `/api/chat` | POST | 学生与 AI 对手对话，可选流式输出 |
| `/api/admin/blueprints` | CRUD | 教师管理积木式场景蓝图 |
| `/api/admin/assignments` | CRUD | 教师布置统一作业并分配学生 |
| `/api/admin/analytics` | GET | 教师端班级洞察与能力分析 |
| `/api/sessions` | GET | 获取个人历史会话与评估结果 |

更多端点可参考 `app.py` 中的路由定义。

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

## 贡献指南

欢迎提交 Issue 与 Pull Request：

1. Fork 仓库并创建特性分支。
2. 遵循项目现有的代码风格，优先在局部复用已有工具函数。
3. 增补必要的单元测试或交互录屏说明。
4. 提交前请运行本地测试，确保数据库迁移与接口兼容性。

## 版权说明

© 2025 《AI赋能：智能时代的外贸谈判策略与实战》项目组。梁诗忻 程序设计 · 基于 Flask 和 AI 技术构建。
