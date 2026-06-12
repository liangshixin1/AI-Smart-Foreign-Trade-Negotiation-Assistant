# 现代化前端（React + TypeScript + Vite）

该目录是旧版原生 JavaScript 前端的渐进式迁移入口，而不是一次性重写分支。

## 目录约定

- `src/app/`：应用壳与全局样式，只做页面装配。
- `src/features/`：按业务能力组织状态、模型和功能组件。
- `src/components/`：无业务副作用的可复用展示组件。
- `src/services/`：后端 API 适配层，统一请求与响应类型。

## 开发

```bash
npm ci
npm run dev
```

Vite 会将 `/api` 转发到 `http://localhost:5000`。独立运行前端时，健康状态卡片会显示开发服务独立运行，不影响页面预览。

## 生产构建

```bash
npm run build
```

构建产物写入 `../static/modern`，由 Flask 的 `/modern/` 路由托管。旧版系统继续位于 `/`，便于按照业务域逐步迁移。
