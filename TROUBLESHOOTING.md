# 故障排除指南

## 🚨 紧急修复：理论内容无法创建（401错误）

### 症状
- 创建理论主题/课时时显示"登录过期"
- Word文档导入后点击"应用导入"失败
- 手动增删节、小节没有反应
- 后端日志显示 `POST /api/admin/theory/topics HTTP/1.1 401`

### 根本原因
Neo4j知识图谱连接失败导致。虽然代码有降级机制，但在某些情况下仍可能影响主业务流程。

### ⚡ 快速解决（5分钟）

**步骤1：禁用Neo4j**

编辑 `.env` 文件，注释掉或删除Neo4j配置：

```bash
# 将这些行注释掉或删除
# NEO4J_URI=bolt://your-server:7687
# NEO4J_USER=neo4j
# NEO4J_PASSWORD=your-password
```

**步骤2：重启应用**

```bash
# 如果使用Python直接运行
python app.py

# 或使用Ctrl+C停止后重新运行
```

**步骤3：验证修复**

1. 刷新浏览器
2. 重新登录
3. 尝试创建理论主题 → 应该成功了！

---

## 📋 详细问题诊断

### 问题1：Word文档导入后无法保存

**现象**：
- 上传Word文档成功，可以预览解析结果
- 点击"应用导入"后提示"登录过期"
- 部分章节创建成功，但理论主题创建失败

**诊断步骤**：

1. 打开浏览器开发者工具（F12）
2. 切换到"网络"标签
3. 再次尝试导入
4. 查找返回401状态码的请求

**解决方法**：
- 按上述"快速解决"步骤禁用Neo4j
- 或参考 `NEO4J_SETUP.md` 修复Neo4j连接

### 问题2：手动创建理论内容失败

**现象**：
- 点击"添加理论主题"按钮无反应
- 或显示"登录过期，请重新登录"

**诊断**：
```bash
# 查看后端日志，寻找401错误
tail -f app.log  # 或查看控制台输出
```

**解决**：
同上，禁用Neo4j或修复连接

### 问题3：内容无法发布

**现象**：
- 理论课时编辑后保存失败
- 发布操作返回401错误

**原因**：
与上述问题相同，Neo4j连接失败

**解决**：
禁用Neo4j即可恢复功能

---

## 🔍 Neo4j连接问题诊断

### 检查配置

```bash
# 查看当前配置
cat .env | grep NEO4J

# 或
echo $NEO4J_URI
echo $NEO4J_USER
echo $NEO4J_PASSWORD
```

### 测试Neo4j连接

**方法1：使用Neo4j Browser**

如果是本地Neo4j：
1. 打开 http://localhost:7474
2. 使用配置的用户名密码登录
3. 运行测试查询：`MATCH (n) RETURN count(n)`

**方法2：使用Python测试**

```python
from neo4j import GraphDatabase

uri = "neo4j://127.0.0.1:7687"  # 你的配置
user = "neo4j"
password = "your-password"

try:
    driver = GraphDatabase.driver(uri, auth=(user, password))
    driver.verify_connectivity()
    print("✓ Neo4j连接成功！")
    driver.close()
except Exception as e:
    print(f"✗ Neo4j连接失败：{e}")
```

### 常见Neo4j错误

**错误1：SSL连接失败**
```
ssl.SSLEOFError: [SSL: UNEXPECTED_EOF_WHILE_READING]
```

**解决**：
```bash
# 改用不加密的连接
NEO4J_URI=neo4j://127.0.0.1:7687

# 或使用正确的加密协议
NEO4J_URI=neo4j+s://your-server:7687
```

**错误2：认证失败**
```
neo4j.exceptions.AuthError: Authentication failure
```

**解决**：
检查用户名和密码是否正确

**错误3：连接超时**
```
neo4j.exceptions.ServiceUnavailable: Unable to retrieve routing information
```

**解决**：
1. 确认Neo4j服务正在运行
2. 检查防火墙设置
3. 检查端口7687是否开放

---

## 🎯 最佳实践

### 开发环境配置

推荐使用Docker运行本地Neo4j：

```bash
# 启动Neo4j
docker run -d \
  --name neo4j-dev \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/devpassword \
  -v neo4j-data:/data \
  neo4j:latest

# 配置.env
cat > .env << 'EOF'
NEO4J_URI=neo4j://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=devpassword
EOF
```

### 生产环境配置

**选项1：Neo4j Aura（云服务）**

```bash
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=你的Aura密码
```

**选项2：自建Neo4j服务器**

```bash
NEO4J_URI=neo4j://your-server-ip:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=强密码
```

### 性能优化

如果Neo4j同步较慢：

1. **增加超时时间**（待实现）
2. **使用后台任务同步**（待实现）
3. **只在必要时同步**（当前已实现）

---

## 📊 系统状态检查

### 检查应用日志

**正常启动（Neo4j已禁用）**：
```
INFO - Knowledge graph not configured; skipping startup sync
INFO - Server started successfully
```

**正常启动（Neo4j已连接）**：
```
INFO - Knowledge graph bootstrapped successfully
INFO - Server started successfully
```

**异常启动（Neo4j连接失败）**：
```
WARNING - Knowledge graph unavailable; disabling graph features
WARNING - Skipping graph sync (service unavailable)
```

### 检查数据库文件

```bash
# SQLite数据库应该存在
ls -lh app.db

# 检查数据库大小
du -h app.db
```

### 验证理论内容

```bash
# 使用SQLite命令行工具
sqlite3 app.db "SELECT count(*) FROM theory_topics;"
sqlite3 app.db "SELECT count(*) FROM theory_lessons;"
```

---

## 🆘 仍然无法解决？

### 收集诊断信息

1. **完整的启动日志**（从启动到报错的全部输出）

2. **浏览器控制台错误**（F12 → Console标签）

3. **网络请求详情**（F12 → Network标签 → 失败的请求 → Response）

4. **环境信息**：
```bash
python --version
pip list | grep neo4j
cat .env | grep NEO4J
```

### 临时绕过方案

如果禁用Neo4j后仍有问题：

1. **清除浏览器缓存**
2. **重新登录**
3. **检查token是否过期**（默认7天）
4. **使用无痕模式测试**

### 数据恢复

如果数据丢失：

```bash
# SQLite数据库备份
cp app.db app.db.backup.$(date +%Y%m%d)

# 恢复备份
cp app.db.backup.20250101 app.db
```

---

## 📚 相关文档

- [NEO4J_SETUP.md](./NEO4J_SETUP.md) - Neo4j详细配置指南
- [README.md](./README.md) - 项目总体说明
- Neo4j官方文档: https://neo4j.com/docs/

---

## 更新日志

- 2025-10-31: 初始版本，添加401错误诊断和Neo4j配置说明
