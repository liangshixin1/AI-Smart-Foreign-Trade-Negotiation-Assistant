# Beta 2 开发路线图

## ✅ 已完成（Beta 2）

### 知识图谱系统
- ✅ Neo4j从云端迁移到Docker本地部署
- ✅ 知识点模型增强（1个→25+个属性）
- ✅ 完整的Web UI管理界面（13个API端点）
- ✅ Excel批量导入导出功能
- ✅ AntV G6图谱可视化（替换ECharts）
- ✅ 三级知识分类体系
- ✅ 知识点关系管理（前置依赖、关联）
- ✅ Word教材自动解析生成知识点草稿
- ✅ DeepSeek精排知识点匹配
- ✅ RAG风格轻量匹配（Beta）

### 前端架构
- ✅ 管理端JavaScript模块化（8个独立文件）
- ✅ 知识图谱管理UI (56KB graph-knowledge.js)
- ✅ 理论课时富文本编辑器
- ✅ 学生端知识点展示与匹配

### 核心功能
- ✅ 10章关卡式训练系统
- ✅ 3档难度系统
- ✅ DeepSeek多模型协同（5个API Key隔离）
- ✅ 流式对话支持
- ✅ 作业管理与成绩导出
- ✅ 学生名册批量导入

---

## 🚀 近期优化（1-2周）

### 知识图谱增强
- [ ] 接入真实向量库（PGVector/FAISS/Weaviate）
  - 替换`rag_matcher.py`中的简单token重叠算法
  - 实现基于向量嵌入的语义匹配
  - 支持跨文档知识点检索

- [ ] 异步任务队列（Celery/RQ）
  - 为`/api/admin/theory/import-docx/drafts`增加后台任务
  - 分批调用LLM生成草稿，实时更新job进度
  - 避免HTTP请求超时

- [ ] 关系草稿审核流程
  - 生成`relationship_drafts`表
  - API端点：`POST /api/graph/relationship-drafts`
  - 前端界面：关系草稿列表，支持编辑/批量通过
  - 审核通过后写入Neo4j的REQUIRES/RELATED_TO关系

- [ ] 知识图谱去重/合并
  - LLM聚类分析相似知识点
  - 提供合并建议界面
  - 支持手动合并或自动合并

### 用户体验
- [ ] 悬浮按钮优化
  - 完善或移除智能匹配悬浮按钮
  - 保证主按钮功能完整可用

- [ ] 知识卡插入优化
  - AI推荐插入位置（基于上下文语义）
  - 一键接受插入建议
  - 批量插入多个知识卡

### 文档与监控
- [ ] LLM输入输出日志
  - 记录每次LLM调用的输入摘要、输出摘要、置信度
  - 保存到`llm_logs`表
  - 前端展示调用历史与Token消耗

- [ ] Job进度跟踪
  - 前端实时显示导入进度条
  - WebSocket推送进度更新
  - 失败重试机制与告警

---

## 📅 中期规划（3-6周）

### 知识图谱高级功能
- [ ] 发布流程控制
  - 增加`status`字段：draft（草稿）→ review（审核中）→ published（已发布）
  - 学生端仅显示`published`状态的知识点
  - 教师端可查看所有状态

- [ ] LLM提示词增强
  - 按章节摘要分批生成知识点
  - 保存`sourceChunks`字段供溯源
  - 提供邻居chunk上下文提升生成质量

- [ ] 知识点版本控制
  - 记录每次修改的历史快照
  - 支持回滚到历史版本
  - 对比不同版本的差异

### 学生端增强
- [ ] 问答RAG系统
  - 复用知识点/课程索引
  - 学生提问 → 检索增强 → LLM回答
  - 显示引用的知识点来源

- [ ] 学习路径规划
  - 基于REQUIRES关系自动生成学习路径
  - 考虑difficulty和estimatedMinutes
  - 可视化展示路径图

- [ ] 个性化推荐
  - 基于学生历史表现推荐知识点
  - 标记薄弱环节
  - 推送定制化练习

### 教师端增强
- [ ] 批量审核界面
  - 草稿知识点列表分页展示
  - 支持搜索、过滤
  - 批量通过/拒绝操作
  - 显示AI生成的置信度

- [ ] 数据分析看板
  - 知识点覆盖率分析
  - 学生学习热力图
  - 知识点难度分布
  - 关系网络密度统计

---

## 🔮 长期愿景（3个月+）

### 平台化能力
- [ ] 多租户支持
  - 学校/班级隔离
  - 数据权限控制
  - 统一身份认证（OAuth/SSO）

- [ ] 权限管理系统
  - 细粒度权限控制（RBAC）
  - 审批工作流引擎
  - 操作日志审计

