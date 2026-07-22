# 阶段 1 工单完成报告：工程骨架与登录/RBAC

## 编码前工单

1. **用户问题**：建立可运行、可测试的新工程底座，让学生、教师、技术员能安全登录并进入各自工作区。
2. **范围内**：Vue 3/TypeScript/Vite/Router/Pinia；FastAPI/Pydantic/SQLAlchemy/Alembic；统一错误；健康检查；User/Role/AuthSession；登录、刷新、退出、当前用户；后端 RBAC；三角色工作区入口；质量配置和 CI。
3. **明确不做**：课程导入、Attempt、LLM、真实 API Key、教师分析和 P1/P2 功能。
4. **模块**：后端 `core/db/auth/workspaces`；前端 `app/shared/auth/workspace/pages`。
5. **数据/API**：首个认证迁移；`/health`、`/api/v1/auth/*`、`/api/v1/me` 和三个工作区探针。
6. **组件**：登录表单、认证 store/API、路由守卫、角色布局、工作区状态和三个角色页分离。
7. **验收**：空库迁移、三角色登录、统一错误、越权 403、格式/lint/type/test/build/行数全部通过。
8. **风险与回滚**：只新增绿地文件；迁移只新增认证表；无业务数据时可 downgrade；不触碰 `levels.py`。

## 1. 实际完成内容

- 建立 pnpm monorepo、Web/API 工程与统一根脚本。
- 建立 Vue 3 SFC 应用，启用 TypeScript strict、Vue Router、Pinia、ESLint、Prettier、Vitest 和 Vite 生产构建。
- 登录页和学生/教师/技术员三个受保护工作区可通过真实 API 登录访问。
- API 采用 FastAPI 应用工厂，启动不建表、不 seed、不调用 LLM。
- 建立 Pydantic 配置、统一错误 envelope、请求 ID、CORS 和去敏日志过滤器。
- 建立 SQLAlchemy 的 `User`、`Role`、`UserRole`、`AuthSession`，repository/service/router 分层。
- 密码使用标准库 scrypt + 随机 salt；访问/刷新 token 为高熵不透明值，数据库只保存带 pepper 的哈希。
- 实现登录、refresh token 原子轮换、退出撤销、`/me` 与角色级后端 RBAC。
- 建立 Alembic 环境和 `20260714_0001` 迁移；修复带空格工程路径下 Alembic 的 `path_separator`。
- 建立显式本地开发账号 seed CLI；生产环境拒绝执行，密码只从环境变量读取。
- 建立文件行数检查：`.vue` 不超过 500 行，service/store/composable 不超过 200 行，其他 TS/Python 不超过 500 行。
- 建立 GitHub Actions CI，目标 Python 3.12、Node 22、pnpm 11.7.0。

## 2. 修改文件列表

### 根目录与 CI

- `.gitignore`
- `README.md`
- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `scripts/check_file_lengths.py`
- `.github/workflows/ci.yml`

### 后端

- `apps/api/pyproject.toml`
- `apps/api/.env.example`
- `apps/api/alembic.ini`
- `apps/api/alembic/env.py`
- `apps/api/alembic/script.py.mako`
- `apps/api/alembic/versions/20260714_0001_auth_foundation.py`
- `apps/api/app/main.py`, `cli.py`
- `apps/api/app/core/*`
- `apps/api/app/db/*`
- `apps/api/app/modules/auth/*`
- `apps/api/app/modules/workspaces/*`
- `apps/api/tests/*`

### 前端

- `apps/web/package.json`
- `apps/web/index.html`
- `apps/web/tsconfig*.json`, `vite.config.ts`, `eslint.config.mjs`, Prettier 配置
- `apps/web/src/app/*`
- `apps/web/src/shared/*`
- `apps/web/src/features/auth/*`
- `apps/web/src/features/workspace/*`
- `apps/web/src/pages/*`

### 架构文档

- `docs/phase-0/README.md`
- `docs/phase-0/curriculum-migration.md`
- `docs/phase-0/domain-model-and-state.md`
- `docs/phase-0/api-and-page-map.md`
- `docs/phase-0/delivery-risks-and-rollback.md`

## 3. 数据库迁移说明

