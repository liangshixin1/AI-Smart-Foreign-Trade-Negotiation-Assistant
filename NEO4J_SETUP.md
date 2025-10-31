# Neo4j 知识图谱配置指南

## 问题诊断

如果你遇到以下问题：
- 创建理论主题/课时时返回401错误
- Word文档导入后无法保存
- 手动增删内容没有反应

**原因**：很可能是Neo4j连接配置有问题导致的。

## 快速修复方案

### 方案1：临时禁用Neo4j（推荐）

如果你不需要知识图谱功能，可以临时禁用Neo4j：

1. 打开 `.env` 文件（如果不存在则创建）
2. 将 Neo4j 相关配置注释掉或删除：

```bash
# Neo4j配置（已禁用）
# NEO4J_URI=bolt://your-server:7687
# NEO4J_USER=neo4j
# NEO4J_PASSWORD=your-password
```

3. 重启应用

这样系统会自动跳过知识图谱功能，但理论内容管理仍然可以正常使用（数据存储在SQLite中）。

### 方案2：修复Neo4j连接

如果你需要知识图谱功能，请按以下步骤配置：

#### 2.1 检查当前配置

查看你的 `.env` 文件或环境变量，确认Neo4j配置：

```bash
NEO4J_URI=bolt://your-neo4j-server:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
```

#### 2.2 常见Neo4j连接问题

**问题1：SSL/TLS连接失败**

从错误日志看到：
```
ssl.SSLEOFError: [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol
```

这通常是因为：
- 使用 `bolt://` 但服务器要求 `neo4j://` 或 `neo4j+s://`
- 或反之，使用了加密连接但服务器不支持

**解决方法**：

尝试修改连接协议：

```bash
# 选项1：使用不加密的连接（本地开发推荐）
NEO4J_URI=neo4j://127.0.0.1:7687

# 选项2：使用加密连接（Aura云服务推荐）
NEO4J_URI=neo4j+s://your-server:7687

# 选项3：使用bolt协议（旧版推荐）
NEO4J_URI=bolt://127.0.0.1:7687
```

**问题2：远程服务器连接失败**

从日志看你连接的是：
```
si-fdc89e4a-8858.production-orch-0067.neo4j.io
```

这是Neo4j Aura云服务。请确认：

1. **密码正确**：Aura的密码通常是创建实例时生成的随机密码
2. **URI正确**：应该类似 `neo4j+s://xxxxx.databases.neo4j.io`
3. **网络连接**：确保可以访问Neo4j云服务

#### 2.3 使用本地Neo4j（推荐用于开发）

**使用Docker快速启动**：

```bash
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/testpassword \
  neo4j:latest
```

然后配置 `.env`：

```bash
NEO4J_URI=neo4j://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=testpassword
```

**访问Neo4j Browser**：
打开 http://localhost:7474 验证连接

## 验证修复

### 1. 检查应用启动日志

重启应用后，查看日志：

**成功（已禁用Neo4j）**：
```
INFO - Knowledge graph not configured; skipping startup sync
```

**成功（已连接Neo4j）**：
```
INFO - Knowledge graph bootstrapped successfully
```

**失败**：
```
WARNING - Knowledge graph unavailable; disabling graph features
```

### 2. 测试理论内容创建

1. 登录教师账号
2. 进入"教师管理" → "知识图谱"选项卡
3. 尝试创建一个新的理论主题

**成功标志**：
- 返回200/201状态码
- 内容成功显示在列表中
- 没有401错误

### 3. 测试Word文档导入

1. 准备一个测试Word文档
2. 点击"导入Word文档"
3. 选择文件上传
4. 点击"应用导入"

**成功标志**：
- 所有章节、主题、课时都成功创建
- 没有"登录过期"提示
- 可以在理论内容列表中看到导入的内容

## 知识图谱功能说明

### 禁用Neo4j后的影响

**仍然可用的功能**：
- ✅ 创建/编辑/删除章节
- ✅ 创建/编辑/删除理论主题
- ✅ 创建/编辑/删除理论课时
- ✅ Word文档导入
- ✅ 内容发布
- ✅ 学生查看理论内容

**不可用的功能**：
- ❌ 知识图谱可视化
- ❌ 基于知识点的内容推荐
- ❌ 相关课时/练习推荐

### 启用Neo4j后的额外功能

- 📊 可视化知识图谱网络
- 🔗 自动发现相关内容
- 🎯 基于知识点的智能推荐
- 📈 知识点统计和分析

## 常见问题

### Q: 为什么我的理论内容操作返回401？

A: 401错误表示认证失败。但实际上可能是Neo4j连接问题导致的副作用。请按上述方案禁用或修复Neo4j配置。

### Q: 禁用Neo4j后数据会丢失吗？

A: 不会。所有理论内容都存储在SQLite数据库中（`app.db`文件），Neo4j只是用于增强功能的知识图谱。

### Q: 如何重新启用Neo4j？

A: 在 `.env` 文件中配置正确的Neo4j连接信息，然后重启应用即可。应用会自动同步SQLite中的数据到Neo4j。

### Q: 我的Neo4j Aura实例如何配置？

A: Neo4j Aura配置示例：

```bash
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=你的Aura密码
```

注意：
- 必须使用 `neo4j+s://` 协议（带加密）
- 密码是创建实例时生成的，不是"neo4j"

## 技术细节

### 系统架构

```
理论内容管理
├── SQLite (主存储) ← 所有数据都在这里
│   ├── level_chapters表
│   ├── theory_topics表
│   └── theory_lessons表
└── Neo4j (可选增强) ← 知识图谱功能
    ├── Chapter节点
    ├── TheoryTopic节点
    ├── TheoryLesson节点
    └── KnowledgePoint节点
```

### 数据同步机制

- 每次创建/更新/删除理论内容时，会自动同步到Neo4j
- 如果Neo4j不可用，同步会自动跳过，不影响主业务
- 应用启动时会从SQLite全量同步到Neo4j

## 支持

如果以上方案都无法解决问题，请提供：

1. 完整的应用启动日志
2. `.env` 文件内容（隐藏密码）
3. 尝试创建理论主题时的完整错误日志

相关issue: https://github.com/your-repo/issues
