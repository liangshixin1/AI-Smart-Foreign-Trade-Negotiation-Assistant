# 6-1 信用证审改模式回滚说明

回滚目标是关闭新建结构化 Attempt，同时保留已提交记录和旧 Attempt 可读性。

1. 将运行环境 `DOCUMENT_CORRECTION_ENABLED` 设为 `false`，重启 API；新建 6-1 会被拒绝，已有结构化 Attempt 进入只读回放。
2. 如需恢复课程内容绑定，将 `阶段2示例班` 指回此前课程版本；不要删除已提交的 `document_correction_*` 数据。
3. 数据库回退前先保存 `outputs/lc-correction-qa/pre-0018.db`。0018 downgrade 在存在字段证据时主动拒绝，避免静默丢失教师回放证据。
4. 如必须移除 0018，先导出 `document_correction_sessions`、`document_annotations`、`document_correction_results` 和关联评价证据，并由维护人员确认后再执行迁移回退。

当前交付不执行数据库回退，也不删除验收证据。
