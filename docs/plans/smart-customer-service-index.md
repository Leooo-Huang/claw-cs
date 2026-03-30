# 智能客服系统 — 项目索引

## 概述

基于 OpenClaw AI Agent 的自进化电商智能客服系统。核心差异化：修改即学习——每次人工编辑 AI 回复，系统自动提取规则，知识库越用越准。

## 文档清单

| 文档 | 路径 | 内容 |
|------|------|------|
| 功能发现 | `docs/plans/smart-customer-service-ideation.md` | MVP 功能清单、用户画像、市场分析、价值链 |
| 架构设计 | `docs/plans/smart-customer-service-design.md` | 技术选型、组件架构、数据流、部署方案 |
| UI/UX | `docs/plans/smart-customer-service-ui.md` | 4 页面设计、用户流程、线框图、状态设计 |
| API 设计 | `docs/plans/smart-customer-service-api.md` | 数据模型（6表）、30+ API 端点、业务规则 |
| 知识库 V2 | `docs/plans/knowledge-v2.md` | 双层知识库（文档+规则）、向量检索、AI 过程可视化 |

## 技术栈

- **前端**: Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui
- **后端**: Next.js API Routes (App Router)
- **数据库**: Prisma 7 + SQLite
- **AI**: OpenClaw CLI（同步调用 `callOpenClawSync` + 异步回调）
- **向量检索**: HuggingFace Transformers（本地嵌入）+ JSON 向量存储
- **端口**: 3848

## 功能模块映射

| 模块 | 页面 | API | 核心逻辑 |
|------|------|-----|---------|
| 工单中心 | `/tickets` | `/api/tickets/*` | `ticket-processor.ts` |
| 知识库 | `/knowledge` | `/api/knowledge/*` | `knowledge-store.ts` + `document-store.ts` |
| 批量运营 | `/batch` | `/api/tickets/batch-approve` | `ticket-processor.ts` |
| 渠道配置 | `/channels` | `/api/channels/*` | `channel-manager.ts` |
| 学习闭环 | 跨页面 | `/api/learning/*` | `learning-loop.ts` |
| 对话增强 | 知识库 Tab3 | `/api/knowledge/chat` | OpenClaw + `knowledge-store.ts` |
| 文件导入 | 知识库 Dialog | `/api/knowledge/import` | `file-parser.ts` + `document-store.ts` |
| 冲突检测 | 规则创建时 | 内部 | `conflict-detector.ts` |
| 向量检索 | AI 草稿生成 | 内部 | `vector-store.ts` |

## MVP 功能状态

| # | 功能 | 状态 |
|---|------|------|
| P1 | 知识库引擎（双层：文档+规则） | ✅ 已实现 |
| P2 | 对话学习引擎（修改→提取→审核） | ✅ 已实现 |
| P3 | OpenClaw 记忆层（对话增强） | ✅ 已实现 |
| P4 | 多平台连接器（mock 渠道） | ⚠️ 仅 mock，真实渠道待对接 |
| W3a | 工单中心（三栏+AI 草稿） | ✅ 已实现 |
| W3b | 知识库工作台（4 Tab） | ✅ 已实现 |
| W3c | 批量运营台（预检+批量操作） | ✅ 已实现 |
| W3d | 渠道配置中心（向导+卡片） | ✅ 已实现 |
