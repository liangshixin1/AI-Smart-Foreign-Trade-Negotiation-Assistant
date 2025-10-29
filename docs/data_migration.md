# Neo4j 数据回填与一致性指南（Beta2 可行性评估版）

本文描述如何将历史 SQLite 数据回填至 Neo4j 知识图谱，并给出幂等策略与回滚思路。

## 运行脚本

```bash
# 先确保 .env 配置了 NEO4J_URI / NEO4J_USERNAME / NEO4J_PASSWORD 等变量
pip install -r requirements.txt
python scripts/backfill_neo4j.py --dry-run       # 预演，打印计划写入数量
python scripts/backfill_neo4j.py                # 实际写入
```

可选参数：

- `--limit <N>`：仅同步前 N 个会话，便于局部验证。
- `--skip-evaluations`：只写入会话，不同步历史评估数据。
- `--dry-run`：输出即将执行的数量统计，不触发 Neo4j 写操作。

## 幂等策略

- 会话写入使用 `MERGE (Session {id})`，重复执行不会创建重复节点。
- 知识点、章节、小节、用户、行动项均使用唯一标识 `MERGE`，确保多次运行保持一致。
- `Session.latestScore` 等属性会被最后一次执行覆盖，建议在批量导入后再运行增量任务（若有）。

## 回滚建议

1. 若数据量较小，可在 Neo4j Browser 中执行：
   ```cypher
   MATCH (s:Session) DETACH DELETE s;
   MATCH (e:Evaluation) DETACH DELETE e;
   MATCH (a:ActionItem) DETACH DELETE a;
   MATCH (k:KnowledgePoint) WHERE NOT (k)<-[:COVERED]-(:Session) DELETE k;
   ```
   此方式不会删除章节/小节/用户等基础元数据。
2. 在生产环境执行前请先备份 Neo4j 数据库（可通过 `neo4j-admin dump`）。
3. 若仅少量节点错误，可在 Neo4j Browser 中手动 `MATCH ... DELETE`。

## 一致性校验

- 导入后运行 `python scripts/backfill_neo4j.py --dry-run`，确认 SQLite 会话数与图谱统计一致。
- 通过新建的 API（`GET /api/knowledge_graph/health` 和 `GET /api/knowledge_graph/users/<id>/knowledge`）验证查询是否返回数据。
- 建议在 CI 中增加轻量级 smoke test：
  ```bash
  pytest tests/test_knowledge_graph_ingest.py
  ```

## 常见问题

| 问题 | 排查建议 |
| --- | --- |
| `Neo4j driver requested but credentials are missing` | 检查 `.env` 是否配置 `NEO4J_URI/USERNAME/PASSWORD`，并确认 `python-dotenv` 已加载。 |
| `Neo4jError: ... authentication` | 确保 Neo4j 用户名密码正确，或启用 `neo4j` 默认数据库。 |
| `Connection refused` | 确保 Neo4j 服务已启动，并在 `NEO4J_URI` 中包含端口（例如 `bolt://localhost:7687`）。 |

> 本文档为 Beta2 可行性评估版本，后续部署到生产环境前需结合实际基础设施调整。
