# 中文导读完整文件索引

共 336 个文件。这里按功能目录列出全部注释目标，点击文件后先阅读最前面的导读，再追踪关键函数。

总阅读路线见 [接手指南](README.md)。

## 后端配置

| 文件 | 职责 |
| --- | --- |
| [.env.example](../../apps/api/.env.example) | 后端环境变量示例，供成员了解配置项。 |
| [alembic.ini](../../apps/api/alembic.ini) | 配置 Alembic 迁移脚本目录、数据库连接占位和日志。 |
| [pyproject.toml](../../apps/api/pyproject.toml) | 声明 API 包信息、依赖和相关开发工具配置。 |

## 数据库迁移与模板

| 文件 | 职责 |
| --- | --- |
| [alembic/env.py](../../apps/api/alembic/env.py) | 为 Alembic 配置离线 SQL 生成与在线数据库迁移环境。 |
| [alembic/script.py.mako](../../apps/api/alembic/script.py.mako) | 生成新数据库迁移文件的 Mako 模板。 |
| [alembic/versions/20260714_0001_auth_foundation.py](../../apps/api/alembic/versions/20260714_0001_auth_foundation.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 建立账号、角色与登录会话表, 为身份校验提供持久记录。 |
| [alembic/versions/20260714_0002_curriculum_slice.py](../../apps/api/alembic/versions/20260714_0002_curriculum_slice.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 建立版本化课程、章节、小节、提示词与评分标准, 让训练可绑定教学依据。 |
| [alembic/versions/20260714_0003_training_vertical_slice.py](../../apps/api/alembic/versions/20260714_0003_training_vertical_slice.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 建立训练、场景、消息、提交、评价及进度相关表, 记录从作答到通关的过程。 |
| [alembic/versions/20260714_0004_streaming_round_feedback.py](../../apps/api/alembic/versions/20260714_0004_streaming_round_feedback.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 扩展流式消息与逐轮评价记录, 将单轮反馈和正式总评区分保存。 |
| [alembic/versions/20260716_0005_training_recovery.py](../../apps/api/alembic/versions/20260716_0005_training_recovery.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 增加草稿和重练关联等恢复数据, 断开页面后仍能继续训练或回看旧记录。 |
| [alembic/versions/20260716_0006_round_checklist_assessment.py](../../apps/api/alembic/versions/20260716_0006_round_checklist_assessment.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 为逐轮评价补充目标清单检查结果, 让每项任务要求都有结构化反馈。 |
| [alembic/versions/20260720_0007_teacher_dsl_knowledge_graph.py](../../apps/api/alembic/versions/20260720_0007_teacher_dsl_knowledge_graph.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 建立教师图谱导入、变更集、评审及发布记录, 保存教学内容进入系统的证据链。 |
| [alembic/versions/20260721_0008_graph_learning_consumption.py](../../apps/api/alembic/versions/20260721_0008_graph_learning_consumption.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 记录图谱学习支持与交互, 使学生使用提示的行为能够被教师回放。 |
| [alembic/versions/20260721_0009_knowledge_graph_v2_learning.py](../../apps/api/alembic/versions/20260721_0009_knowledge_graph_v2_learning.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 扩展第二版图谱学习数据结构, 支持该版本的内容及教学关系。 |
| [alembic/versions/20260721_0010_knowledge_content_assets.py](../../apps/api/alembic/versions/20260721_0010_knowledge_content_assets.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 增加节点学习正文和媒体附件存储, 让图谱节点对应可维护的学习资料。 |
| [alembic/versions/20260721_0011_remove_learning_media_urls.py](../../apps/api/alembic/versions/20260721_0011_remove_learning_media_urls.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 移除旧的媒体链接字段, 将教学文件读取统一到受控附件流程。 |
| [alembic/versions/20260722_0012_zpd_learning_diagnostics.py](../../apps/api/alembic/versions/20260722_0012_zpd_learning_diagnostics.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 增加学习发展诊断相关数据, 保留各维度的支持需求与依据。 |
| [alembic/versions/20260726_0013_node_display_overrides.py](../../apps/api/alembic/versions/20260726_0013_node_display_overrides.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 增加节点显示名覆盖记录, 教师改短名时不污染专家原始事实。 |
| [alembic/versions/20260901_0014_expert_graph_v3.py](../../apps/api/alembic/versions/20260901_0014_expert_graph_v3.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 增加专家图谱第三版的事实快照、翻译和平台绑定, 分别追溯不同资料来源。 |
| [alembic/versions/20260903_0015_graph_learning_activities.py](../../apps/api/alembic/versions/20260903_0015_graph_learning_activities.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 增加节点浏览与学习完成事件, 将学习活动同正式课程通关分开。 |
| [alembic/versions/20260904_0016_graph_node_evidence.py](../../apps/api/alembic/versions/20260904_0016_graph_node_evidence.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 增加图谱节点学习证据的持久化支持, 保留评价与具体节点之间的关联。 |
| [alembic/versions/20260907_0017_avg_simulation.py](../../apps/api/alembic/versions/20260907_0017_avg_simulation.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 增加仿真会话、演出、生成请求和态势记录, 支持角色演出及历史回放。 |
| [alembic/versions/20260908_0018_document_correction.py](../../apps/api/alembic/versions/20260908_0018_document_correction.py) | 数据库迁移修订。Alembic 是本项目管理表结构版本的工具。本次变更: 增加信用证审改会话、批注、操作日志和确定性结果, 支持版本冲突检测和成绩回放。 |

## 后端基础 / __init__.py

| 文件 | 职责 |
| --- | --- |
| [app/__init__.py](../../apps/api/app/__init__.py) | 标识本目录为可导入的 Python 包。 |

## 后端基础 / cli.py

| 文件 | 职责 |
| --- | --- |
| [app/cli.py](../../apps/api/app/cli.py) | 提供开发账号、课程内容和班级的初始化命令。 |

## 后端基础 / core

| 文件 | 职责 |
| --- | --- |
| [app/core/__init__.py](../../apps/api/app/core/__init__.py) | 标识本目录为可导入的 Python 包。 |
| [app/core/config.py](../../apps/api/app/core/config.py) | 从环境变量和环境文件构造受校验的运行配置。 |
| [app/core/errors.py](../../apps/api/app/core/errors.py) | 将业务错误、参数校验错误和未捕获异常统一成 API 错误结构。 |
| [app/core/logging.py](../../apps/api/app/core/logging.py) | 设置统一日志输出并遮蔽常见敏感字段。 |
| [app/core/security.py](../../apps/api/app/core/security.py) | 提供密码散列、密码核验、随机令牌和令牌摘要。 |

## 后端基础 / db

| 文件 | 职责 |
| --- | --- |
| [app/db/__init__.py](../../apps/api/app/db/__init__.py) | 标识本目录为可导入的 Python 包。 |
| [app/db/base.py](../../apps/api/app/db/base.py) | 定义 SQLAlchemy 模型共用的声明基类。 |
| [app/db/session.py](../../apps/api/app/db/session.py) | 创建数据库引擎、会话工厂和每请求使用的 Session。 |
| [app/db/types.py](../../apps/api/app/db/types.py) | 提供模型默认时间所用的 UTC 时钟函数。 |

## 后端基础 / integrations

| 文件 | 职责 |
| --- | --- |
| [app/integrations/__init__.py](../../apps/api/app/integrations/__init__.py) | 标识本目录为可导入的 Python 包。 |
| [app/integrations/knowledge_graph/__init__.py](../../apps/api/app/integrations/knowledge_graph/__init__.py) | 标识本目录为可导入的 Python 包。 |
| [app/integrations/knowledge_graph/base.py](../../apps/api/app/integrations/knowledge_graph/base.py) | 定义图存储协议和图谱快照结构。 |
| [app/integrations/knowledge_graph/factory.py](../../apps/api/app/integrations/knowledge_graph/factory.py) | 根据配置选择 Neo4j、内存或不可用图存储。 |
| [app/integrations/knowledge_graph/memory.py](../../apps/api/app/integrations/knowledge_graph/memory.py) | 用内存字典实现图存储协议, 供测试或明确配置的内存模式使用。 |
| [app/integrations/knowledge_graph/neo4j.py](../../apps/api/app/integrations/knowledge_graph/neo4j.py) | 把版本化节点和关系写入 Neo4j, 并按版本读取。 |
| [app/integrations/knowledge_graph/unavailable.py](../../apps/api/app/integrations/knowledge_graph/unavailable.py) | 在图存储未启用或配置不足时提供明确失败的适配器。 |
| [app/integrations/llm/__init__.py](../../apps/api/app/integrations/llm/__init__.py) | 标识本目录为可导入的 Python 包。 |
| [app/integrations/llm/base.py](../../apps/api/app/integrations/llm/base.py) | 定义模型请求、响应、流片段、用量和供应商错误的公共协议。 |
| [app/integrations/llm/deepseek.py](../../apps/api/app/integrations/llm/deepseek.py) | 将统一模型协议转换成 DeepSeek HTTP 请求和流式响应。 |
| [app/integrations/llm/factory.py](../../apps/api/app/integrations/llm/factory.py) | 按运行配置创建模拟或 DeepSeek 模型适配器。 |
| [app/integrations/llm/mock.py](../../apps/api/app/integrations/llm/mock.py) | 为测试和本地演示生成固定形状的场景、对话与评价响应。 |
| [app/integrations/llm/prompt_renderer.py](../../apps/api/app/integrations/llm/prompt_renderer.py) | 将提示词模板中的命名占位符替换为业务变量。 |
| [app/integrations/llm/structured_output.py](../../apps/api/app/integrations/llm/structured_output.py) | 把模型文本解析为 JSON, 再按指定 Pydantic 结构校验。 |
| [app/integrations/streaming/__init__.py](../../apps/api/app/integrations/streaming/__init__.py) | 标识本目录为可导入的 Python 包。 |
| [app/integrations/streaming/sse.py](../../apps/api/app/integrations/streaming/sse.py) | 将事件名称与数据编码成 SSE 文本帧。 |

## 后端基础 / main.py

| 文件 | 职责 |
| --- | --- |
| [app/main.py](../../apps/api/app/main.py) | 组装 FastAPI 应用、依赖、路由、跨域策略和统一错误处理。 |

## 后端业务 / __init__.py

| 文件 | 职责 |
| --- | --- |
| [app/modules/__init__.py](../../apps/api/app/modules/__init__.py) | 标识本目录为可导入的 Python 包。 |

## 后端业务 / assessment

| 文件 | 职责 |
| --- | --- |
| [app/modules/assessment/__init__.py](../../apps/api/app/modules/assessment/__init__.py) | 标识"逐轮反馈与正式评价"Python 包。 |
| [app/modules/assessment/diagnostic.py](../../apps/api/app/modules/assessment/diagnostic.py) | 把学习诊断引用绑定到真实学生消息, 并在缺少终结诊断时聚合已校验的逐轮诊断;防止虚构学习证据。 |
| [app/modules/assessment/models.py](../../apps/api/app/modules/assessment/models.py) | 定义该业务的数据库实体、关联和约束。 |
| [app/modules/assessment/round_payload_repair.py](../../apps/api/app/modules/assessment/round_payload_repair.py) | 在仿真评价重试后仍存在可选扩展格式错误时保留有效核心反馈; 降级必须可识别,不能伪装成完整分析。 |
| [app/modules/assessment/round_service.py](../../apps/api/app/modules/assessment/round_service.py) | 生成逐轮反馈, 校验目标清单、知识候选和原话引用后入库; 重试修复评价结构, 不重复生成对话。 |
| [app/modules/assessment/schemas.py](../../apps/api/app/modules/assessment/schemas.py) | 定义该业务的请求、响应和结构化校验模型。 |
| [app/modules/assessment/service.py](../../apps/api/app/modules/assessment/service.py) | 基于冻结提交生成正式评价并更新完成进度; 失败保留提交, 允许之后重新评价而无需重做训练。 |
| [app/modules/assessment/structured_evaluation.py](../../apps/api/app/modules/assessment/structured_evaluation.py) | 约束正式评价结构、维度与引用, 并用服务端学生原话绑定证据; 模型给出的消息编号和评分不能直接信任。 |

## 后端业务 / auth

| 文件 | 职责 |
| --- | --- |
| [app/modules/auth/__init__.py](../../apps/api/app/modules/auth/__init__.py) | 标识"登录与角色授权"Python 包。 |
| [app/modules/auth/dependencies.py](../../apps/api/app/modules/auth/dependencies.py) | 从 Bearer 令牌还原登录会话, 再检查有效期、撤销状态和角色; 让接口无需各自重复实现认证。 |
| [app/modules/auth/models.py](../../apps/api/app/modules/auth/models.py) | 定义该业务的数据库实体、关联和约束。 |
| [app/modules/auth/repository.py](../../apps/api/app/modules/auth/repository.py) | 封装该业务使用的查询和持久化操作。 |
| [app/modules/auth/router.py](../../apps/api/app/modules/auth/router.py) | 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。 |
| [app/modules/auth/schemas.py](../../apps/api/app/modules/auth/schemas.py) | 定义该业务的请求、响应和结构化校验模型。 |
| [app/modules/auth/service.py](../../apps/api/app/modules/auth/service.py) | 协调登录、刷新和退出, 并轮换令牌; 失效或撤销会话不能继续换取新令牌。 |

## 后端业务 / classrooms

| 文件 | 职责 |
| --- | --- |
| [app/modules/classrooms/__init__.py](../../apps/api/app/modules/classrooms/__init__.py) | 标识"班级与学生加入关系"Python 包。 |
| [app/modules/classrooms/models.py](../../apps/api/app/modules/classrooms/models.py) | 定义该业务的数据库实体、关联和约束。 |

## 后端业务 / curriculum

| 文件 | 职责 |
| --- | --- |
| [app/modules/curriculum/__init__.py](../../apps/api/app/modules/curriculum/__init__.py) | 标识"版本化课程与小节"Python 包。 |
| [app/modules/curriculum/content_schemas.py](../../apps/api/app/modules/curriculum/content_schemas.py) | 定义课程 YAML 文件的校验结构; 在内容入库前发现字段或引用错误, 减少运行时才暴露的配置问题。 |
| [app/modules/curriculum/continuity.py](../../apps/api/app/modules/curriculum/continuity.py) | 把兼容旧版本的完成证据投影到当前课程显示, 以延续进度; 保留旧记录的原始版本绑定。 |
| [app/modules/curriculum/import_repository.py](../../apps/api/app/modules/curriculum/import_repository.py) | 集中查找和写入课程导入实体, 便于导入服务统一安排事务; 不要在单个小节处理中随意提前提交。 |
| [app/modules/curriculum/import_service.py](../../apps/api/app/modules/curriculum/import_service.py) | 读取并校验课程 YAML 后导入课程、提示词与评价量规; 以版本组织内容, 避免覆盖旧训练所依据的教学标准。 |
| [app/modules/curriculum/models.py](../../apps/api/app/modules/curriculum/models.py) | 定义该业务的数据库实体、关联和约束。 |
| [app/modules/curriculum/repository.py](../../apps/api/app/modules/curriculum/repository.py) | 封装该业务使用的查询和持久化操作。 |
| [app/modules/curriculum/router.py](../../apps/api/app/modules/curriculum/router.py) | 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。 |
| [app/modules/curriculum/schemas.py](../../apps/api/app/modules/curriculum/schemas.py) | 定义该业务的请求、响应和结构化校验模型。 |
| [app/modules/curriculum/service.py](../../apps/api/app/modules/curriculum/service.py) | 计算当前课程路线、小节详情和前置解锁状态; 将版本投影与实际训练记录组合, 保证页面状态有数据依据。 |

## 后端业务 / document_correction

| 文件 | 职责 |
| --- | --- |
| [app/modules/document_correction/annotation_service.py](../../apps/api/app/modules/document_correction/annotation_service.py) | 按字段管理改证批注与操作日志; 利用期望版本及操作摘要, 分别防止并发覆盖和重复请求产生不同结果。 |
| [app/modules/document_correction/creation_service.py](../../apps/api/app/modules/document_correction/creation_service.py) | 为信用证专用训练建立原证、案例、答案和规则的版本快照; 之后重放不应受源文件更新影响。 |
| [app/modules/document_correction/feedback_service.py](../../apps/api/app/modules/document_correction/feedback_service.py) | 在确定性评分后请求并校验个性化讲评; 将成绩与模型文字分开, 使讲评失败不改变通关结果。 |
| [app/modules/document_correction/grading_rules.py](../../apps/api/app/modules/document_correction/grading_rules.py) | 以纯本地规则规范化拟改值并计算定位、修改、依据得分和误报扣分; 相同快照输入可重复得到相同结果。 |
| [app/modules/document_correction/grading_service.py](../../apps/api/app/modules/document_correction/grading_service.py) | 按期望版本冻结审改单, 写入提交、评分、证据与进度; 这些相关记录在同一提交边界保存, 避免成绩与通关不同步。 |
| [app/modules/document_correction/health.py](../../apps/api/app/modules/document_correction/health.py) | 核对审改功能开关、数据库迁移和版本化资料是否就绪; 用于区分功能未启用与运行环境缺失。 |
| [app/modules/document_correction/models.py](../../apps/api/app/modules/document_correction/models.py) | 定义该业务的数据库实体、关联和约束。 |
| [app/modules/document_correction/profile_service.py](../../apps/api/app/modules/document_correction/profile_service.py) | 加载并校验审改资料及所需表结构; 拒绝缺失或不匹配的配置, 避免使用不完整标准答案评分。 |
| [app/modules/document_correction/router.py](../../apps/api/app/modules/document_correction/router.py) | 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。 |
| [app/modules/document_correction/schemas.py](../../apps/api/app/modules/document_correction/schemas.py) | 定义该业务的请求、响应和结构化校验模型。 |
| [app/modules/document_correction/support_service.py](../../apps/api/app/modules/document_correction/support_service.py) | 按提示层级提供审证学习支持并记录使用情况; 提示与答案评分是独立职责, 不能把提示访问当成通关。 |

## 后端业务 / knowledge_graph

| 文件 | 职责 |
| --- | --- |
| [app/modules/knowledge_graph/__init__.py](../../apps/api/app/modules/knowledge_graph/__init__.py) | 标识"教学知识图谱、学习内容与证据"Python 包。 |
| [app/modules/knowledge_graph/asset_response.py](../../apps/api/app/modules/knowledge_graph/asset_response.py) | 以内联、禁止缓存的响应发送受控视频或 PPTX; 权限已由内容服务检查, 避免浏览器长期缓存私有教学附件。 |
| [app/modules/knowledge_graph/compiler.py](../../apps/api/app/modules/knowledge_graph/compiler.py) | 把旧版教学 Excel 的案例、知识、策略和关系编译成统一图结构; 保留来源锚点便于回到原工作表核对。 |
| [app/modules/knowledge_graph/consumption_service.py](../../apps/api/app/modules/knowledge_graph/consumption_service.py) | 按当前发布版或训练绑定版本提供图谱、支持关系和基础学情; 历史训练优先沿其绑定版本读取。 |
| [app/modules/knowledge_graph/content_service.py](../../apps/api/app/modules/knowledge_graph/content_service.py) | 按图谱版本和节点保存正文与媒体附件; 学生内容读取必须过滤草稿, 文件上传还需验证大小、后缀和实际文件结构。 |
| [app/modules/knowledge_graph/contract.py](../../apps/api/app/modules/knowledge_graph/contract.py) | 定义工作簿表名、列名、编号及关系等模板契约。 |
| [app/modules/knowledge_graph/display_labels.py](../../apps/api/app/modules/knowledge_graph/display_labels.py) | 确定节点默认中文显示名并兼容旧版短名; 展示名称可以演进, 但稳定编号仍用于关联证据。 |
| [app/modules/knowledge_graph/display_service.py](../../apps/api/app/modules/knowledge_graph/display_service.py) | 以独立覆盖记录保存或恢复教师短名; 使用显示修订号检测冲突, 不修改图谱原始事实和模型提示内容。 |
| [app/modules/knowledge_graph/import_service.py](../../apps/api/app/modules/knowledge_graph/import_service.py) | 对上传工作簿做版本选择、解析、校验与编译, 并保存导入任务和变更集; 校验不通过的内容不能直接发布。 |
| [app/modules/knowledge_graph/insight_aggregation.py](../../apps/api/app/modules/knowledge_graph/insight_aggregation.py) | 从训练证据、学习事件和提示交互聚合节点及阶段学情; 按学生、训练和版本限定统计范围, 避免跨班级混入证据。 |
| [app/modules/knowledge_graph/insights_service.py](../../apps/api/app/modules/knowledge_graph/insights_service.py) | 为班级、指定学生或当前学生组织知识学情; 先确定访问者可见范围, 再调用聚合器补充统计。 |
| [app/modules/knowledge_graph/learning_activity_service.py](../../apps/api/app/modules/knowledge_graph/learning_activity_service.py) | 记录节点浏览与学习完成事件; 以客户端事件编号去重, 并核对节点属于当前或训练绑定的图谱版本。 |
| [app/modules/knowledge_graph/learning_evidence_service.py](../../apps/api/app/modules/knowledge_graph/learning_evidence_service.py) | 把逐轮评价推荐与学生原话关联为学习证据; 一轮评价的证据需可追溯到固定图谱版本, 不能发布新图后重新猜测映射。 |
| [app/modules/knowledge_graph/learning_router.py](../../apps/api/app/modules/knowledge_graph/learning_router.py) | 承接节点正文、附件及学习事件 HTTP 请求; 学生和教师的内容可见性不同, 必须保留各入口的角色校验。 |
| [app/modules/knowledge_graph/models.py](../../apps/api/app/modules/knowledge_graph/models.py) | 定义该业务的数据库实体、关联和约束。 |
| [app/modules/knowledge_graph/pi_migration.py](../../apps/api/app/modules/knowledge_graph/pi_migration.py) | 通过现有导入、评审和发布流程迁移 PI 十阶段分类; 只延续编辑内容与附件, 不挪动历史学生证据。 |
| [app/modules/knowledge_graph/pi_stages.py](../../apps/api/app/modules/knowledge_graph/pi_stages.py) | 将原专家图谱分类转换为 PI 十阶段结构; 先严格核对原始稳定编号, 再做语义拆分,保留归档工作簿。 |
| [app/modules/knowledge_graph/prompt_context.py](../../apps/api/app/modules/knowledge_graph/prompt_context.py) | 把固定图谱版本中的相关知识整理为模型上下文; 图谱辅助读取失败可按现有分支降级, 不能冒充已有完整图谱支持。 |
| [app/modules/knowledge_graph/recommendation_service.py](../../apps/api/app/modules/knowledge_graph/recommendation_service.py) | 建立本次训练可推荐的候选集合, 并校验模型选择与学生引用; 模型只能从固定候选中选重点。 |
| [app/modules/knowledge_graph/repository.py](../../apps/api/app/modules/knowledge_graph/repository.py) | 封装该业务使用的查询和持久化操作。 |
| [app/modules/knowledge_graph/review_service.py](../../apps/api/app/modules/knowledge_graph/review_service.py) | 推动变更集评审、批准、发布和回滚; 图数据库与 SQL 库没有共同事务, 因此发布失败需要显式补偿恢复。 |
| [app/modules/knowledge_graph/router.py](../../apps/api/app/modules/knowledge_graph/router.py) | 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。 |
| [app/modules/knowledge_graph/scaffold_service.py](../../apps/api/app/modules/knowledge_graph/scaffold_service.py) | 从训练绑定图谱生成固定学习支持库并记录提示使用; Scaffold 的内容由教学数据决定, 模型只选择关注项。 |
| [app/modules/knowledge_graph/schemas.py](../../apps/api/app/modules/knowledge_graph/schemas.py) | 定义该业务的请求、响应和结构化校验模型。 |
| [app/modules/knowledge_graph/types.py](../../apps/api/app/modules/knowledge_graph/types.py) | 定义解析和校验过程中使用的内部数据结构。 |
| [app/modules/knowledge_graph/v21_compiler.py](../../apps/api/app/modules/knowledge_graph/v21_compiler.py) | 编译 2.1 版工作簿并按节点关联学习内容; 沿用该版本契约而不是强行套用新版字段。 |
| [app/modules/knowledge_graph/v21_contract.py](../../apps/api/app/modules/knowledge_graph/v21_contract.py) | 定义 2.1 版专家知识点工作簿的字段契约。 |
| [app/modules/knowledge_graph/v21_validation.py](../../apps/api/app/modules/knowledge_graph/v21_validation.py) | 按 2.1 版知识点与学习内容契约校验工作簿; 校验问题保留表名和行列, 便于修改源数据。 |
| [app/modules/knowledge_graph/v2_compiler.py](../../apps/api/app/modules/knowledge_graph/v2_compiler.py) | 编译 2.0 版教师工作簿, 组织该版节点、学习内容和关系; 分版本实现避免新模板假设破坏旧数据。 |
| [app/modules/knowledge_graph/v2_contract.py](../../apps/api/app/modules/knowledge_graph/v2_contract.py) | 定义 2.0 版教师工作簿的表格契约。 |
| [app/modules/knowledge_graph/v2_validation.py](../../apps/api/app/modules/knowledge_graph/v2_validation.py) | 按 2.0 版模板校验必填字段、节点编号和引用; 只有满足该版本契约的数据才能进入编译。 |
| [app/modules/knowledge_graph/v3_compiler.py](../../apps/api/app/modules/knowledge_graph/v3_compiler.py) | 编译专家图谱并合并中文翻译和平台场景绑定; 英文专家事实、翻译与平台扩展分开,便于审计来源。 |
| [app/modules/knowledge_graph/v3_contract.py](../../apps/api/app/modules/knowledge_graph/v3_contract.py) | 定义 3.0 版专家图谱原始字段、关系与知识分类。 |
| [app/modules/knowledge_graph/v3_extensions.py](../../apps/api/app/modules/knowledge_graph/v3_extensions.py) | 定义专家图谱到平台课程场景的绑定配置; 平台关卡关联属于扩展, 不应改写专家原始节点。 |
| [app/modules/knowledge_graph/v3_validation.py](../../apps/api/app/modules/knowledge_graph/v3_validation.py) | 检查专家图谱的节点身份、分类和引用完整性; 翻译与平台扩展不能代替原始事实有效性校验。 |
| [app/modules/knowledge_graph/validation.py](../../apps/api/app/modules/knowledge_graph/validation.py) | 检查旧版教师工作簿中的字段、唯一编号、引用与教学完整性; 把错误定位到表格后再交给教师修正。 |
| [app/modules/knowledge_graph/xlsx_parser.py](../../apps/api/app/modules/knowledge_graph/xlsx_parser.py) | 直接解析 XLSX 压缩包中的工作表 XML, 并按模板版本转成统一行数据; 先做文件安全限制, 避免损坏或膨胀压缩包进入编译。 |

## 后端业务 / progress

| 文件 | 职责 |
| --- | --- |
| [app/modules/progress/__init__.py](../../apps/api/app/modules/progress/__init__.py) | 标识"可追溯的课程完成进度"Python 包。 |
| [app/modules/progress/models.py](../../apps/api/app/modules/progress/models.py) | 定义该业务的数据库实体、关联和约束。 |
| [app/modules/progress/router.py](../../apps/api/app/modules/progress/router.py) | 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。 |

## 后端业务 / simulation

| 文件 | 职责 |
| --- | --- |
| [app/modules/simulation/__init__.py](../../apps/api/app/modules/simulation/__init__.py) | 标识"带角色演出和态势的谈判仿真"Python 包。 |
| [app/modules/simulation/briefing_service.py](../../apps/api/app/modules/simulation/briefing_service.py) | 根据公开场景生成开场简报并验证事实引用; 模型失败时使用受控备用简报, 避免展示对手私有底牌。 |
| [app/modules/simulation/conversation_service.py](../../apps/api/app/modules/simulation/conversation_service.py) | 连接普通训练接口与仿真轮次生成、分析和返回; 复用已有训练记录, 避免两套训练历史分叉。 |
| [app/modules/simulation/models.py](../../apps/api/app/modules/simulation/models.py) | 定义该业务的数据库实体、关联和约束。 |
| [app/modules/simulation/presenter.py](../../apps/api/app/modules/simulation/presenter.py) | 把会话、演出与态势记录整理成前端响应; 显式组装公开字段, 避免将内部配置或私有信息整包返回。 |
| [app/modules/simulation/profile_service.py](../../apps/api/app/modules/simulation/profile_service.py) | 读取仿真配置和指定版本的提示词, 检查当前关卡是否支持仿真; 旧训练重放必须使用绑定版本。 |
| [app/modules/simulation/repository.py](../../apps/api/app/modules/simulation/repository.py) | 集中读取仿真演出、态势快照及事件, 并用数据库条件更新申请生成租约; 租约是有期限的生成占用, 防止并发轮次重复生成。 |
| [app/modules/simulation/router.py](../../apps/api/app/modules/simulation/router.py) | 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。 |
| [app/modules/simulation/schemas.py](../../apps/api/app/modules/simulation/schemas.py) | 定义该业务的请求、响应和结构化校验模型。 |
| [app/modules/simulation/service.py](../../apps/api/app/modules/simulation/service.py) | 提供学生与教师仿真读取及单独补做分析; 先检查训练归属, 重试分析复用已保存台词。 |
| [app/modules/simulation/state_rules.py](../../apps/api/app/modules/simulation/state_rules.py) | 将模型观察到的原话证据转换为确定性态势变化; 按事件规则、去重键和条款依赖决定接受或拒绝, 不能让模型直接决定指标数值。 |
| [app/modules/simulation/state_service.py](../../apps/api/app/modules/simulation/state_service.py) | 将规则计算的态势、接受或拒绝事件及版本快照落库; 保留重放所需证据, 并显式区分待分析、失败与就绪。 |
| [app/modules/simulation/turn_service.py](../../apps/api/app/modules/simulation/turn_service.py) | 生成并保存演出, 再运行逐轮评价与态势分析; 写入前后核对生成租约, 过期调用结果不能覆盖新轮次。 |
| [app/modules/simulation/validators.py](../../apps/api/app/modules/simulation/validators.py) | 验证仿真台词长度、格式、产品事实和私有信息边界; 模型结构正确也可能违反场景约束, 必须继续做语义检查。 |

## 后端业务 / teacher_analytics

| 文件 | 职责 |
| --- | --- |
| [app/modules/teacher_analytics/__init__.py](../../apps/api/app/modules/teacher_analytics/__init__.py) | 标识"教师班级管理、学情统计与训练回放"Python 包。 |
| [app/modules/teacher_analytics/competency.py](../../apps/api/app/modules/teacher_analytics/competency.py) | 按正式评价维度和引用证据汇总能力趋势; 使用结构化分数及证据数量, 不从自由文本猜测能力。 |
| [app/modules/teacher_analytics/roster_service.py](../../apps/api/app/modules/teacher_analytics/roster_service.py) | 处理学生新增、批量导入、编辑和移出班级; 导入先检查整批重复与既有账号冲突,再统一提交, 避免只导入半份名单。 |
| [app/modules/teacher_analytics/router.py](../../apps/api/app/modules/teacher_analytics/router.py) | 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。 |
| [app/modules/teacher_analytics/schemas.py](../../apps/api/app/modules/teacher_analytics/schemas.py) | 定义该业务的请求、响应和结构化校验模型。 |
| [app/modules/teacher_analytics/service.py](../../apps/api/app/modules/teacher_analytics/service.py) | 在教师班级权限范围内读取学生详情与单次训练回放; 历史证据标签按各自图谱版本还原。 |
| [app/modules/teacher_analytics/student_metrics.py](../../apps/api/app/modules/teacher_analytics/student_metrics.py) | 将学生完成记录、最近活动和风险提示组装成名册项; 有课程版本参数时按该版本约束进度, 避免混用不同课程。 |

## 后端业务 / technician

| 文件 | 职责 |
| --- | --- |
| [app/modules/technician/__init__.py](../../apps/api/app/modules/technician/__init__.py) | 标识"技术人员的模型运行配置"Python 包。 |
| [app/modules/technician/router.py](../../apps/api/app/modules/technician/router.py) | 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。 |
| [app/modules/technician/schemas.py](../../apps/api/app/modules/technician/schemas.py) | 定义该业务的请求、响应和结构化校验模型。 |
| [app/modules/technician/service.py](../../apps/api/app/modules/technician/service.py) | 构造脱敏模型配置响应并更新环境文件; 写入时保留未涉及配置, 不能把接口展示的脱敏值当成真实密钥回写。 |

## 后端业务 / training

| 文件 | 职责 |
| --- | --- |
| [app/modules/training/__init__.py](../../apps/api/app/modules/training/__init__.py) | 标识"一次训练从创建到提交的生命周期"Python 包。 |
| [app/modules/training/access.py](../../apps/api/app/modules/training/access.py) | 按学生身份读取其拥有的训练, 统一未找到与无权访问处理; 防止客户端替换训练编号读取他人记录。 |
| [app/modules/training/adaptive_learning.py](../../apps/api/app/modules/training/adaptive_learning.py) | 根据已保存的学习诊断组装对话支持与评价扩展提示; 诊断是证据驱动的辅助信息,不直接改动教学目标和评分标准。 |
| [app/modules/training/attempt_creation_service.py](../../apps/api/app/modules/training/attempt_creation_service.py) | 创建训练、绑定课程和图谱版本, 并校验生成场景; 用幂等请求识别网络重试, 避免同一次点击产生多条训练。 |
| [app/modules/training/conversation_service.py](../../apps/api/app/modules/training/conversation_service.py) | 处理非流式学生发言、对手回复和轮次反馈; 先保存学生输入, 使外部模型失败时仍可恢复。 |
| [app/modules/training/hashing.py](../../apps/api/app/modules/training/hashing.py) | 对结构化内容进行稳定序列化并计算摘要; 用于比较快照和幂等请求, 键顺序变化不应导致不同摘要。 |
| [app/modules/training/invocations.py](../../apps/api/app/modules/training/invocations.py) | 为普通与流式模型调用保存开始、完成、失败和用量记录; 模型出错也能追踪调用及所用提示词版本。 |
| [app/modules/training/models.py](../../apps/api/app/modules/training/models.py) | 定义该业务的数据库实体、关联和约束。 |
| [app/modules/training/presenter.py](../../apps/api/app/modules/training/presenter.py) | 把训练模型、公开场景、消息和评价转换成 API 响应; 明确选择公开字段, 避免场景私有底牌泄漏。 |
| [app/modules/training/recovery_service.py](../../apps/api/app/modules/training/recovery_service.py) | 保存训练草稿、列出历史并创建重练; 重练关联原记录, 保留旧过程与评价供比较回放。 |
| [app/modules/training/repository.py](../../apps/api/app/modules/training/repository.py) | 封装该业务使用的查询和持久化操作。 |
| [app/modules/training/router.py](../../apps/api/app/modules/training/router.py) | 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。 |
| [app/modules/training/schemas.py](../../apps/api/app/modules/training/schemas.py) | 定义该业务的请求、响应和结构化校验模型。 |
| [app/modules/training/service.py](../../apps/api/app/modules/training/service.py) | 作为训练业务门面协调创建、对话、正式提交和评价; 具体生命周期步骤拆到专门服务, 便于独立理解和验证。 |
| [app/modules/training/state.py](../../apps/api/app/modules/training/state.py) | 检查允许的训练状态迁移并生成事件记录; 集中限制状态跳转, 避免各入口随意把失败记录标为完成。 |
| [app/modules/training/streaming_context.py](../../apps/api/app/modules/training/streaming_context.py) | 在开始 SSE 前校验权限、消息幂等性并持久化消息上下文; 已完成回复直接重放, 仿真新轮次需先取得生成租约。 |
| [app/modules/training/streaming_service.py](../../apps/api/app/modules/training/streaming_service.py) | 按事件顺序发送消息增量、最终台词和评价结果; 对话、分析与图谱证据分开处理,辅助失败不抹掉已完成对话。 |
| [app/modules/training/submission_service.py](../../apps/api/app/modules/training/submission_service.py) | 冻结正式提交的消息、场景和版本绑定, 并启动评价状态; 同一提交键可重放结果,不同键不能重复提交同一训练。 |

## 后端业务 / workspaces

| 文件 | 职责 |
| --- | --- |
| [app/modules/workspaces/__init__.py](../../apps/api/app/modules/workspaces/__init__.py) | 标识"角色工作区入口检查"Python 包。 |
| [app/modules/workspaces/router.py](../../apps/api/app/modules/workspaces/router.py) | 提供该业务的 HTTP 入口并注入身份、数据库及服务依赖。 |

## 后端测试

| 文件 | 职责 |
| --- | --- |
| [tests/conftest.py](../../apps/api/tests/conftest.py) | 构造测试数据库、应用、登录用户及模型替身等公共夹具。 |
| [tests/test_auth.py](../../apps/api/tests/test_auth.py) | 回归验证登录、令牌刷新、退出和角色隔离。 |
| [tests/test_curriculum.py](../../apps/api/tests/test_curriculum.py) | 回归验证课程路线、小节详情与解锁规则。 |
| [tests/test_curriculum_continuity.py](../../apps/api/tests/test_curriculum_continuity.py) | 回归验证课程变更后兼容进度的显示与历史绑定保留。 |
| [tests/test_deepseek_provider.py](../../apps/api/tests/test_deepseek_provider.py) | 回归验证DeepSeek 响应解析、错误归类及流式协议。 |
| [tests/test_document_correction.py](../../apps/api/tests/test_document_correction.py) | 回归验证信用证批注、版本冲突、确定性评分和只读回放。 |
| [tests/test_evaluation_recovery.py](../../apps/api/tests/test_evaluation_recovery.py) | 回归验证评价失败后的恢复以及结构化输出修复。 |
| [tests/test_graph_node_learning_content.py](../../apps/api/tests/test_graph_node_learning_content.py) | 回归验证阶段、现象和知识节点独立内容及草稿可见性。 |
| [tests/test_knowledge_graph_import.py](../../apps/api/tests/test_knowledge_graph_import.py) | 回归验证Excel 导入、校验、评审、发布与回滚。 |
| [tests/test_knowledge_graph_learning_insights.py](../../apps/api/tests/test_knowledge_graph_learning_insights.py) | 回归验证学生和班级知识学情的证据聚合。 |
| [tests/test_knowledge_graph_phase2.py](../../apps/api/tests/test_knowledge_graph_phase2.py) | 回归验证图谱学习支持、推荐与证据消费。 |
| [tests/test_knowledge_graph_v2.py](../../apps/api/tests/test_knowledge_graph_v2.py) | 回归验证2.0 图谱契约的解析、校验与编译。 |
| [tests/test_knowledge_graph_v21.py](../../apps/api/tests/test_knowledge_graph_v21.py) | 回归验证2.1 图谱契约及学习内容关联。 |
| [tests/test_knowledge_graph_v3.py](../../apps/api/tests/test_knowledge_graph_v3.py) | 回归验证专家图谱事实、翻译和平台绑定的边界。 |
| [tests/test_lc_case_audit.py](../../apps/api/tests/test_lc_case_audit.py) | 回归验证信用证案例事实、期限和标准答案的一致性。 |
| [tests/test_migrations.py](../../apps/api/tests/test_migrations.py) | 回归验证数据库迁移链及新旧表结构兼容。 |
| [tests/test_pi_stages.py](../../apps/api/tests/test_pi_stages.py) | 回归验证PI 十阶段迁移、稳定编号与旧版本证据保留。 |
| [tests/test_simulation.py](../../apps/api/tests/test_simulation.py) | 回归验证仿真台词、生成租约、态势规则和失败恢复。 |
| [tests/test_system.py](../../apps/api/tests/test_system.py) | 回归验证应用健康检查、错误格式和跨域行为。 |
| [tests/test_teacher_technician.py](../../apps/api/tests/test_teacher_technician.py) | 回归验证教师班级范围、名册维护和技术人员配置权限。 |
| [tests/test_training_flow.py](../../apps/api/tests/test_training_flow.py) | 回归验证训练创建、对话、提交与正式评价的完整流程。 |

## 前端 / app

| 文件 | 职责 |
| --- | --- |
| [app/App.vue](../../apps/web/src/app/App.vue) | 应用最外层入口，将当前地址对应的页面放入 RouterView。 |
| [app/layouts/RoleWorkspaceLayout.vue](../../apps/web/src/app/layouts/RoleWorkspaceLayout.vue) | 学生、教师和技术人员共用的页面外框，提供导航、用户信息与退出入口。 |
| [app/router/index.ts](../../apps/web/src/app/router/index.ts) | 定义页面路由与角色守卫。 |
| [app/router/meta.d.ts](../../apps/web/src/app/router/meta.d.ts) | 定义本业务或运行环境的 TypeScript 类型。 |

## 前端 / env.d.ts

| 文件 | 职责 |
| --- | --- |
| [env.d.ts](../../apps/web/src/env.d.ts) | 定义本业务或运行环境的 TypeScript 类型。 |

## 前端 / features/auth

| 文件 | 职责 |
| --- | --- |
| [features/auth/api/authApi.ts](../../apps/web/src/features/auth/api/authApi.ts) | 封装本业务的后端接口路径、请求参数和响应类型。 |
| [features/auth/components/LoginForm.vue](../../apps/web/src/features/auth/components/LoginForm.vue) | 收集邮箱或学号与密码，并显示登录中的状态及错误。 |
| [features/auth/stores/auth.ts](../../apps/web/src/features/auth/stores/auth.ts) | 用 Pinia 保存登录者、令牌和浏览器会话，并处理登录、刷新及退出。 |
| [features/auth/types.ts](../../apps/web/src/features/auth/types.ts) | 定义本业务或运行环境的 TypeScript 类型。 |
| [features/auth/utils/roleNavigation.ts](../../apps/web/src/features/auth/utils/roleNavigation.ts) | 按用户角色选择角色首页。 |
| [features/auth/utils/sessionValidation.ts](../../apps/web/src/features/auth/utils/sessionValidation.ts) | 验证浏览器保存的登录会话数据形状。 |

## 前端 / features/curriculum

| 文件 | 职责 |
| --- | --- |
| [features/curriculum/api/curriculumApi.ts](../../apps/web/src/features/curriculum/api/curriculumApi.ts) | 封装本业务的后端接口路径、请求参数和响应类型。 |
| [features/curriculum/components/ChapterRoadmap.vue](../../apps/web/src/features/curriculum/components/ChapterRoadmap.vue) | 按章节展示课程小节、解锁状态以及继续训练入口。 |
| [features/curriculum/components/CourseProgressHeader.vue](../../apps/web/src/features/curriculum/components/CourseProgressHeader.vue) | 展示课程名称、已完成小节数和总体进度。 |
| [features/curriculum/composables/useCourseMap.ts](../../apps/web/src/features/curriculum/composables/useCourseMap.ts) | 读取当前学生的课程路线并暴露加载与失败状态。 |
| [features/curriculum/composables/useUnitDetail.ts](../../apps/web/src/features/curriculum/composables/useUnitDetail.ts) | 从当前路由读取小节详情与训练准备信息。 |
| [features/curriculum/types.ts](../../apps/web/src/features/curriculum/types.ts) | 定义本业务或运行环境的 TypeScript 类型。 |

## 前端 / features/document-correction

| 文件 | 职责 |
| --- | --- |
| [features/document-correction/api/documentCorrectionApi.ts](../../apps/web/src/features/document-correction/api/documentCorrectionApi.ts) | 封装本业务的后端接口路径、请求参数和响应类型。 |
| [features/document-correction/components/ContractBriefPanel.vue](../../apps/web/src/features/document-correction/components/ContractBriefPanel.vue) | 把信用证审改所需的合同事实按成交主体、价款、装运、期限和单据分组呈现。 |
| [features/document-correction/components/CorrectionEditor.vue](../../apps/web/src/features/document-correction/components/CorrectionEditor.vue) | 编辑选中信用证字段的改证意见，包括问题类型、合同依据与拟改值。 |
| [features/document-correction/components/CorrectionHealth.vue](../../apps/web/src/features/document-correction/components/CorrectionHealth.vue) | 在技术人员工作区展示信用证审改功能的环境检查结果。 |
| [features/document-correction/components/CorrectionResultCompare.vue](../../apps/web/src/features/document-correction/components/CorrectionResultCompare.vue) | 展示信用证审改成绩，以及原证、学生意见和标准意见的对照。 |
| [features/document-correction/components/LcCorrectionWorkspace.vue](../../apps/web/src/features/document-correction/components/LcCorrectionWorkspace.vue) | 信用证审改总工作台，组织合同简报、原证、审改单、学习支持和结果对照。 |
| [features/document-correction/components/Mt700ReviewCopy.vue](../../apps/web/src/features/document-correction/components/Mt700ReviewCopy.vue) | 按 MT700 风格展示只读信用证样张，并允许选择字段查看或标记疑点。 |
| [features/document-correction/composables/useDocumentCorrection.ts](../../apps/web/src/features/document-correction/composables/useDocumentCorrection.ts) | 管理信用证批注草稿、自动保存、版本冲突与正式提交。 |
| [features/document-correction/labels.ts](../../apps/web/src/features/document-correction/labels.ts) | 将信用证事实编号、输入项和值转换为中文显示。 |
| [features/document-correction/types.ts](../../apps/web/src/features/document-correction/types.ts) | 定义本业务或运行环境的 TypeScript 类型。 |

## 前端 / features/evaluation

| 文件 | 职责 |
| --- | --- |
| [features/evaluation/components/EvaluationRadarChart.vue](../../apps/web/src/features/evaluation/components/EvaluationRadarChart.vue) | 用 SVG 雷达图展示正式评价中的各维度分数。 |
| [features/evaluation/components/EvaluationResultView.vue](../../apps/web/src/features/evaluation/components/EvaluationResultView.vue) | 组织正式评价的综合结论、能力雷达图、维度得分和引用证据。 |

## 前端 / features/knowledge-graph

| 文件 | 职责 |
| --- | --- |
| [features/knowledge-graph/api/knowledgeGraphLearningApi.ts](../../apps/web/src/features/knowledge-graph/api/knowledgeGraphLearningApi.ts) | 封装本业务的后端接口路径、请求参数和响应类型。 |
| [features/knowledge-graph/components/AttemptLiveKnowledgeGraph.vue](../../apps/web/src/features/knowledge-graph/components/AttemptLiveKnowledgeGraph.vue) | 把本次训练的固定支持库与最新一轮评价组合成局部知识图。 |
| [features/knowledge-graph/components/ContextKnowledgeGraph.vue](../../apps/web/src/features/knowledge-graph/components/ContextKnowledgeGraph.vue) | 共用的局部知识图容器，组合标题、画布、图例和节点详情弹窗。 |
| [features/knowledge-graph/components/EvaluationKnowledgeGraph.vue](../../apps/web/src/features/knowledge-graph/components/EvaluationKnowledgeGraph.vue) | 在学生评价页切换逐轮回放与知识缺口视图。 |
| [features/knowledge-graph/components/EvaluationLearningPath.vue](../../apps/web/src/features/knowledge-graph/components/EvaluationLearningPath.vue) | 从多轮评价推荐中整理最多六项后续学习入口。 |
| [features/knowledge-graph/components/GraphNodeDialog.vue](../../apps/web/src/features/knowledge-graph/components/GraphNodeDialog.vue) | 展示节点摘要、属性、相邻节点及学习内容入口，教师还可编辑节点短名。 |
| [features/knowledge-graph/components/KnowledgeEvidenceReplay.vue](../../apps/web/src/features/knowledge-graph/components/KnowledgeEvidenceReplay.vue) | 供教师查看学生查看提示、使用提示及图谱评价证据的记录。 |
| [features/knowledge-graph/components/KnowledgeGraphCanvas.vue](../../apps/web/src/features/knowledge-graph/components/KnowledgeGraphCanvas.vue) | 封装 Cytoscape 图形引擎，负责知识图的绘制、缩放、节点选择和鼠标聚焦。 |
| [features/knowledge-graph/components/KnowledgeGraphExplorer.vue](../../apps/web/src/features/knowledge-graph/components/KnowledgeGraphExplorer.vue) | 学生和教师共用的图谱浏览器，提供阶段、节点类型、知识分类与文字搜索筛选。 |
| [features/knowledge-graph/components/KnowledgeGraphOutline.vue](../../apps/web/src/features/knowledge-graph/components/KnowledgeGraphOutline.vue) | 将图谱转换成可逐级展开的文字目录，辅助阅读阶段、现象与知识关系。 |
| [features/knowledge-graph/components/KnowledgeGraphOverlayLegend.vue](../../apps/web/src/features/knowledge-graph/components/KnowledgeGraphOverlayLegend.vue) | 说明知识图中的颜色和标记含义。 |
| [features/knowledge-graph/components/KnowledgeGraphPhaseView.vue](../../apps/web/src/features/knowledge-graph/components/KnowledgeGraphPhaseView.vue) | 在训练、评价和学情页面复用完整阶段图的外框。 |
| [features/knowledge-graph/components/KnowledgeInsightPanel.vue](../../apps/web/src/features/knowledge-graph/components/KnowledgeInsightPanel.vue) | 教师学情面板，汇总证据覆盖情况、知识薄弱项及现象统计。 |
| [features/knowledge-graph/components/KnowledgeNodeContextGraph.vue](../../apps/web/src/features/knowledge-graph/components/KnowledgeNodeContextGraph.vue) | 在学习内容页展示当前节点处于哪一段知识关系中。 |
| [features/knowledge-graph/components/LearningAssetUploader.vue](../../apps/web/src/features/knowledge-graph/components/LearningAssetUploader.vue) | 让教师选择或移除节点的视频、PPTX 附件，并在上传前提示格式与大小问题。 |
| [features/knowledge-graph/components/LearningMediaGallery.vue](../../apps/web/src/features/knowledge-graph/components/LearningMediaGallery.vue) | 从节点附件中选择视频和幻灯片，组织页面内的媒体预览。 |
| [features/knowledge-graph/components/LearningPptxViewer.vue](../../apps/web/src/features/knowledge-graph/components/LearningPptxViewer.vue) | 通过 VueOfficePptx 在学习页面预览受控的 PPTX 附件。 |
| [features/knowledge-graph/components/LearningVideoPlayer.vue](../../apps/web/src/features/knowledge-graph/components/LearningVideoPlayer.vue) | 使用 Video.js 播放节点上传的视频。 |
| [features/knowledge-graph/components/LiveKnowledgeCompass.vue](../../apps/web/src/features/knowledge-graph/components/LiveKnowledgeCompass.vue) | 训练过程中的知识罗盘，把最新推荐标到完整流程图上。 |
| [features/knowledge-graph/components/MarkdownLearningContent.vue](../../apps/web/src/features/knowledge-graph/components/MarkdownLearningContent.vue) | 将简化 Markdown 正文显示为标题、段落、引用和列表行。 |
| [features/knowledge-graph/components/NodeShortNameEditor.vue](../../apps/web/src/features/knowledge-graph/components/NodeShortNameEditor.vue) | 供教师编辑节点显示短名或恢复默认名称。 |
| [features/knowledge-graph/components/StudentKnowledgeProfileGraph.vue](../../apps/web/src/features/knowledge-graph/components/StudentKnowledgeProfileGraph.vue) | 把学生累计学习与训练证据叠加到知识图上。 |
| [features/knowledge-graph/components/StudentKnowledgeProgress.vue](../../apps/web/src/features/knowledge-graph/components/StudentKnowledgeProgress.vue) | 在学生首页展示知识学习概况及值得优先学习的条目。 |
| [features/knowledge-graph/components/TeacherAttemptKnowledgeGraph.vue](../../apps/web/src/features/knowledge-graph/components/TeacherAttemptKnowledgeGraph.vue) | 教师查看单次训练时，用图谱回放每轮评价对应的学习证据。 |
| [features/knowledge-graph/components/TeacherKnowledgeAnalyticsGraph.vue](../../apps/web/src/features/knowledge-graph/components/TeacherKnowledgeAnalyticsGraph.vue) | 把教师学情数据切换为综合表现、局面风险、知识掌握或教学缺口视图。 |
| [features/knowledge-graph/components/TrainingKnowledgeScaffold.vue](../../apps/web/src/features/knowledge-graph/components/TrainingKnowledgeScaffold.vue) | 展示当前训练固定的现象、知识、策略和分层提示，供学生随时查阅。 |
| [features/knowledge-graph/components/TrainingSupportFocus.vue](../../apps/web/src/features/knowledge-graph/components/TrainingSupportFocus.vue) | 将当前商务现象与本轮推荐知识并排呈现，形成聚焦的学习支持区。 |
| [features/knowledge-graph/composables/useAttemptScaffold.ts](../../apps/web/src/features/knowledge-graph/composables/useAttemptScaffold.ts) | 读取本次训练的固定支持库，并记录查看或使用提示的行为。 |
| [features/knowledge-graph/composables/useKnowledgeInsights.ts](../../apps/web/src/features/knowledge-graph/composables/useKnowledgeInsights.ts) | 按教师选择的班级或学生范围读取知识学情。 |
| [features/knowledge-graph/composables/useLearningActivity.ts](../../apps/web/src/features/knowledge-graph/composables/useLearningActivity.ts) | 记录当前节点的浏览和学习完成事件。 |
| [features/knowledge-graph/composables/useLearningAssetFile.ts](../../apps/web/src/features/knowledge-graph/composables/useLearningAssetFile.ts) | 带身份读取视频或幻灯片，并提供 Blob、二进制数据及临时对象地址。 |
| [features/knowledge-graph/composables/useLearningContent.ts](../../apps/web/src/features/knowledge-graph/composables/useLearningContent.ts) | 分别管理学生学习正文与教师编辑表单、发布状态和附件操作。 |
| [features/knowledge-graph/composables/useStudentKnowledgeGraph.ts](../../apps/web/src/features/knowledge-graph/composables/useStudentKnowledgeGraph.ts) | 读取学生可见图谱，传入训练编号时读取该训练绑定版本。 |
| [features/knowledge-graph/composables/useStudentKnowledgeInsights.ts](../../apps/web/src/features/knowledge-graph/composables/useStudentKnowledgeInsights.ts) | 读取当前登录学生的知识学习概况。 |
| [features/knowledge-graph/composables/useTeacherKnowledgeGraph.ts](../../apps/web/src/features/knowledge-graph/composables/useTeacherKnowledgeGraph.ts) | 读取教师图谱，并提供节点短名保存、恢复和局部显示更新。 |
| [features/knowledge-graph/contextLayout.ts](../../apps/web/src/features/knowledge-graph/contextLayout.ts) | 计算单节点附近局部知识图的布局坐标。 |
| [features/knowledge-graph/graphElements.ts](../../apps/web/src/features/knowledge-graph/graphElements.ts) | 把业务图谱和高亮信息转换为 Cytoscape 节点、边及样式数据。 |
| [features/knowledge-graph/graphInteraction.ts](../../apps/web/src/features/knowledge-graph/graphInteraction.ts) | 实现鼠标近邻选择、焦点范围与移动走廊的几何判断。 |
| [features/knowledge-graph/graphOverlay.ts](../../apps/web/src/features/knowledge-graph/graphOverlay.ts) | 把支持库、评价推荐和学情数据转换为知识图高亮。 |
| [features/knowledge-graph/graphPhaseOverlay.ts](../../apps/web/src/features/knowledge-graph/graphPhaseOverlay.ts) | 构造简报、训练罗盘、回放与学情阶段所用高亮层。 |
| [features/knowledge-graph/graphPresentation.ts](../../apps/web/src/features/knowledge-graph/graphPresentation.ts) | 统一节点归属阶段、显示标签及视图模式等呈现规则。 |
| [features/knowledge-graph/graphStyles.ts](../../apps/web/src/features/knowledge-graph/graphStyles.ts) | 定义 Cytoscape 图形样式与各类高亮的视觉规则。 |
| [features/knowledge-graph/index.ts](../../apps/web/src/features/knowledge-graph/index.ts) | 集中导出该使用场景的组件、组合函数与类型。 |
| [features/knowledge-graph/panoramaLayout.ts](../../apps/web/src/features/knowledge-graph/panoramaLayout.ts) | 计算完整知识图的阶段、现象及知识节点坐标。 |
| [features/knowledge-graph/teacherEvidence.ts](../../apps/web/src/features/knowledge-graph/teacherEvidence.ts) | 集中导出该使用场景的组件、组合函数与类型。 |
| [features/knowledge-graph/teacherGraph.ts](../../apps/web/src/features/knowledge-graph/teacherGraph.ts) | 集中导出该使用场景的组件、组合函数与类型。 |
| [features/knowledge-graph/teacherInsights.ts](../../apps/web/src/features/knowledge-graph/teacherInsights.ts) | 集中导出该使用场景的组件、组合函数与类型。 |
| [features/knowledge-graph/types.ts](../../apps/web/src/features/knowledge-graph/types.ts) | 定义本业务或运行环境的 TypeScript 类型。 |

## 前端 / features/simulation

| 文件 | 职责 |
| --- | --- |
| [features/simulation/api/simulationApi.ts](../../apps/web/src/features/simulation/api/simulationApi.ts) | 封装本业务的后端接口路径、请求参数和响应类型。 |
| [features/simulation/components/BriefingPlayer.vue](../../apps/web/src/features/simulation/components/BriefingPlayer.vue) | 以逐段文字演出或摘要方式呈现仿真开场简报。 |
| [features/simulation/components/CharacterStage.vue](../../apps/web/src/features/simulation/components/CharacterStage.vue) | 显示仿真场景背景及与角色表情、动作对应的立绘。 |
| [features/simulation/components/DialogueBox.vue](../../apps/web/src/features/simulation/components/DialogueBox.vue) | 呈现当前仿真轮次中的逐段对话，并提供键盘推进与全部显示。 |
| [features/simulation/components/NegotiationStatusBar.vue](../../apps/web/src/features/simulation/components/NegotiationStatusBar.vue) | 展示仿真谈判态势、里程碑与可展开的原话证据。 |
| [features/simulation/components/SimulationTranscript.vue](../../apps/web/src/features/simulation/components/SimulationTranscript.vue) | 在仿真工作台中展示完整文字对话记录。 |
| [features/simulation/components/SimulationWorkspace.vue](../../apps/web/src/features/simulation/components/SimulationWorkspace.vue) | 仿真训练总界面，组合角色舞台、逐段对话、输入框、态势栏和学习支持。 |
| [features/simulation/composables/useDialoguePlayback.ts](../../apps/web/src/features/simulation/composables/useDialoguePlayback.ts) | 管理一轮演出的段落索引、逐字显示和阅读完成状态。 |
| [features/simulation/composables/useSimulationAssets.ts](../../apps/web/src/features/simulation/composables/useSimulationAssets.ts) | 根据资源配置提供背景、头像和表情立绘地址。 |
| [features/simulation/composables/useSimulationSession.ts](../../apps/web/src/features/simulation/composables/useSimulationSession.ts) | 管理仿真会话、逐轮演出和最新谈判态势。 |
| [features/simulation/composables/useTypewriter.ts](../../apps/web/src/features/simulation/composables/useTypewriter.ts) | 按可见字符逐步显示台词，并支持直接显示完整当前文本。 |
| [features/simulation/index.ts](../../apps/web/src/features/simulation/index.ts) | 集中导出该使用场景的组件、组合函数与类型。 |
| [features/simulation/types.ts](../../apps/web/src/features/simulation/types.ts) | 定义本业务或运行环境的 TypeScript 类型。 |

## 前端 / features/teacher-dashboard

| 文件 | 职责 |
| --- | --- |
| [features/teacher-dashboard/api/teacherApi.ts](../../apps/web/src/features/teacher-dashboard/api/teacherApi.ts) | 封装本业务的后端接口路径、请求参数和响应类型。 |
| [features/teacher-dashboard/components/LearnerDevelopmentDiagnostic.vue](../../apps/web/src/features/teacher-dashboard/components/LearnerDevelopmentDiagnostic.vue) | 展示学习者发展诊断，帮助教师查看当前表现、支持需求与建议。 |
| [features/teacher-dashboard/types.ts](../../apps/web/src/features/teacher-dashboard/types.ts) | 定义本业务或运行环境的 TypeScript 类型。 |

## 前端 / features/technician

| 文件 | 职责 |
| --- | --- |
| [features/technician/api/knowledgeGraphApi.ts](../../apps/web/src/features/technician/api/knowledgeGraphApi.ts) | 封装本业务的后端接口路径、请求参数和响应类型。 |
| [features/technician/api/technicianApi.ts](../../apps/web/src/features/technician/api/technicianApi.ts) | 封装本业务的后端接口路径、请求参数和响应类型。 |
| [features/technician/components/KnowledgeGraphImportPanel.vue](../../apps/web/src/features/technician/components/KnowledgeGraphImportPanel.vue) | 技术人员导入教学图谱的操作面板，覆盖模板下载、校验、预览、评审、发布与回滚。 |
| [features/technician/components/LlmConfigPanel.vue](../../apps/web/src/features/technician/components/LlmConfigPanel.vue) | 技术人员维护场景生成、模拟对话和评价三类模型配置的面板。 |
| [features/technician/components/TeachingPreviewPanel.vue](../../apps/web/src/features/technician/components/TeachingPreviewPanel.vue) | 预览图谱导入结果中的教学案例与教学内容。 |
| [features/technician/composables/useKnowledgeGraphImport.ts](../../apps/web/src/features/technician/composables/useKnowledgeGraphImport.ts) | 组织图谱模板下载、导入、校验、评审、发布与回滚的页面状态。 |
| [features/technician/types/knowledgeGraph.ts](../../apps/web/src/features/technician/types/knowledgeGraph.ts) | 定义本业务或运行环境的 TypeScript 类型。 |

## 前端 / features/training

| 文件 | 职责 |
| --- | --- |
| [features/training/api/trainingApi.ts](../../apps/web/src/features/training/api/trainingApi.ts) | 封装本业务的后端接口路径、请求参数和响应类型。 |
| [features/training/components/AttemptHistoryList.vue](../../apps/web/src/features/training/components/AttemptHistoryList.vue) | 显示学生历史训练及继续训练、重开或查看评价的入口。 |
| [features/training/components/AutosaveIndicator.vue](../../apps/web/src/features/training/components/AutosaveIndicator.vue) | 将草稿保存或消息处理状态转成简洁的中文提示。 |
| [features/training/components/ConversationTimeline.vue](../../apps/web/src/features/training/components/ConversationTimeline.vue) | 展示对话消息及对应轮次反馈，并在教师回放时支持选择轮次。 |
| [features/training/components/DocumentReviewWorkspace.vue](../../apps/web/src/features/training/components/DocumentReviewWorkspace.vue) | 为普通单证审阅训练配置专用标题与输入提示。 |
| [features/training/components/EmailWorkspace.vue](../../apps/web/src/features/training/components/EmailWorkspace.vue) | 为商务邮件训练配置专用工作台标题和邮件输入提示。 |
| [features/training/components/MessageComposer.vue](../../apps/web/src/features/training/components/MessageComposer.vue) | 训练文本输入框，负责草稿编辑及调用发送回调。 |
| [features/training/components/NegotiationWorkspace.vue](../../apps/web/src/features/training/components/NegotiationWorkspace.vue) | 谈判模式下的工作台入口，使用通用训练布局。 |
| [features/training/components/RoundFeedbackCard.vue](../../apps/web/src/features/training/components/RoundFeedbackCard.vue) | 显示单轮回复后的评价反馈、优点、不足与下一步建议。 |
| [features/training/components/ScenarioBrief.vue](../../apps/web/src/features/training/components/ScenarioBrief.vue) | 展示本次训练的公开场景、角色与任务约束。 |
| [features/training/components/SubmitAttemptDialog.vue](../../apps/web/src/features/training/components/SubmitAttemptDialog.vue) | 正式提交训练前的确认对话框。 |
| [features/training/components/TrainingChecklist.vue](../../apps/web/src/features/training/components/TrainingChecklist.vue) | 展示训练目标检查结果及相关知识支持。 |
| [features/training/components/TrainingWorkspaceShell.vue](../../apps/web/src/features/training/components/TrainingWorkspaceShell.vue) | 文字训练共用布局，组合场景简报、对话时间线、输入框和目标辅助区。 |
| [features/training/composables/useAttempt.ts](../../apps/web/src/features/training/composables/useAttempt.ts) | 管理一次训练的加载、草稿、消息流、提交及重试。 |
| [features/training/composables/useAttemptDraft.ts](../../apps/web/src/features/training/composables/useAttemptDraft.ts) | 管理训练草稿的恢复和延迟自动保存。 |
| [features/training/composables/useAttemptHistory.ts](../../apps/web/src/features/training/composables/useAttemptHistory.ts) | 读取当前学生的训练历史，提供加载、失败和重试状态。 |
| [features/training/composables/useStartAttempt.ts](../../apps/web/src/features/training/composables/useStartAttempt.ts) | 创建小节训练并导航到简报或信用证工作台。 |
| [features/training/types.ts](../../apps/web/src/features/training/types.ts) | 定义本业务或运行环境的 TypeScript 类型。 |

## 前端 / features/workspace

| 文件 | 职责 |
| --- | --- |
| [features/workspace/components/WorkspaceStatus.vue](../../apps/web/src/features/workspace/components/WorkspaceStatus.vue) | 显示角色工作区与服务连接检查的状态。 |
| [features/workspace/composables/useWorkspaceProbe.ts](../../apps/web/src/features/workspace/composables/useWorkspaceProbe.ts) | 调用对应角色工作区入口检查当前登录者是否能进入。 |

## 前端 / main.ts

| 文件 | 职责 |
| --- | --- |
| [main.ts](../../apps/web/src/main.ts) | 初始化 Vue 应用、全局状态、路由与共享样式。 |

## 前端 / pages

| 文件 | 职责 |
| --- | --- |
| [pages/ForbiddenPage.vue](../../apps/web/src/pages/ForbiddenPage.vue) | 用户访问无权限页面时显示拒绝访问提示和返回入口。 |
| [pages/LoginPage.vue](../../apps/web/src/pages/LoginPage.vue) | 登录页面，组合品牌介绍、登录表单和登录后的角色跳转。 |
| [pages/student/AttemptBriefingPage.vue](../../apps/web/src/pages/student/AttemptBriefingPage.vue) | 训练开始前展示局面简报，并按体验模式提供文字或仿真开场。 |
| [pages/student/EvaluationPage.vue](../../apps/web/src/pages/student/EvaluationPage.vue) | 学生正式评价页，组织加载、失败重试、评价内容和后续学习入口。 |
| [pages/student/StudentHomePage.vue](../../apps/web/src/pages/student/StudentHomePage.vue) | 学生学习首页，组合课程进度、章节路线、知识概况与历史训练。 |
| [pages/student/StudentKnowledgeContentPage.vue](../../apps/web/src/pages/student/StudentKnowledgeContentPage.vue) | 学生节点学习页，展示正文、视频、PPTX、节点位置与学习完成入口。 |
| [pages/student/StudentKnowledgeGraphPage.vue](../../apps/web/src/pages/student/StudentKnowledgeGraphPage.vue) | 学生完整知识图谱页面，供浏览已发布的教学关系。 |
| [pages/student/TrainingWorkspacePage.vue](../../apps/web/src/pages/student/TrainingWorkspacePage.vue) | 统一的学生训练路由页面，选择文字、仿真或信用证审改工作台。 |
| [pages/student/UnitPreparationPage.vue](../../apps/web/src/pages/student/UnitPreparationPage.vue) | 开始训练前展示小节目标、规则，并让学生选择难度和支持的体验方式。 |
| [pages/teacher/TeacherAttemptReplayPage.vue](../../apps/web/src/pages/teacher/TeacherAttemptReplayPage.vue) | 教师查看学生单次训练的场景、完整对话、知识证据、仿真态势与正式评价。 |
| [pages/teacher/TeacherHomePage.vue](../../apps/web/src/pages/teacher/TeacherHomePage.vue) | 教师班级首页，提供学情概览、知识分析、学生筛选和名册维护。 |
| [pages/teacher/TeacherKnowledgeContentPage.vue](../../apps/web/src/pages/teacher/TeacherKnowledgeContentPage.vue) | 教师编辑节点学习内容的页面，包含标题、摘要、Markdown、发布状态与媒体附件。 |
| [pages/teacher/TeacherKnowledgeGraphPage.vue](../../apps/web/src/pages/teacher/TeacherKnowledgeGraphPage.vue) | 教师浏览教学图谱并维护节点显示短名的页面。 |
| [pages/teacher/TeacherStudentDetailPage.vue](../../apps/web/src/pages/teacher/TeacherStudentDetailPage.vue) | 教师查看单个学生的学习进度、能力证据、知识概况与训练列表。 |
| [pages/technician/TechnicianHomePage.vue](../../apps/web/src/pages/technician/TechnicianHomePage.vue) | 技术工作区首页，汇集模型配置、图谱导入和信用证环境检查。 |

## 前端 / shared

| 文件 | 职责 |
| --- | --- |
| [shared/api/http.ts](../../apps/web/src/shared/api/http.ts) | 提供带 Bearer 令牌的 JSON 和二进制请求及统一错误解析。 |
| [shared/utils/confirmation.ts](../../apps/web/src/shared/utils/confirmation.ts) | 封装浏览器确认行为供业务操作复用。 |
| [shared/utils/download.ts](../../apps/web/src/shared/utils/download.ts) | 将收到的二进制文件交给浏览器下载。 |
| [shared/utils/id.ts](../../apps/web/src/shared/utils/id.ts) | 生成客户端操作编号。 |
