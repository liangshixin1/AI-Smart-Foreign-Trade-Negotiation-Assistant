# 学生助理接手指南

适用对象：了解基础编程、HTTP 和数据库，但尚不了解本项目业务的计算机专业学生助理。
本指南对应 2026-09-12 的工作区。先读业务流程，再沿一条真实请求从页面走到数据库，最后阅读各文件开头的中文导读。

## 这个平台解决什么问题

学生在课程小节中练习外贸谈判、商务邮件或单证审阅。系统提供场景、对手回复和学习支持，保存学生作答及评价依据；教师管理所属班级、查看学情并回放具体训练；技术人员维护模型配置和教学图谱发布。

主要流程：小节准备 → 创建一次训练 → 阅读场景 → 作答与单轮反馈 → 正式提交 → 评价与复盘。
信用证专用模式使用“只读原证 → 提出改证批注 → 保存 → 按本地规则评分”的流程。

## 先认识这些业务名词

| 名词 | 本项目中的意思 | 容易混淆之处 |
| --- | --- | --- |
| TrainingUnit / 小节 | 一个课程训练入口，关联任务、提示词和评分约定 | 不是一次作答记录 |
| Attempt / 一次训练 | 某学生的一次具体练习，有独立编号、状态及版本绑定 | 重练创建新记录；重试评价仍使用原提交 |
| Scenario / 场景 | 本次任务的角色、目标与业务约束 | public 给学生看；private 包含对手底牌，不能直接返回学生 |
| Submission / 正式提交 | 确认提交时冻结的作答、场景与版本快照 | 自动保存草稿不等于正式提交 |
| RoundEvaluation / 逐轮反馈 | 一轮学生发言及对手回复后的即时建议与检查结果 | 不等于最终成绩或课程通关 |
| Evaluation / 正式评价 | 根据正式提交形成的总评与证据 | 普通训练的模型评价与信用证的本地规则评分不同 |
| Rubric / 评分量规 | 评分维度、权重和要求 | 模型不能擅自增删教学要求 |
| 图谱节点 | 阶段、商务现象、知识点或策略等教学对象 | 短名是显示用文字，稳定编号才用于关联记录 |
| graph_version + node_key | 一份图谱版本中的一个节点身份 | 同一编号在不同版本中的学习内容应隔离 |
| Scaffold / 学习支持库 | 本次训练固定的相关现象、知识、策略和分层提示 | 模型从候选中选重点，不改写整个支持库 |
| Overlay / 高亮层 | 将本轮、回放或学情证据标在图上的显示数据 | 灰色不等于学生不会；底图事实与表现证据分开 |
| LearningActivity / 学习活动 | 浏览节点或确认学习完成的事件 | 不直接等于课程通关 |
| Simulation / 仿真 | 以角色立绘、逐段台词和态势展示谈判 | 动画播完不表示服务端评分已经完成 |
| Presentation / 演出记录 | 已保存的台词、表情、动作与段落 | 回放应读历史记录，不再生成另一套台词 |
| State / 谈判态势 | 按原话证据和本地规则计算的谈判状态 | 模型观察是输入，状态规则负责决定变化 |
| 信用证 / MT700 | 银行按约定单据付款的承诺；MT700 是本项目采用的报文样式 | 学生编辑批注，不修改原证快照 |
| Annotation / 改证批注 | 指出字段问题、合同依据和拟改内容 | 填写完整只代表结构合法，不表示答案正确 |
| 变更集 / 发布版 | 待评审的图谱改动 / 已发布可读取的图谱版本 | 上传、校验、批准、发布是不同状态 |
| PI 十阶段 | 本项目采用的贸易流程十阶段分类 | 迁移保留稳定事实编号和旧训练证据 |
| 生成租约 | 有时限的模型生成占用记录 | 旧调用过期后不能覆盖新调用；不是永久锁 |
| 幂等键 | 标识同一次业务操作的稳定客户端编号 | 网络重试应按相应流程复用；同一键不能用于不同内容 |
| revision / 修订号 | 检测保存时服务器内容是否已变化 | 冲突要对账，不能直接用旧页面覆盖最新记录 |

