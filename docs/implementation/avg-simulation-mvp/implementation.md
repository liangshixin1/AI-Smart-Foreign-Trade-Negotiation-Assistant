# AVG 仿真谈判 MVP 实施记录

## 交付结论

`chapter-3-section-1` 已形成可操作的功能 MVP：模式选择、一次性公共简报、短台词舞台、三维态势、学习支持、草稿与刷新恢复、幂等发送、正式提交、评价和教师证据回放均接入原训练链。旧 IM 模式保持原入口和数据模型。

当前不能标记“全部 Definition of Done 完成”：真实 DeepSeek 十轮联调尚未获外发测试内容的明确授权；正式角色包仍为 `draft`，等待用户审美验收；真实移动设备和软键盘未测。

## A—H 实施映射

### A · 基线与设计冻结

- 记录脏工作区、基准提交、既有测试和接入边界。
- 采用独立 `experience_mode`，不复用 `training_mode`。
- 服务端按关卡返回支持模式，开关默认关闭。

### B · 契约与规则

- 新增严格的 `simulation.*.v1` Pydantic 契约、白名单表情/动作、1—3 beat 和英文词数校验。
- 态势由服务端纯规则应用评价候选事件；每维每轮限制 ±8、0—100 clamp、事件去重、条款版本与重新打开规则均有反例测试。
- 公共响应只包含公共事实和原话证据，不序列化场景私有载荷。

### C · 最小舞台

- 新增 Vue 懒加载仿真工作区、角色舞台、对话框、简报播放器、态势栏、历史记录和播放控制。
- 打字机按 grapheme 播放；不支持 `Intl.Segmenter` 或减少动态效果时整句显示。
- 输入法组合期间 Enter 不发送；播放未读完时第一次发送只完成当前台词并保留草稿。
- 学习支持面板不会销毁草稿或重复记录提示行为。

### D · 持久化、幂等与读取

- Alembic `20260907_0017` 为旧 Attempt 回填 `chat`，新增 conversation revision、创建幂等表、仿真会话、分镜、态势事件和态势快照。
- 相同创建键/请求返回同一 Attempt，同键异请求为 409。
- 相同 `client_message_id`/内容只生成一轮，同键异内容为 409。
- 数据库租约保证同一 Attempt 同时最多一个生成；模型调用不长期占用事务；过期 revision 不能覆盖新会话。
- 学生和教师分别通过权限校验读取同一份公共仿真证据。

### E · 三用途 LLM 与关卡

- 保持 scenario / conversation / evaluation 三用途；新增版本 1.0.0 的仿真 briefing、conversation、round、final 提示词。
- conversation 先完成结构化响应、校验并原子保存 Message 与 Presentation，再发可播放事件；非法输出只做一次受约束纠正。
- 仿真 conversation 不再拼接要求“称呼、署名、3—5 句”的旧 IM 邮件提示，只使用独立短台词提示、同一场景快照和公共历史；精确 JSON 形状写入提示，输出预算降为 512 tokens。
- scenario 对结构化结果同样只做一次约束修复；仍失败时保留失败记录，客户端停留在准备页并允许使用新幂等键重新开始，不进入空白工作台。
- 仿真逐轮评价使用独立口语评价提示；两次输出均不合规时仅降级无效的可选扩展，核心分数与反馈仍须通过 Schema，态势候选无效则为空而不是伪造。
- round evaluation 产生带原话证据的观察候选；正式评价使用适配简短商务口语的 profile。
- mock 全闭环通过。真实模型 runner 已准备，但未执行，详见 `known-issues.md`。

### F · 教学与教师证据

- 复用原草稿、提示、知识图谱、提交和评价链；Message 仍是对话真值。
- 教师回放显示体验模式、完整短台词、分镜、配置/资产/规则版本、逐 revision 态势变化和原话证据。
- 提交冻结仿真配置、简报、分镜和态势 hash；生成中禁止提交，分析失败不会伪装成 0 分。

### G · 正式资产接入

- 以 `docs/david.jpg` 为身份底图，经 ImageGen 生成五种表情和会谈背景。
- 三张初始派生图出现黑色矩形底板，浏览器 QA 发现后未接受；重新生成纯绿幕变体，再由确定性脚本去背并验证五张 WebP 均含 alpha。
- 当前浏览器资产共约 260 KB，低于 2 MB 首屏目标和 6 MB 单角色包目标。
- 资产包 `david-lim/v1-draft` 保持 `approved=false`，工程验收不能替代用户审美验收。

### H · QA 与交付

- 完成 mock 浏览器闭环、旧 IM 闭环、教师回放、多视口布局、IME、资产缺失降级、刷新恢复和重复请求测试。
- 在本地 3-1 页面复现并修复仿真开关未启用及场景生成失败误导航；失败历史、直达页面和再次开始均有显式恢复路径。
- 全量前后端测试、格式、lint、类型、生产构建和受版本控制源文件长度门禁通过；本地 `work/` 临时目录不进入公开仓库。
- 截图、机器可读指标、回滚说明和未验证条件均保存在本实施目录。

## 数据库变化

- `attempts.experience_mode`：`chat|simulation`，旧数据默认 `chat`。
- `attempts.conversation_revision`：防止旧生成结果覆盖新状态。
- `round_evaluations.simulation_observation`：评价用途下的仿真观察候选。
- 新表：`attempt_creation_requests`、`simulation_sessions`、`simulation_turn_presentations`、`simulation_state_events`、`simulation_state_snapshots`。

## API 变化

- `POST /api/v1/attempts`：可选 `experience_mode`；仿真创建要求 `Idempotency-Key`。
- 既有同步/流式发送入口统一按 Attempt 模式派发；仿真完整事件为 `simulation.turn.ready` 和 `simulation.state.updated`。
- `GET /api/v1/attempts/{id}/simulation`：学生恢复与对账。
- `POST /api/v1/attempts/{id}/simulation/messages/{assistant_message_id}/retry-analysis`：只重试本轮分析，不重新生成台词。
- `GET /api/v1/teacher/attempts/{id}/simulation`：教师受权限约束读取公共证据。

## 主要代码位置

- 后端领域：`apps/api/app/modules/simulation/`
- 前端功能：`apps/web/src/features/simulation/`
- 关卡配置：`content/simulation/profiles/price-counteroffer-v1.yaml`
- 提示词：`content/prompts/simulation/`
- 迁移：`apps/api/alembic/versions/20260907_0017_avg_simulation.py`
- 资产源与清单：`content/simulation/assets/david-lim-v1-draft/`
- 浏览器资产：`apps/web/public/simulation/david-lim-v1-draft/`