- [ ] 移动端适配
  - 响应式设计优化
  - PWA支持
  - 移动端原生应用（可选）

### 智能化升级
- [ ] 知识图谱推理
  - 基于规则的推理引擎
  - 发现隐含的知识关系
  - 自动补全缺失关系

- [ ] AI辅助生成
  - 自动生成练习题
  - 自动生成场景蓝图
  - 自动生成评估标准

- [ ] 自适应学习
  - 根据学生表现动态调整难度
  - 智能选择最优知识点讲解策略
  - 预测学习效果

### 数据与集成
- [ ] 数据可视化增强
  - 3D知识图谱可视化
  - 时间序列分析
  - 交互式探索工具

- [ ] 外部系统集成
  - LMS（Learning Management System）对接
  - 第三方教材库API
  - 成绩管理系统同步

- [ ] 多语言支持
  - 界面国际化（i18n）
  - 支持中英文切换
  - 多语言知识点管理

---

## ⚙️ 技术债务

### 代码质量
- [ ] 单元测试覆盖
  - services/层测试（目标覆盖率>80%）
  - routes/层API测试
  - 前端JavaScript测试（Jest/Vitest）

- [ ] 集成测试
  - E2E测试（Cypress/Playwright）
  - API集成测试
  - 知识图谱CRUD测试

- [ ] 代码重构
  - 提取公共工具函数
  - 统一错误处理
  - 优化数据库查询性能

### 性能优化
- [ ] 前端性能
  - 图谱可视化大数据量优化（虚拟化渲染）
  - 列表懒加载/分页加载
  - 图片/资源CDN加速

- [ ] 后端性能
  - Neo4j查询优化
  - SQLite索引优化
  - LLM调用缓存机制
  - Redis缓存层（可选）

- [ ] 数据库优化
  - Neo4j连接池配置
  - SQLite WAL模式优化
  - 定期VACUUM清理

### 文档完善
- [ ] API文档自动生成（Swagger/OpenAPI）
- [ ] 开发者指南（contribution guide）
- [ ] 架构设计文档
- [ ] 部署运维手册
- [ ] 视频教程制作

---

## 🔧 基础设施

### DevOps
- [ ] CI/CD流水线
  - GitHub Actions自动测试
  - 自动化部署脚本
  - 代码质量检查（linting）

- [ ] 容器化
  - 完整Docker Compose配置（应用+Neo4j+Redis）
  - Kubernetes部署方案（可选）
  - 镜像优化与多阶段构建

- [ ] 监控与告警
  - 应用性能监控（APM）
  - 日志聚合（ELK/Loki）
  - 错误追踪（Sentry）

### 安全加固
- [ ] 安全审计
  - SQL注入防护审计
  - XSS防护审计
  - CSRF防护
  - 敏感数据加密

- [ ] 访问控制
  - API限流（rate limiting）
  - IP白名单（可选）
  - 会话管理增强

---

## 📌 配置与环境

### 环境变量补充
建议在`.env`中增加以下配置：

```bash
# 向量库配置（待实现）
VECTOR_DB_TYPE=pgvector  # pgvector/faiss/weaviate
VECTOR_DB_URI=postgresql://localhost:5432/knowledge
VECTOR_DB_DIMENSION=768

# 任务队列配置（待实现）
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# LLM配置增强
DEEPSEEK_TIMEOUT=30              # API超时时间（秒）
DEEPSEEK_MAX_RETRIES=3           # 重试次数
DEEPSEEK_CONCURRENCY=5           # 并发调用数

# 日志配置
LOG_LEVEL=INFO                   # DEBUG/INFO/WARNING/ERROR
LOG_FILE=app.log                 # 日志文件路径
```

---

## 🎯 优先级说明

| 优先级 | 标签 | 说明 |
|--------|------|------|
| P0 | 🔥 | 紧急且重要，影响核心功能 |
| P1 | ⚡ | 重要，显著提升用户体验 |
| P2 | 💡 | 有价值，可延后 |
| P3 | 🌟 | Nice to have，长期愿景 |

**近期优化**：大部分为P0/P1优先级
**中期规划**：P1/P2优先级
**长期愿景**：P2/P3优先级

---

## 📝 备注

1. **向量库选型**：推荐PGVector（PostgreSQL扩展），与现有技术栈兼容度高
2. **任务队列**：优先选择Celery（成熟稳定）或RQ（轻量简单）
3. **前端框架迁移**：当前Vanilla JS方案可维护性良好，短期内不建议迁移到React/Vue
4. **Neo4j升级**：当前5.15版本稳定，暂无升级计划

---

**最后更新**：2025-01-30（Beta 2版本）
**维护者**：项目组