## 建议阅读路线

1. **登录与请求边界**：`apps/web/src/pages/LoginPage.vue` → `features/auth/stores/auth.ts` → `shared/api/http.ts` → 后端 `app/modules/auth/router.py`、`dependencies.py`、`service.py`。区分浏览器缓存、令牌校验和资源归属权限。
2. **一次普通训练**：`UnitPreparationPage.vue` → `useStartAttempt.ts` → `training/attempt_creation_service.py`；随后从 `TrainingWorkspacePage.vue` → `useAttempt.ts` → `trainingApi.ts` → `training/streaming_context.py`、`streaming_service.py` 阅读消息链路。
3. **正式提交与恢复**：后端 `training/submission_service.py` → `assessment/service.py`；对照 `training/recovery_service.py` 区分重练与重试评价。
4. **知识图谱学习**：`StudentKnowledgeContentPage.vue`、`useLearningContent.ts`、`useLearningActivity.ts` → 后端 `knowledge_graph/learning_router.py`、`content_service.py`、`learning_activity_service.py`。随后读 `KnowledgeGraphExplorer.vue` 与 `KnowledgeGraphCanvas.vue`，理解事实数据和显示高亮分离。
5. **信用证审改**：`LcCorrectionWorkspace.vue` → `useDocumentCorrection.ts` → 后端 `document_correction/annotation_service.py`、`grading_rules.py`、`grading_service.py`。重点看版本冲突、批注冻结及本地评分。
6. **教师与技术人员**：`TeacherHomePage.vue` → `teacher_analytics/roster_service.py`、`service.py`；`KnowledgeGraphImportPanel.vue` → `knowledge_graph/import_service.py`、`review_service.py`。

以上前端页面位于 `apps/web/src/pages`，功能文件位于 `apps/web/src/features`；后端业务目录统一位于 `apps/api/app/modules`。
完整可点击路径见[文件索引](FILE_INDEX.md)。

## 按职责找文件

| 位置或文件名 | 职责 | 阅读重点 |
| --- | --- | --- |
| 前端 `.vue` | 页面、布局及可复用界面组件 | 文件头说明业务用途、结构、依赖与设计原因 |
| `composables/use*.ts` | 页面状态与异步业务动作 | 谁发请求、谁等待结果、何时清草稿、旧响应能否回写 |
| 前端 `api/*.ts` | 后端接口调用 | 路径、参数、幂等键、SSE 事件和错误返回 |
| 后端 `router.py` | HTTP 入口和依赖注入 | 角色依赖、参数来源、服务转接 |
| 后端 `service.py` 等服务文件 | 业务规则及流程协调 | 归属检查、状态迁移、事务、失败恢复 |
| `repository.py` | 查询及持久化操作 | 过滤范围、外键关联、flush 与 commit |
| `models.py` | 数据库结构与约束 | 唯一键、版本字段和实体关系 |
| `schemas.py` | 请求、响应及校验结构 | 公开与内部字段、枚举、模型输出约束 |
| `integrations` | 模型、图数据库和 SSE 适配 | 超时、错误分类、协议、测试替身 |
| `alembic` | 数据库迁移 | 修订链、升级与降级的数据影响 |
| `tests` | 回归测试及夹具 | 输入、调用、断言和数据隔离 |

## 容易踩坑的边界

