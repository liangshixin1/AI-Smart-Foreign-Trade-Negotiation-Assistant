# AVG 仿真谈判 MVP QA 结果

记录日期：2026-09-07

## 自动化冻结结果

| 检查 | 结果 |
| --- | --- |
| 前端 Vitest | 27 个测试文件、55 项测试通过 |
| 后端 Pytest | 62 项通过，1 个既有 warning |
| 仿真后端聚焦测试 | 8 项通过，包含幂等、并发、私有数据、态势和冻结规则 |
| 迁移测试 | 2 项通过，包含空库升级和合成 0016 旧库升级 |
| Prettier | 通过 |
| ESLint | 通过，0 warning |
| Vue/TypeScript | 通过 |
| Ruff format/check | 通过 |
| mypy | 137 个源文件通过 |
| Vite 生产构建 | 通过；仿真 JS 懒加载 chunk 9.59 KB / gzip 4.21 KB |
| 文件长度 | 通过；本地 `work/` 临时/渲染目录按仓库忽略规则排除 |

## 浏览器闭环

浏览器 QA 使用独立临时 SQLite 数据库、mock LLM、API 8011 和 Web 5181，不触碰用户正在运行的 8000/5174 服务。

- 仿真：创建 → 5 段简报 → 舞台 → 自由输入 → 短回复 → 态势与原话证据 → 刷新恢复 → 历史/支持/草稿保留 → 正式提交 → mock 评价完成。
- 旧 IM：新建 → 一轮交锋 → 正式提交 → mock 评价完成。
- 教师：回放显示“仿真模式”、完整 Message/Presentation、态势规则和逐轮原话证据。
- 资产故障：缺少特定表情回退 neutral；全部立绘失败回退同身份中性剪影；背景失败回退纯色舞台。
- 网络/幂等：同键同内容不会重复生成；同键异内容拒绝；刷新只 GET 已保存内容，不重复调用模型或叠加态势。
- 3-1 失败恢复：场景结构错误会做一次约束修复；仍失败时准备页不跳入空白工作台，历史与直达链接均提供“重新开始”。

机器可读闭环结果见 `evidence/closure-results.json`。

## 视口和输入法

自动浏览器在以下模拟视口均确认：无横向溢出、输入框可见、发送按钮可见、台词位于输入区上方。

| 视口 | 结果 |
| --- | --- |
| 360×800 | 通过 |
| 390×844 | 通过 |
| 768×1024 | 通过 |
| 1280×800 | 通过 |

输入法组合事件下，`中文输入法组合测试` 草稿保持，未触发发送。机器可读结果见 `evidence/browser-metrics.json`。

## 资产与体积

- 角色：5 个表情 WebP 均验证为真透明；3 个轻动作由 CSS 实现。
- 场景：1 张 1280×853 WebP；角色派生图 600×900；头像 256×256。
- 浏览器资产包总量约 260 KB（含 manifest），低于预算。
- 首轮错误黑底截图 `04-state-evidence-desktop.jpg` 保留为缺陷发现证据；修复结果见 `05-transparent-sprite-recovery.jpg`。

## 截图索引

- `02-briefing-desktop.jpg`：叙事简报。
- `03-stage-desktop.jpg`：桌面舞台。
- `05-transparent-sprite-recovery.jpg`：透明立绘修复。
- `06-support-panel-draft-retention-desktop.jpg`：学习支持与草稿保留。
- `07-mobile-360x800.png`、`08-mobile-390x844.png`、`09-tablet-768x1024.png`、`10-desktop-1280x800.png`：多视口。
- `11-simulation-evaluation.png`：仿真正式评价。
- `12-legacy-chat-regression.png`：旧 IM 回归。
- `13-teacher-simulation-replay.png`：教师仿真证据回放。

## 尚未执行的验收

- 真实 DeepSeek 十轮受控联调及首响应/台词/评价时延统计：未执行。用户在本地页面启动过一次 3-1，供应商返回 200 但场景结构校验失败；该单次故障复现不等同于受控联调通过。
- 用户对 David Lim 正式资产的人工审美批准：未完成。
- Safari/iOS、Android Chrome 真机与真实软键盘：未测试；视口模拟不冒充真机。
- 200% 浏览器缩放、屏幕阅读器人工顺序、DevTools FPS/时间线和“下一句”实测延迟：未形成正式测量证据。
