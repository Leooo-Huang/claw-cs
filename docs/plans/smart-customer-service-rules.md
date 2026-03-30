# 智能客服系统 — 编码规则

## 技术栈约束

| 依赖 | 版本 | 说明 |
|------|------|------|
| Next.js | 16.1.6 | App Router, Turbopack |
| React | 19.2.3 | Server Components |
| Prisma | 7.4.2 | SQLite, prisma.config.ts（不用 schema url） |
| Tailwind CSS | 4.x | PostCSS 插件模式 |
| shadcn/ui | 4.x | New York 风格 |
| SWR | 2.4.1 | 客户端数据获取 |
| xlsx | 0.18.5 | Excel 解析 |
| pdf-parse | 2.4.5 | PDF 文本提取 |
| diff-match-patch | 1.0.5 | 文本 diff |

## 文件组织

```
app/                    # 页面 + API 路由
  tickets/page.tsx      # 工单中心
  knowledge/page.tsx    # 知识库
  batch/page.tsx        # 批量运营
  channels/page.tsx     # 渠道配置
  api/                  # API Routes
components/
  scenarios/customer-service/   # 业务组件（16 个）
  ui/                           # shadcn 基础组件
  layout/                       # 布局组件
lib/
  customer-service/     # 核心业务逻辑（14 个模块）
  openclaw/             # OpenClaw 集成
  db/prisma.ts          # 数据库客户端
```

## API 约定

- 成功响应：`{ data: ... }` 或 `{ data: ..., meta: { total, page, limit } }`
- 错误响应：`{ error: "message" }` 或 `{ error: { code: "CODE", message: "..." } }`
- 分页：`?page=1&limit=20`
- JSON 字段存储：tags/citedRuleIds 等数组存为 JSON 字符串，API 返回时解析

## 编码约定

- 组件：`'use client'` 显式标注客户端组件
- API 路由：每个文件导出 `GET`/`POST`/`PATCH`/`DELETE`
- 业务逻辑：不在 API 路由中写业务逻辑，调用 `lib/customer-service/` 中的函数
- 类型定义：集中在 `lib/customer-service/types.ts`
- OpenClaw 调用：同步用 `callOpenClawSync()`，异步用 `sendToOpenClaw()` + callback

## 质量红线

1. **禁止占位** — 无 TODO/pass/空函数体
2. **禁止 Mock 冒充真实** — mock 数据只在 mock 渠道中使用，不冒充 AI 结果
3. **禁止降阶** — 设计文档要求 AI 处理的，必须调 OpenClaw，fallback 必须标注来源
4. **版本正确** — 依赖版本与上表一致

## 禁止模式

- 不要把 `node_modules` 提交到 Git
- 不要在 Prisma schema 中使用 `url = env("DATABASE_URL")`（Prisma 7 用 prisma.config.ts）
- 不要显示"AI 正在处理"但实际没有调 AI
- 不要用 `@/lib/workflow/`（已移除，这是旧项目遗留）
- 不要 import `google-trends-api`、`@fal-ai/client`、`replicate`（已移除）