迁移 `20260714_0001` 创建：

- `users`
- `roles`
- `user_roles`
- `auth_sessions`

约束包括邮箱/学号唯一、角色码唯一、用户角色组合唯一、access/refresh token 哈希唯一，以及用户删除时会话/角色关系级联删除。迁移不写入默认用户或密码。

真实空库 smoke：

```text
Context impl SQLiteImpl.
Running upgrade  -> 20260714_0001, Create authentication foundation.
```

本地 seed CLI 随后成功创建三种开发账号；真实 Uvicorn HTTP smoke 对学生、教师、技术员三次登录均返回 `200 OK`，并确认返回角色、Bearer token 类型及非空 access/refresh token。测试输出未打印 token 值。

## 4. 测试命令与真实结果

统一命令：

```bash
pnpm check
```

2026-07-14 本机真实结果：

| 检查           | 结果                                                            |
| -------------- | --------------------------------------------------------------- |
| Prettier       | 全部匹配                                                        |
| Ruff format    | 27 个文件已格式化                                               |
| ESLint         | 通过，0 warning                                                 |
| Ruff lint      | 通过                                                            |
| Vue TypeScript | `vue-tsc -b --force` 通过                                       |
| Python 类型    | Mypy strict：21 个源文件无问题                                  |
| Web 单元测试   | 2 个测试文件、4 个测试通过                                      |
| API/迁移测试   | 8 个测试通过                                                    |
| Web 生产构建   | Vite 7.3.6，64 modules transformed，成功                        |
| 文件行数       | 通过                                                            |
| Git whitespace | `git diff --check` 通过                                         |
| 禁止项扫描     | 应用源码未发现显式 `any`、`document.querySelector`、`innerHTML` |

API 测试覆盖：统一校验错误、错误账号防枚举、三角色正确工作区、跨角色 403、access/refresh 轮换失效、退出撤销、空库 Alembic 升级。

## 5. 尚未解决的问题

1. 认证 token 当前由 Web 本地持久化，只适合阶段 1 开发闭环；接入真实学生数据前，应根据同域部署方案改为安全的 HttpOnly/SameSite Cookie，并完成 CSRF ADR 与测试。
2. 本机数据库 smoke 使用 SQLite；生产基线是 PostgreSQL。阶段 2 前需增加 PostgreSQL CI service 与迁移/并发测试。
3. 尚未接入课程、班级、Attempt、三 Agent 或真实 DeepSeek provider，这是工单明确不做的内容。
4. 三个工作区目前是权限验证占位页，不宣称业务功能完成。
5. GitHub Actions 文件已生成但尚未推送到 GitHub，因此只能确认本地 `pnpm check`，不能宣称远端 CI 已运行。
6. 本机 Python 为 3.14；CI 目标为 3.12。当前依赖和类型检查在 3.14 通过，仍需远端 CI 验证 3.12。

## 6. 验收标准逐项对照

| 验收标准                                  | 结果       | 证据                                    |
| ----------------------------------------- | ---------- | --------------------------------------- |
| Vue 3 + TS + Vite + Router + Pinia        | 通过       | Web build/typecheck                     |
| FastAPI + Pydantic + SQLAlchemy + Alembic | 通过       | 8 API/迁移测试 + 空库 smoke             |
| 三角色可登录                              | 通过       | 单元/接口测试 + 三次真实 HTTP 200       |
| 后端 RBAC，跨角色 403                     | 通过       | 参数化三角色接口测试                    |
| 密码非明文                                | 通过       | scrypt 存储实现与认证测试               |
| 登录失败不枚举账号                        | 通过       | 已存在错误密码与不存在账号响应一致测试  |
| API 错误格式统一                          | 通过       | 422/401/403 测试                        |
| 启动无重型初始化                          | 通过       | 应用工厂不建表、不 seed、不调用外部服务 |
| CI 配置                                   | 文件已完成 | 远端未运行，不能宣称通过                |
| 格式/lint/type/test/build/行数            | 通过       | `pnpm check` 完整真实输出               |

阶段 1 本地验收通过，可以进入阶段 2 的单条纵向切片设计与实现；上面的生产认证传输和 PostgreSQL CI 属于进入真实部署前的硬门槛。
