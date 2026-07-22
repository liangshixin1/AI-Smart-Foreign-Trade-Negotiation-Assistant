# Neo4j 本地部署指南

## 概述

本系统已从云端Neo4j迁移至本地Docker部署方案，提供更稳定、可控的知识图谱服务。

## 为什么选择本地部署？

### 云端方案的问题
- ❌ 连接不稳定，经常超时
- ❌ SSL/TLS配置复杂
- ❌ 网络延迟影响性能
- ❌ 依赖外部服务可用性

### 本地方案的优势
- ✅ 稳定可靠，不受网络影响
- ✅ 配置简单，开箱即用
- ✅ 性能优异，低延迟
- ✅ 数据完全掌控
- ✅ 免费无限制使用

## 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose 1.29+
- 至少2GB可用内存

### 安装步骤

#### 1. 启动Neo4j服务

```bash
# 进入项目目录
cd /path/to/AI-Smart-Foreign-Trade-Negotiation-Assistant

# 启动Neo4j（后台运行）
docker-compose -f docker-compose.neo4j.yml up -d

# 查看启动日志
docker-compose -f docker-compose.neo4j.yml logs -f neo4j
```

等待输出类似信息：
```
foreign-trade-neo4j | Started.
foreign-trade-neo4j | Remote interface available at http://localhost:7474/
```

#### 2. 配置应用环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑.env文件，确保Neo4j配置正确
cat .env | grep NEO4J
```

应显示：
```
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=CHANGE_ME
```

#### 3. 验证连接

```bash
# 访问Neo4j Browser
open http://localhost:7474

# 或使用curl测试
curl http://localhost:7474
```

登录信息：
- **用户名**: `neo4j`
- **密码**: 使用 `.env` 中自行设置的强密码

#### 4. 启动应用

```bash
# 安装Python依赖
pip install -r requirements.txt

# 启动应用
python app.py
```

应看到日志：
```
INFO - Knowledge graph bootstrapped successfully
```

## 常用命令

### 管理Neo4j服务

```bash
# 启动服务
docker-compose -f docker-compose.neo4j.yml up -d

# 停止服务
docker-compose -f docker-compose.neo4j.yml stop

# 重启服务
docker-compose -f docker-compose.neo4j.yml restart

# 完全移除（包括数据卷）
docker-compose -f docker-compose.neo4j.yml down -v

# 查看状态
docker-compose -f docker-compose.neo4j.yml ps

# 查看日志
docker-compose -f docker-compose.neo4j.yml logs -f neo4j
```

### 数据管理

```bash
# 备份数据
docker exec foreign-trade-neo4j neo4j-admin database dump neo4j \
  --to-path=/data/backups

# 恢复数据
docker exec foreign-trade-neo4j neo4j-admin database load neo4j \
  --from-path=/data/backups
```

### 性能调优

根据机器配置，编辑 `docker-compose.neo4j.yml`:

```yaml
environment:
  # 4GB内存机器
  - NEO4J_server_memory_heap_initial__size=512m
  - NEO4J_server_memory_heap_max__size=1G
  - NEO4J_server_memory_pagecache_size=512m

  # 8GB内存机器
  # - NEO4J_server_memory_heap_initial__size=1G
  # - NEO4J_server_memory_heap_max__size=2G
  # - NEO4J_server_memory_pagecache_size=1G

  # 16GB内存机器
  # - NEO4J_server_memory_heap_initial__size=2G
  # - NEO4J_server_memory_heap_max__size=4G
  # - NEO4J_server_memory_pagecache_size=2G
```

## 访问Neo4j Browser

### Web界面

访问 http://localhost:7474

功能：
- 可视化查询图数据
- 执行Cypher语句
- 查看数据库统计
- 管理索引和约束

### 常用Cypher查询

```cypher
// 查看所有节点类型
CALL db.labels()

// 查看所有关系类型
CALL db.relationshipTypes()

// 统计各类节点数量
MATCH (n)
RETURN labels(n) AS type, count(*) AS count
ORDER BY count DESC

// 查看知识点及其关联
MATCH (k:KnowledgePoint)
OPTIONAL MATCH (k)<-[r]-()
RETURN k.name, count(r) AS connections
ORDER BY connections DESC
LIMIT 20

// 查看知识图谱结构
MATCH (n)
RETURN n
LIMIT 100

// 查找孤立的知识点
MATCH (k:KnowledgePoint)
WHERE NOT (k)--()
RETURN k.name

// 知识点分类统计
MATCH (k:KnowledgePoint)
RETURN k.category, k.type, count(*) AS count
ORDER BY k.category, count DESC
```

## 故障排查

### 问题1：端口被占用

错误信息：
```
Error starting userland proxy: listen tcp4 0.0.0.0:7474: bind: address already in use
```

解决方法：
```bash
# 查找占用端口的进程
lsof -i :7474
lsof -i :7687

