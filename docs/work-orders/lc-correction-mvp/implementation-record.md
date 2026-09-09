# 6-1 信用证审改模式实施记录

日期：2026-09-08
发布阶段：Milestone 2

## 已交付

- `chapter-6-section-1` 新发布版本绑定 `workspace_kind=lc_correction`；其余 `document_review` 小节不切换工作台。
- 合同事实冻结为 case v1，MT700 审核副本、standard-a 八处错误和私有答案规则均版本化存放在 `content/document-correction/`。
- 新增 0018 迁移、会话/批注/结果模型、revision 与 operation id 幂等保存、提交冻结和确定性评分。
- Vue 工作台支持三栏桌面布局、手机四标签页、字段/clause 批注、结构化改证控件、完整性检查、草案预览、教师对照回放和本地降级讲评。
- 学生 API 不返回答案字段；旧 Attempt 没有 document profile 时继续进入旧文本审阅回放。

## 发布绑定

- 内容版本：`2.2.1-beta.23`。
- 本地 `dev.db`：Alembic `20260908_0018 (head)`。
- 本地示例班：`阶段2示例班` 已指向 `2.2.1-beta.23`。
- `DOCUMENT_CORRECTION_ENABLED`：示例配置默认 `false`；本地验收环境已显式设为 `true`。
- `DOCUMENT_CORRECTION_SKIP_PREREQUISITE`：示例配置默认 `false`；本地测试环境已显式设为 `true`，只放行已发布的 6-1，不改变其他小节先修规则。

## 验证

- API：78 项测试通过；ruff、mypy、文件长度检查通过。
- Web：27 个测试文件、55 项测试通过；类型检查、ESLint、Prettier、生产构建通过。
- 浏览器实测已覆盖准备页、MT700 DOM、八项批注、自动保存、刷新恢复、完整性检查、草案预览、100 分确定性提交结果。
- DeepSeek 未作为核心依赖接入；讲评失败保持本地反馈，不改成绩或进度。
