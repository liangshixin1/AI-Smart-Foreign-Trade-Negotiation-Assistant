# Beta2 Neo4j 知识图谱 Schema（可行性评估版）

本文件记录 Beta2 阶段落地的最小可行知识图谱模型，覆盖会话、课程层级、知识点与评估结果，便于后续扩展。

## 节点类型

| Label | 说明 | 关键属性 |
| --- | --- | --- |
| `User` | 学员或教师（目前主要存储学生信息用于图谱查询） | `id`（数字 ID，唯一）、`username`、`displayName`、`createdAt`、`lastSeenAt` |
| `Session` | 一次完整的对话练习/作业会话 | `id`（UUID，唯一）、`startedAt`、`difficulty`、`expectsBargaining`、`assignmentId`、`scenarioTitle`、`scenarioSummary`、`latestScore`、`latestScoreLabel`、`lastEvaluatedAt`、`bargainingWinRate`、`latestCommentary` |
| `Chapter` | 章节元数据 | `id`、`title`、`description` |
| `Section` | 章节下的具体小节/关卡 | `id`、`title`、`description` |
| `KnowledgePoint` | 练习/评估涉及的知识点或技能标签 | `name`（唯一） |
| `Evaluation` | 每次评估结果，保留历史版本 | `id`（`<session_id>-<uuid>`）、`score`、`scoreLabel`、`commentary`、`createdAt` |
| `ActionItem` | 针对会话生成的改进行动项 | `id`（`<session_id>:<text>`）、`text`、`createdAt` |

## 关系

| 起点 | 关系 | 终点 | 含义 |
| --- | --- | --- | --- |
| `User` | `[:STARTED]` | `Session` | 学员创建/参与的会话 |
| `Session` | `[:IN_CHAPTER]` | `Chapter` | 会话所属章节 |
| `Session` | `[:IN_SECTION]` | `Section` | 会话所属关卡 |
| `Section` | `[:BELONGS_TO]` | `Chapter` | 小节从属关系（便于导航） |
| `Session` | `[:COVERED]` | `KnowledgePoint` | 会话覆盖/训练的知识点（场景 + 评估） |
| `Session` | `[:HAS_EVALUATION]` | `Evaluation` | 会话对应的评估历史记录 |
| `Session` | `[:HAS_ACTION_ITEM]` | `ActionItem` | 评估产生的行动建议 |

## 约束 & 索引

初始化脚本（`services/neo4j_client.py`）创建以下唯一约束：

- `User(id)`
- `Session(id)`
- `KnowledgePoint(name)`
- `ActionItem(id)`

可根据需要补充如下索引：

- `CREATE INDEX session_lastEvaluated FOR (s:Session) ON (s.lastEvaluatedAt);`
- `CREATE INDEX eval_createdAt FOR (e:Evaluation) ON (e.createdAt);`

## 属性更新策略

- 节点信息通过 `MERGE` + `SET` 幂等更新，避免重复创建。
- `Session.latestScore` 与相关指标始终反映最近一次评估结果；历史详情保存在 `Evaluation` 节点。
- 知识点和行动项使用去重 ID（名称或 `<session_id>:<text>`）保证重复写入时不会制造脏数据。

## 后续扩展建议

1. **权限与角色**：可为 `User` 增加 `role` 属性，构建教师与学生之间的关系图谱。
2. **知识点层级**：引入 `KnowledgePoint` 的主题层级或难度属性，支撑推荐系统。
3. **评估维度**：若后续需要多维度得分，可在 `Evaluation` 中添加结构化子节点或属性（如沟通能力、价格策略等）。
4. **版本管理**：为 `ActionItem` 增加 `resolved` 标记，跟踪学员完成情况。

> 注：本 schema 为 Beta2 可行性评估版本，真实部署前需结合业务评审进一步细化。
