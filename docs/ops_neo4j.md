# Neo4j 运维与监控建议（Beta2 可行性评估版）

## 基础配置

- 通过 `.env` 设置以下变量：
  - `NEO4J_URI`（例：`bolt://localhost:7687`）
  - `NEO4J_USERNAME`
  - `NEO4J_PASSWORD`
  - `NEO4J_DATABASE`（可选，默认 `neo4j`）
  - `NEO4J_MAX_POOL_SIZE`、`NEO4J_MAX_RETRY_TIME`（可选）
- `app.py` 启动时调用 `services.neo4j_client.init_neo4j()`，自动建立唯一约束。

## 运行时监控指标

| 指标 | 说明 | 检测方式 |
| --- | --- | --- |
| 连接可用性 | Neo4j 驱动是否可用 | 调用 `GET /api/knowledge_graph/health`，返回 `status: ok` |
| 写入失败率 | MERGE/CREATE 执行异常次数 | 在应用日志中搜索 `Failed to initialize Neo4j` / `Neo4jError`，建议接入日志告警 |
| 查询耗时 | Cypher 查询延时 | 可在 Neo4j Browser 中启用 `:sysinfo` 或使用 Aura/Prometheus 监控 |
| 连接池耗尽 | 连接池达到上限 | 通过 Neo4j 日志 (`debug.log`) 或应用侧 `neo4j.exceptions.ServiceUnavailable` 错误监控 |

## 安全建议

- 最少权限原则：使用只读账号提供 API 查询，用读写账号执行同步脚本。
- 不在日志中打印 Neo4j 密码，敏感信息统一通过环境变量传入。
- 如部署在公有云，建议开启 TLS（`neo4j+s://`）。

## 高可用与备份

- 开发/测试环境可采用单节点，生产建议使用 Neo4j Enterprise Cluster 或 Aura。
- 定期执行 `neo4j-admin dump` 备份；导入前先备份以便快速回滚。
- 对于容器化部署，可利用 Kubernetes StatefulSet + 持久卷，结合 Liveness/Readiness 探针监控。

## 故障排查流程

1. **驱动报错**：检查网络连通性、URI/端口、认证信息。
2. **写入异常**：在 Neo4j Browser 中执行同等 Cypher，确认语法和数据约束是否满足。
3. **性能下降**：
   - 使用 `CALL db.stats.retrieve()` 查看节点/关系数量。
   - 检查是否需要补充索引（如 `Session.lastEvaluatedAt`）。
   - 评估是否需要调大连接池、分片写入。
4. **数据不一致**：
   - 对比 SQLite 原始数据与图谱节点，确认同步脚本是否漏跑。
   - 使用 `MATCH` + `DETACH DELETE` 清理异常节点后重新导入。

> 本运维文档聚焦 Beta2 版本的最小可行方案，后续可结合实际部署形态持续完善。
