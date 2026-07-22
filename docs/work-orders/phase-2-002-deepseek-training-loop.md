# 阶段 2-002：DeepSeek 三 Agent 训练闭环

## 工单目标与范围

- 用户问题：课程路线只能查看，无法完成真实训练和评价。
- 范围内：Attempt 状态、三 Agent 适配、场景快照、谈判消息、正式提交、评价、进度、学生页面。
- 不做：全课程迁移、语音、知识图谱、教师分析、SSE、生产部署。
- 模块：`training`、`assessment`、`progress`、`integrations/llm`、Web training/evaluation features。
- 数据/API：新增迁移 0003 和 Attempt 相关 REST API；课程版本提升为 `1.0.0-slice.2`。
- 组件：场景简报、时间线、消息输入、任务清单、提交确认、自动保存状态、评价证据视图。
- 验收：完整学生闭环可操作；失败有状态；证据可追溯；进度只统计 completed。
- 风险与回滚：provider 可切回 mock；0003 可整体降级；外部密钥不入库。

## 实际完成

1. 建立 `not_started → generating_scenario → in_progress → submitted → evaluating → completed`
   状态转换和两个明确失败状态。
2. 三个用途分别读取独立 DeepSeek Key 和模型参数，统一调用 provider 适配层。
3. 场景 public/private 隔离；同一 Attempt 保存唯一快照。
4. 学生消息先入库，再调用对话 Agent；失败消息可追溯。
5. Submission 冻结场景哈希、消息和版本绑定；重复提交幂等。
6. 评价严格校验五个量规维度、0–100 分数和学生消息逐字证据；服务端计算加权总分。
7. 评价成功才写 ProgressRecord，学习路线可恢复 Attempt 并显示完成状态。
8. Vue 工作台和评价页完成，并用本地浏览器走通闭环。

## 修改文件

- 后端：`apps/api/app/integrations/llm/`、`modules/training/`、`modules/assessment/`、
  `modules/progress/`、curriculum 状态聚合及应用路由。
- 前端：`features/training/`、`features/evaluation/`、学生训练/评价页、课程路线恢复链接。
- 内容：场景与评价提示词 JSON Schema、课程/小节/提示词新版本。
- 工程：迁移 0003、环境变量示例、根目录数据库/种子命令、手工测试文档。

## 数据库迁移

`20260714_0003_training_vertical_slice.py` 新增 Attempts、场景快照、消息、提交、状态事件、
LLM 调用审计、评价、评价维度、能力证据和进度表。空 SQLite 数据库升级已通过自动测试。

## 真实验证结果

- API：18 个测试通过，包含 DeepSeek V4 Flash 请求契约和三 Key 独立性。
- Web：4 个测试文件、6 个测试通过；ESLint 和 Vue TypeScript strict 通过。
- 浏览器：登录、开始训练、谈判、提交、评价、进度 0/1→1/1 全部通过。
- 浏览器控制台：0 个 warning/error；936px 视口下 `scrollWidth === clientWidth`。

## 尚未解决

- 尚未使用用户真实 DeepSeek Key 产生计费调用。
- 对话暂为非流式，评价暂为请求内同步执行。
- 教师查看完整回放、技术员在 UI 中安全写入密钥属于后续工单。

## 验收对照

- 场景生成：通过，且保存唯一快照。
- 模拟对话：通过，学生消息先保存。
- 正式提交：通过，有二次确认和冻结快照。
- 结构化评价：通过，有五个维度和逐字证据。
- 进度规则：通过，只统计 completed。
- 错误与重试：场景、对话、非法评价和评价重试均有接口测试。
- 真实 DeepSeek：请求契约已验证；需要三把真实 Key 后按手工指南验收。