# 停止占用进程或修改docker-compose.neo4j.yml中的端口映射
ports:
  - "17474:7474"  # 改用其他端口
  - "17687:7687"
```

### 问题2：连接超时

错误信息：
```
Failed to connect to Neo4j at neo4j://localhost:7687: ServiceUnavailable
```

解决方法：
```bash
# 1. 检查Neo4j是否启动
docker ps | grep neo4j

# 2. 查看Neo4j日志
docker-compose -f docker-compose.neo4j.yml logs neo4j

# 3. 重启Neo4j
docker-compose -f docker-compose.neo4j.yml restart

# 4. 等待健康检查通过
docker inspect foreign-trade-neo4j | grep -A 5 "Health"
```

### 问题3：内存不足

错误信息：
```
OutOfMemoryError: Java heap space
```

解决方法：
```bash
# 1. 增加Docker内存限制（Docker Desktop设置）
# 2. 减小Neo4j堆内存配置（编辑docker-compose.neo4j.yml）
environment:
  - NEO4J_server_memory_heap_max__size=512m  # 降低内存使用
```

### 问题4：权限错误

错误信息：
```
Permission denied: '/data'
```

解决方法：
```bash
# 修复数据卷权限
docker-compose -f docker-compose.neo4j.yml down
docker volume rm $(docker volume ls -q | grep neo4j)
docker-compose -f docker-compose.neo4j.yml up -d
```

### 问题5：应用连接失败

错误信息：
```
ssl.SSLEOFError: [SSL: UNEXPECTED_EOF_WHILE_READING]
```

解决方法：
```bash
# 确保.env使用正确的协议
NEO4J_URI=neo4j://localhost:7687  # 不要使用 neo4j+s:// 或 bolt://
```

## 数据迁移

### 从云端迁移到本地

如果你之前使用云端Neo4j，按以下步骤迁移：

#### 1. 导出云端数据

```cypher
// 在云端Neo4j Browser中执行
CALL apoc.export.cypher.all("backup.cypher", {
  format: "cypher-shell",
  useOptimizations: {type: "UNWIND_BATCH", unwindBatchSize: 20}
})
```

#### 2. 下载导出文件

从云端Neo4j的文件管理中下载 `backup.cypher`

#### 3. 导入到本地Neo4j

```bash
# 复制文件到Neo4j容器
docker cp backup.cypher foreign-trade-neo4j:/var/lib/neo4j/import/

# 进入容器执行导入
docker exec -it foreign-trade-neo4j cypher-shell -u neo4j -p '<YOUR_PASSWORD>'
```

```cypher
// 清空现有数据（谨慎！）
MATCH (n) DETACH DELETE n;

// 导入数据
:source /var/lib/neo4j/import/backup.cypher
```

### 重新同步数据

如果迁移有问题，可以让应用重新同步SQLite数据到Neo4j：

```bash
# 方式1：通过管理界面
# 访问 http://localhost:5000/admin
# 点击 "知识图谱" → "重新同步数据"

# 方式2：通过API
curl -X POST http://localhost:5000/api/admin/sync-graph \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"

# 方式3：清空Neo4j重启应用
docker-compose -f docker-compose.neo4j.yml down -v
docker-compose -f docker-compose.neo4j.yml up -d
# 等待30秒
python app.py  # 应用启动时会自动同步
```

## 监控与维护

### 健康检查

```bash
# 检查Neo4j健康状态
curl http://localhost:7474/db/neo4j/cluster/available

# 检查应用连接状态
curl http://localhost:5000/api/health | jq .graph
```

### 定期维护

```bash
# 每月备份数据
docker exec foreign-trade-neo4j neo4j-admin database dump neo4j \
  --to-path=/data/backups/backup-$(date +%Y%m%d).dump

# 查看数据库大小
docker exec foreign-trade-neo4j du -sh /data/databases/neo4j

# 清理日志（可选）
docker exec foreign-trade-neo4j rm -rf /logs/*.log
```

## 生产环境部署

### 安全加固

```yaml
# docker-compose.neo4j.yml
environment:
  # 1. 使用强密码
  - NEO4J_AUTH=neo4j/$(openssl rand -base64 32)

  # 2. 限制远程访问
  - NEO4J_dbms_connector_bolt_listen__address=127.0.0.1:7687

  # 3. 启用HTTPS
  - NEO4J_dbms_connector_https_enabled=true
  - NEO4J_dbms_ssl_policy_https_enabled=true
```

### 高可用配置

参考Neo4j官方文档配置集群模式。

## 参考资源

- [Neo4j Docker官方文档](https://neo4j.com/docs/operations-manual/current/docker/)
- [Neo4j Cypher手册](https://neo4j.com/docs/cypher-manual/current/)
- [APOC插件文档](https://neo4j.com/docs/apoc/current/)

## 支持

如有问题，请查看：
- [故障排查文档](TROUBLESHOOTING.md)
- [GitHub Issues](https://github.com/liangshixin1/AI-Smart-Foreign-Trade-Negotiation-Assistant/issues)
