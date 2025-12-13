# 变更摘要（相对 `main` 分支）

> 基于当前代码库与仓库 `main` 分支的差异梳理，便于快速了解近期开发内容。后续发布前可按需精简/合并。

## 后端与服务
- **评估链路重构**：我们在`services/evaluation_service.py` 引入严格 JSON 输出（`response_format=json_object`）、稳健分数解析（容忍 ```json 包裹、回退正则），本地生成评分标签，并拆分 `compute_score`/`compute_detail`/`build_evaluation_result`，支持流式与同步复用。
- **知识点匹配放宽**：我们决定去掉按关卡/场景收窄候选的逻辑，直接在全量图谱上做精确/向量匹配，避免遗漏；移除统一注入 lessonId 的行为，知识点展示更贴近全景的真实图谱，以体现出该知识点在图谱中的位置与联系。
- **SSE 流式评估**：`routes/assignments.py` 我们支持先推分数、后推详情的事件流，前端可即时显示分数，细节稍后到达。
- **LLM 适配与工具**：新增/更新 `services/llm_service.py`（透传 response_format）、`services/document_composer.py`、`services/rag_matcher.py`、`services/knowledge_graph_batch_importer.py` 等工具类，优化 RAG增强检索生成/批量导入链路。
- **新接口与模型**：新增 `routes/assistants.py`；`models/scenario.py`、`services/scenario_generator.py`、`levels.py` 补充难度/关卡配置及场景生成逻辑。

## 数据与图谱
- **图谱服务增强**：`services/graph_service.py` 补充知识点管理、批量导入、阶段（Stage）关联等能力，支持更多查询与写入场景。
- **数据库扩展**：`database.py` 增加字段/查询以支撑新评估结果和会话元数据。

## 前端与静态资源
- **学生端即时反馈**：`static/js/student.js` 适配分数/详情分离的 SSE，分数可先行显示，知识点渲染支持多字段 fallback。
- **Knowledge Peek 优化**：知识胶囊不再强绑场景首课的 lessonId，图谱展示更贴近选中知识点。
- **静态页与管理端扩展**：`static/index.html` 及 `static/js/admin*.js` 我们重塑了实战练习的UI，并设计了三套UI套件（电邮、IM、审核），并增强评估、图谱、课程关联等 UI。新增多版本静态页（`static/index 2/3.html`）和拆分的 admin/student/elements 版本。
- **新前端工程**：新增 `foreign-trade/` 目录（Vite + React 模板），含基础依赖配置、入口页面与样式。

## 其他
- 更新 `.gitignore` 并清理若干资源文件。
- 新增/调整若干文档与配置（如知识图谱批量导入指南等）。


