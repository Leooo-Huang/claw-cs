# 智能客服系统 — API 设计文档

> 基于代码逆向生成 | 项目：claw-cs | 日期：2026-03-30

## 数据模型

### KnowledgeRule（话术规则）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | String | cuid() | 唯一标识 |
| condition | String | - | 触发条件 |
| content | String | - | 标准回复 |
| tags | String(JSON) | "[]" | 标签数组 |
| category | String | "general" | 分类 |
| source | String | "manual" | 来源（manual/document/conversation/learning） |
| sourceRef | String? | null | 来源引用 |
| status | String | "active" | 状态（active/pending/deprecated） |
| confidence | Float | 1.0 | 置信度 |
| hitCount | Int | 0 | 引用次数 |
| conflictsWith | String(JSON) | "[]" | 冲突规则 ID |

### KnowledgeDocument（文档）

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| id | String | cuid() | 唯一标识 |
| filename | String | - | 文件名 |
| fileType | String | - | pdf/xlsx/txt/json |
| fileSize | Int | 0 | 字节大小 |
| chunkCount | Int | 0 | 分块数 |
| sourceType | String | "other" | faq/manual/conversation/other |
| status | String | "active" | active/deleted |

### KnowledgeChunk（文档分块）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| documentId | String | 所属文档 FK |
| content | String | 分块原文 |
| chunkIndex | Int | 块序号 |

### Ticket（工单）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| channelId | String? | 来源渠道 FK |
| channelType | String | mock/taobao/email/... |
| customerName | String | 客户名 |
| customerMessage | String | 客户消息 |
| intent | String? | 意图（售后-退货/售前-咨询...） |
| sentiment | String? | 情感（愤怒/不满/中性/积极） |
| aiReply | String? | AI 草稿 |
| aiReasoning | String? | 推理过程 |
| aiConfidence | Float? | 置信度 |
| aiSearchMeta | String? | 检索元数据 JSON |
| citedRuleIds | String(JSON) | 引用规则 ID |
| finalReply | String? | 最终发送的回复 |
| status | String | pending → ai_drafting → awaiting_review → replied/failed |

### LearningCandidate（学习候选）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| ticketId | String | 源工单 FK |
| originalReply | String | AI 原始回复 |
| editedReply | String | 人工编辑后 |
| diffType | String | semantic/cosmetic |
| extractedCondition | String | 提取的条件 |
| extractedContent | String | 提取的内容 |
| confidence | Float | 候选置信度 |
| status | String | pending/approved/rejected/ignored |

### Channel（渠道）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 唯一标识 |
| type | String | taobao/pinduoduo/shopify/douyin/email/mock |
| name | String | 显示名称 |
| config | String(JSON) | 渠道配置 |
| status | String | connected/error/disconnected |
| messageCount | Int | 消息总数 |

---

## API 端点清单

### 渠道管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/channels` | 列表渠道 |
| POST | `/api/channels` | 创建渠道 |
| PATCH | `/api/channels/[id]` | 更新渠道 |
| DELETE | `/api/channels/[id]` | 删除渠道 |
| POST | `/api/channels/[id]/test` | 测试连接 |
| POST | `/api/channels/[id]/poll` | 拉取消息 |
| GET | `/api/channels/[id]/health` | 健康状态 |
| GET | `/api/channels/[id]/stats` | 统计数据 |

### 工单管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/tickets` | 列表工单（分页+筛选+搜索） |
| GET | `/api/tickets/[id]` | 工单详情（含引用规则全文） |
| POST | `/api/tickets/[id]/approve` | 批准并发送 |
| POST | `/api/tickets/[id]/edit-send` | 修改并发送（触发学习） |
| POST | `/api/tickets/[id]/reject` | 拒绝重生成 |
| POST | `/api/tickets/batch-approve` | 批量批准（preview=true 预检） |

### 知识库

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/knowledge/rules` | 列表规则（多维筛选） |
| POST | `/api/knowledge/rules` | 创建规则（单个/批量，含查重+冲突检测） |
| PATCH | `/api/knowledge/rules/[id]` | 更新规则 |
| DELETE | `/api/knowledge/rules/[id]` | 废弃规则 |
| GET | `/api/knowledge/documents` | 列表文档 |
| POST | `/api/knowledge/documents` | 上传文档（分块+向量化） |
| GET | `/api/knowledge/documents/[id]` | 文档详情（含分块） |
| DELETE | `/api/knowledge/documents/[id]` | 删除文档 |
| POST | `/api/knowledge/import` | 导入文件（存文档+提取规则） |
| POST | `/api/knowledge/import-conversations` | 导入对话（AI 抽样提取规则） |
| POST | `/api/knowledge/chat` | 对话增强（自然语言→规则） |
| GET | `/api/knowledge/stats` | 知识库统计 |
| POST | `/api/knowledge/sync` | 同步向量库 |

### 学习闭环

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/learning/candidates` | 列表候选 |
| PATCH | `/api/learning/candidates/[id]` | 审核候选 |
| POST | `/api/learning/candidates` | 批量审核 |

### 集成

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/openclaw/callback` | OpenClaw 异步回调 |

---

## 核心业务流程

### 工单生命周期

```
渠道消息 → Ticket(pending) → AI 生成草稿(ai_drafting)
  → 草稿就绪(awaiting_review)
  → 批准/修改发送(replied) 或 拒绝(failed)
```

超时：AI 90 秒未返回 → 使用模板回复

### 知识检索（RAG）

```
客户消息 → 向量化 → 搜索文档分块(topK=8) + 搜索规则(topK=5)
  → 文档片段 + 话术规则 一起喂给 OpenClaw → 生成回复
```

### 学习闭环

```
用户编辑 AI 草稿 → 检测语义修改 → 创建 LearningCandidate(pending)
  → 后台 AI 验证 → 用户审核 → approve → createRule(source=learning)
```

### 规则查重+冲突

```
新规则 → 向量相似度查询(topK=3)
  → >0.9: 重复，跳过
  → 0.7~0.9 + 矛盾信号词: 冲突，仍创建但标记
  → <0.7: 正常创建
```

### 置信度动态调整

同意图 approved ≥3 个候选时，每增加 3 个提升 0.05，上限 0.95

---

## 函数映射

| API | 业务函数 | 文件 |
|-----|---------|------|
| tickets/* | `listTickets/approveTicket/editAndSendTicket/rejectTicket/batchApproveTickets` | `lib/customer-service/ticket-processor.ts` |
| knowledge/rules/* | `createRule/listRules/updateRule/deprecateRule` | `lib/customer-service/knowledge-store.ts` |
| knowledge/documents/* | `storeDocument/listDocuments/deleteDocument` | `lib/customer-service/document-store.ts` |
| knowledge/import | `extractTextFromFile` + AI 提取 | `lib/customer-service/file-parser.ts` |
| knowledge/import-conversations | `parseConversations` | `lib/customer-service/conversation-parser.ts` |
| knowledge/chat | `createRule` + OpenClaw 提取 | `lib/customer-service/knowledge-store.ts` |
| learning/candidates/* | `listCandidates/reviewCandidate/batchReviewCandidates` | `lib/customer-service/learning-loop.ts` |
| channels/* | `createChannel/listChannels/testConnection/pollMessages` | `lib/customer-service/channel-manager.ts` |
| openclaw/callback | 直接 DB 更新 | `app/api/openclaw/callback/route.ts` |