- **异步回执**：`useLearningContent` 与 `useLearningActivity` 用请求代次丢弃旧节点结果；`useSimulationSession` 按态势修订号防止倒退。这些保护是各自实现的，不能假定所有请求都自动具备同样保护。
- **草稿与附件**：正文未保存时，上传附件后的响应不应把整个表单重新初始化。信用证草稿还保存待确认操作，网络失败不能证明服务器没有完成保存。
- **事务**：`get_db` 关闭会话，不负责自动提交业务。`flush` 发出 SQL，但不等于 `commit`。模型调用审计等方法内部会提交，外层后续 `rollback` 不能撤销已经提交的记录。
- **跨库发布**：Neo4j 与 SQL 库没有共同事务，图谱发布依靠显式补偿；不要删掉“停用新图、恢复旧图”的异常分支。
- **缓存与权限**：本地会话只是界面恢复数据。教师角色不意味着可以查看所有学生，后端还检查班级范围。学生读取学习内容和附件需遵守草稿不可见边界。
- **跨域**：浏览器请求的来源、方法和请求头都需要后端允许；允许 CORS 不等于通过鉴权。跨域读取附件文件名还受响应头暴露规则影响。
- **资源生命周期**：播放器、图实例、对象 URL、计时器和观察器需要释放。`useLearningAssetFile` 接收调用时的节点参数，复用播放器切节点时要检查外层是否重新创建实例。
- **历史证据**：旧训练保留原课程、图谱、场景及评分规则绑定。修改显示名称或发布新图，不能顺手重写旧 Attempt 和学习证据。
- **仿真播放**：`useDialoguePlayback.showAll()` 补全当前台词段，不能据函数名推断已经跳过整轮所有段落。

## 本次修改范围与验证

已为 **336 个文件**增加中文导读：77 个 Vue 组件、63 个前端 TypeScript 文件、192 个后端 Python 文件及 4 个后端配置/模板文件。后端 Python 包含应用 152 个、迁移 19 个、测试 21 个。缓存、依赖安装目录、构建产物、数据库和真实环境秘密文件不属于注释目标。

每个文件开头说明用途、业务名词、结构和设计原因；关键函数旁补充去重、异步回写、事务、权限、版本冲突与失败恢复等说明。没有改变业务表达式、接口、数据库模型、原有文档字符串或配置键值。

工作区在开始时已有业务改动，本次全部保留。验证以本次开始时的文件快照为基准，**不是把整个 Git 工作区与 HEAD 的差异都宣称为注释**。

- 336 个文件移除新增注释后，与本次前快照逐字一致；所有改动的 Python 文件抽象语法树一致。
- 前端：类型检查、ESLint、Prettier、30 个测试文件的 62 个测试及生产构建通过。
- 后端：83 个测试、Mypy（152 个应用文件）、Ruff 检查与格式检查通过。
- 新增审计逻辑的 4 个边界用例通过，覆盖 Python 字符串、TypeScript 模板字符串、行内代码和 Vue 模板/样式中的同形标记。
- 构建有媒体依赖分包较大的提示；本次没有进行性能优化或真实模型验收。

2026-09-15 交付复核：336 个文件与已验证版本的摘要全部一致，Vue 与后端目标文件无覆盖遗漏，指南和索引中的本地链接全部有效。

## 注释与行数审计

本次唯一涉及既有可执行逻辑的修改是 `scripts/check_file_lengths.py`：支持从行数中扣除本次标记的独占行导读。新增 `scripts/count_handoff_comments.cjs` 使用 TypeScript 与 Vue 解析器识别前端注释，Python 使用标准词法分析器识别注释。不会误扣字符串中的“注释样例”，同一行仍有代码也不会扣除。

保留原限额与原有注释、空行的计数口径；仅豁免新增标记，避免顺带放宽其他审计规则。原有每个目标文件的计入行数与修改前一致。审计脚本需要已安装的前端依赖与 Node，使用项目现有环境即可。

```sh
.venv/bin/python scripts/check_file_lengths.py
.venv/bin/python scripts/test_handoff_comment_audit.py
```

可以用下列命令复查现有质量检查；它们不会替你创建、迁移或发布真实教学数据。

```sh
pnpm --dir apps/web typecheck
pnpm --dir apps/web test:run
pnpm --dir apps/web build
.venv/bin/pytest apps/api/tests
.venv/bin/mypy apps/api/app
.venv/bin/ruff check apps/api scripts
```

本次覆盖和逐文件校验元数据见 [annotation-manifest.json](annotation-manifest.json)。里面只有路径、计数及摘要，不包含原文件全文或真实环境凭据。
