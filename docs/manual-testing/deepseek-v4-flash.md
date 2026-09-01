# DeepSeek V4 Flash 三 Agent 手工测试

## 目标

用完整 20 关内测课程验证三个相互独立的 Agent：

1. 场景 Agent 生成一次性场景快照。
2. 对话 Agent 扮演卖方完成多轮谈判。
3. 评价 Agent 每轮返回分数、Pros、Cons、详细评价和下一步建议；学生明确提交后再生成正式结构化评价。

服务端使用 DeepSeek 官方 OpenAI 兼容接口 `POST /chat/completions`，默认模型名为
`deepseek-v4-flash`。旧的 `deepseek-chat` 别名不进入本项目配置。

## 1. 安装与初始化

在仓库根目录执行：

```bash
python3 -m venv .venv
.venv/bin/pip install -e 'apps/api[dev]'
pnpm install
cp apps/api/.env.example .env
pnpm db:migrate
pnpm seed:users
pnpm seed:curriculum
pnpm seed:classroom
```

所有数据库和种子命令都必须从仓库根目录执行，避免相对 SQLite 路径指向不同文件。

## 2. 配置三个独立 Agent

编辑被 Git 忽略的根目录 `.env`：

```dotenv
LLM_PROVIDER=deepseek
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_SCENARIO_API_KEY=
DEEPSEEK_CONVERSATION_API_KEY=
DEEPSEEK_EVALUATION_API_KEY=
DEEPSEEK_SCENARIO_MODEL=deepseek-v4-flash
DEEPSEEK_CONVERSATION_MODEL=deepseek-v4-flash
DEEPSEEK_EVALUATION_MODEL=deepseek-v4-flash
LLM_TIMEOUT_SECONDS=60
LLM_MAX_RETRIES=1
```

三个 Key 必须全部存在且互不相同，否则 API 在启动时明确拒绝配置。Key 只在服务端读取，
不会发到浏览器、写入数据库或进入应用日志。

## 3. 启动

分别打开两个终端并在仓库根目录执行：

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

浏览器打开 `http://localhost:5174`，使用 `student@example.test` 登录。密码是初始化时
`DEV_SEED_PASSWORD` 的实际值。

## 4. 学生端手工验收路径

1. 在学习路线选择已解锁的小节；当前版本共 20 关，包含商务邮件、谈判对话和单证审阅三种模式。
2. 在准备页确认目标和五个评价维度，点击“开始训练”。
3. 确认出现模型生成的场景简报和卖方开场白。
4. 输入至少一轮英文业务表达；确认 DeepSeek 文本逐段出现，且学生消息不会因 AI 回复失败而丢失。
5. 确认本轮对话下方出现“逐轮即时反馈”，包含分数、Pros、Cons、详细评价和下一步建议。
6. 输入未发送草稿并刷新；确认草稿、场景、历史消息和逐轮反馈保持不变，没有重新生成场景。
7. 点击“正式提交”，在确认对话框再次确认。
8. 确认评价页展示总分、维度分、优点、改进点、行动建议和学生逐字证据。
9. 返回路线；确认进度只在 Attempt 进入 `completed` 后增加，下一节按先修关系解锁。
10. 在评价页点击“重练本关”，确认创建新 Attempt 且历史中保留原记录。

## 5. 教师端验收

1. 使用 `teacher@example.test` 登录，查看班级人数、7 日活跃、完成训练、平均分和需要关注人数。
2. 按姓名、学号或邮箱搜索，使用风险/完成率筛选与排序；新增、编辑或移出一名内测学生。
3. 导入 UTF-8 CSV，表头为 `student_no,display_name,email,initial_password`。表内重复或与数据库冲突时，整批不导入。
4. 确认班级共性薄弱维度和学生能力趋势显示平均分、证据数及风险来源。
5. 打开学生详情的 Attempt 时间线，再打开“完整证据”，确认可查看场景快照、对话、逐轮评价、正式评价、课程版本和提示词绑定。

## 6. 技术员端验收

1. 使用 `technician@example.test` 登录；确认页面只显示三个 Key 是否已配置，不显示明文。
2. 修改模型、超时、重试策略或填入新 Key 并保存；三把 Key 必须全部存在且互不相同。
3. 分别点击场景、对话、评价连通性测试，确认返回实际模型名和 Token 用量。

## 7. 可观察的失败状态

- 场景调用失败：Attempt 为 `generation_failed`，不会伪造场景。
- 对话调用失败：学生输入已入库，界面允许安全重试。
- 评价 JSON 或证据校验失败：Attempt 为 `evaluation_failed`，Submission 保持冻结，可点“重试评价”。
- 只有评价成功进入 `completed` 后才写入进度。

## 8. 当前边界

当前已迁移所提供 `levels.py` 的全部 9 流程、20 关；源文件没有另外 14 关，不能虚构为 34 关。对话使用 SSE 增量返回，正式评价仍在提交请求中同步完成，尚未引入独立任务队列。名册批量导入支持 CSV，暂不直接解析 `.xlsx`。技术员的本地配置写入被 Git 忽略且权限为 `0600` 的根目录 `.env`；生产部署应改用密钥管理服务。

API 启动后可运行可重复的真实 Agent 冒烟测试：

```bash
pnpm smoke:deepseek
```
