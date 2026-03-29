# 智能客服运营系统 — 设计文档

> 设计时间：2026-03-19 | 基于调研：docs/plans/2026-03-18-smart-customer-service-ideation.md

## 背景

现有 W3 客服工单页面是简单的"工单列表 + AI 草稿 + 审批"。本次迭代目标是升级为**自进化的智能客服运营系统**：
- 自动构建本地知识库（产品说明、话术规定、历史对话→规则）
- 通过与 OpenClaw 对话持续提升知识库
- Human-in-the-loop 审核 + 批量管理
- 修改 AI 回复时可抽样新规则更新到知识库
- 连接电商平台和邮箱，统一收发消息

---

## 选型过程

评估了 4 个架构方案，选择**方案 4：双层混合**。

### 评分矩阵

| 方案 | 可行性 | 契合度 | 简洁性 | 调研匹配度 | 总分 |
|------|:------:|:------:|:------:|:----------:|:----:|
| 1: All-in-Prisma（关键词匹配） | 5 | 2 | 5 | 2 | 14 |
| 2: SQLite-Vec RAG（自建向量检索） | 4 | 4 | 3 | 4 | 15 |
| 3: OpenClaw-Native（纯 OpenClaw 记忆） | 3 | 3 | 4 | 4 | 14 |
| **4: 双层混合（Prisma + OpenClaw 记忆）** | **3** | **5** | **2** | **5** | **15** |

**选择方案 4 的理由：**
- 契合度最高（5）：唯一能同时满足"结构化规则管理"和"对话式教 AI"两个核心需求
- 调研匹配度最高（5）：与 Cobbai 推荐的"结构化 + AI 语义"双层架构一致
- 复杂度通过"写时重建"策略降低：规则变更时批量重建 OpenClaw 记忆文件，避免实时同步

---

## 架构设计

### 整体架构

```
┌────────────────────────────────────────────────────────────────┐
│                        前端页面层                               │
│  W3d 渠道配置  │  W3b 知识库工作台  │  W3a 工单中心  │  W3c 批量台  │
└───────┬────────┴────────┬──────────┴───────┬────────┴────┬─────┘
        │                 │                  │             │
┌───────▼─────────────────▼──────────────────▼─────────────▼─────┐
│                      API Routes (Next.js)                      │
│  /api/channels/*  │  /api/knowledge/*  │  /api/tickets/*       │
│                   │  /api/learning/*   │  /api/batch/*          │
└───────┬───────────┴────────┬───────────┴───────┬───────────────┘
        │                    │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│  P4 连接器层    │  │  P1 知识库引擎  │  │  P2 学习引擎   │
│  ChannelManager │  │  KnowledgeStore │  │  LearningLoop  │
│  - 轮询/Webhook │  │  - CRUD         │  │  - Diff分析    │
│  - 消息归一化   │  │  - 冲突检测     │  │  - 规则提取    │
│  - 发送路由     │  │  - 同步触发     │  │  - 噪音过滤    │
└───────┬────────┘  └──┬──────┬──────┘  └───────┬────────┘
        │              │      │                  │
        │              │  ┌───▼──────────┐       │
        │              │  │ P3 OpenClaw   │       │
        │              │  │ 记忆层        │◄──────┘
        │              │  │ - memorySearch│
        │              │  │ - 对话增强    │
        │              │  │ - 回复生成    │
        │              │  └───────────────┘
        │              │
┌───────▼──────────────▼─────────────────────────────────────────┐
│                     数据层 (Prisma + SQLite)                    │
│  KnowledgeRule │ Ticket │ Channel │ LearningCandidate │ ...    │
└────────────────────────────────────────────────────────────────┘
```

### 双层知识架构

```
  ┌─────────────────────────────────┐
  │      结构层 (Prisma/SQLite)      │  ← 管理 UI 的数据源
  │  KnowledgeRule 表                │
  │  - id, condition, content        │
  │  - source, tags, confidence      │
  │  - status, hitCount, createdAt   │
  └──────────────┬──────────────────┘
                 │  写时重建（规则变更触发）
                 ▼
  ┌─────────────────────────────────┐
  │     语义层 (OpenClaw Memory)     │  ← AI 检索和生成的知识源
  │  data/knowledge/rules.md         │
  │  data/knowledge/products.md      │
  │  data/knowledge/policies.md      │
  │  （按标签分文件，Markdown 格式） │
  └─────────────────────────────────┘
```

**同步机制（写时重建）：**
1. 结构层规则发生任何变更（增/删/改/审批）
2. 触发 `syncKnowledgeToMemory()` 函数
3. 按标签分组，将所有 status=active 的规则序列化为 Markdown 文件
4. 写入 OpenClaw 工作区的 `data/knowledge/` 目录
5. OpenClaw 的 memorySearch 自动索引更新后的文件

**为什么不用实时同步？** SQLite 规模下（预计 <10,000 条规则），全量重建耗时 <100ms，远比维护增量同步逻辑简单。

---

## 组件设计

### P1：知识库引擎 (KnowledgeStore)

**文件：** `lib/knowledge/store.ts`

**职责：** 知识规则的 CRUD + 冲突检测 + 触发同步

**数据模型（新增 Prisma 表）：**

```prisma
model KnowledgeRule {
  id          String   @id @default(cuid())
  condition   String   // 触发条件描述（如"客户问退货"）
  content     String   // 标准回答/处理流程
  source      String   // "document" | "conversation" | "manual" | "learning"
  sourceRef   String?  // 来源引用（文件名/工单ID/对话ID）
  tags        String   // JSON: string[]（如 ["退货","售后"]）
  category    String   @default("general") // "presale" | "aftersale" | "logistics" | "general"
  confidence  Float    @default(1.0)  // 0.0 - 1.0
  status      String   @default("active") // "active" | "pending" | "deprecated"
  hitCount    Int      @default(0)    // 被引用次数
  conflictsWith String? // JSON: string[]（冲突规则 ID 列表）
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**接口：**

```typescript
interface KnowledgeStore {
  // CRUD
  createRule(data: CreateRuleInput): Promise<KnowledgeRule>
  updateRule(id: string, data: UpdateRuleInput): Promise<KnowledgeRule>
  deleteRule(id: string): Promise<void>
  getRule(id: string): Promise<KnowledgeRule | null>
  listRules(filters: RuleFilters): Promise<{ rules: KnowledgeRule[], total: number }>

  // 批量操作
  importFromDocument(file: File): Promise<KnowledgeRule[]>     // PDF/Excel/CSV → 规则列表
  importFromConversations(data: ConversationData[]): Promise<KnowledgeRule[]>  // 历史对话 → 规则
  batchUpdateStatus(ids: string[], status: string): Promise<number>

  // 冲突检测
  detectConflicts(rule: KnowledgeRule): Promise<ConflictResult[]>

  // 同步
  syncToMemory(): Promise<void>  // 写时重建：全量同步到 OpenClaw 记忆
}
```

**文档导入流程：**
1. 前端上传文件 → `/api/knowledge/import` API Route
2. 根据文件类型选择解析器：
   - PDF：使用 `pdf-parse` 库提取文本 → 按段落分块
   - Excel/CSV：按行读取，识别 Q&A 列映射
   - JSON（历史对话）：调用 OpenClaw 提取请求-回复对
3. 每个分块调用 OpenClaw 生成结构化规则（condition + content + tags）
4. 规则以 `status=pending` 入库，等待用户在 W3b 审核
5. 审核通过后 `status=active`，触发 `syncToMemory()`

**冲突检测算法：**
1. 新规则入库前，用其 condition 作为查询调用 OpenClaw
2. OpenClaw 比对现有规则，判断是否有语义矛盾
3. 有矛盾的规则标记 `conflictsWith` 字段，在 W3b 中高亮显示

### P2：对话学习引擎 (LearningLoop)

**文件：** `lib/knowledge/learning.ts`

**职责：** 从人类修改中提取规则 + 噪音过滤 + 置信度管理

**数据模型：**

```prisma
model LearningCandidate {
  id              String   @id @default(cuid())
  ticketId        String   // 来源工单
  originalReply   String   // AI 原始回复
  editedReply     String   // 人类修改后的回复
  diffType        String   // "semantic" | "cosmetic" — 语义修改 vs 措辞修改
  extractedRule   String?  // JSON: { condition, content, tags } — 提取的候选规则
  confidence      Float    @default(0.5)
  status          String   @default("pending") // "pending" | "approved" | "rejected" | "ignored"
  createdAt       DateTime @default(now())
  reviewedAt      DateTime?
}
```

**接口：**

```typescript
interface LearningLoop {
  // 核心流程
  analyzeEdit(original: string, edited: string, context: TicketContext): Promise<LearningCandidate>
  extractRule(candidate: LearningCandidate): Promise<ExtractedRule | null>

  // 噪音过滤
  classifyDiff(original: string, edited: string): Promise<"semantic" | "cosmetic">

  // 置信度
  updateConfidence(ruleId: string, signal: "positive" | "negative"): Promise<void>

  // 批量管理
  listCandidates(filters: CandidateFilters): Promise<LearningCandidate[]>
  approveCandidate(id: string): Promise<KnowledgeRule>  // 候选规则 → 正式规则
  rejectCandidate(id: string): Promise<void>
}
```

**修改分类（噪音过滤）流程：**
1. 用户在 W3a 修改 AI 回复并发送
2. 系统计算 original vs edited 的 diff
3. 调用 OpenClaw 判断修改类型：
   - prompt: "比较以下两段回复，判断修改是语义层面的（改了策略/流程/信息）还是措辞层面的（只是换了表述方式，意思不变）"
   - 返回: `"semantic"` 或 `"cosmetic"`
4. `cosmetic` 修改：不创建学习候选，流程结束
5. `semantic` 修改：弹出提示"要将这次修改学习为新规则吗？"
   - 用户选"是"→ 调用 `extractRule()` 创建 LearningCandidate
   - 用户选"否"→ 流程结束
   - 用户可覆盖分类（强制学习或强制不学习）

**置信度机制：**
- 新规则初始置信度 0.5
- 同类修改出现 3+ 次 → 置信度提升至 0.8
- 规则被引用且回复未被修改 → hitCount++，置信度缓慢提升
- 规则被引用但回复被修改 → 置信度降低 0.1
- 置信度 < 0.2 → 自动标记为 deprecated

### P3：OpenClaw 记忆层 (MemoryLayer)

**文件：** `lib/knowledge/memory.ts`

**职责：** OpenClaw 记忆文件管理 + 对话式知识增强 + 知识驱动的回复生成

**接口：**

```typescript
interface MemoryLayer {
  // 记忆文件管理
  syncFromStore(): Promise<void>           // 结构层 → 记忆文件
  getMemoryStats(): Promise<MemoryStats>   // 记忆文件统计

  // 对话增强（P3 核心）
  enhanceViaChat(userMessage: string): Promise<EnhanceResult>
  // 用户说："退货超过7天先道歉再引导仲裁"
  // → OpenClaw 解析为 { condition: "退货超过7天", content: "先表达歉意...", tags: ["退货","售后"] }
  // → 返回候选规则供用户确认

  // 知识驱动的回复生成
  generateReply(ticket: TicketContext, rules?: KnowledgeRule[]): Promise<GenerateResult>
  // GenerateResult 包含: reply, citedRules[], reasoning
}
```

**记忆文件格式：**

```markdown
# 客服知识库 — 退货政策

## 规则 (rule-id: clxxx1)
- **条件**: 客户咨询退货流程
- **回复**: 您好，我们支持7天无理由退货。请...
- **置信度**: 0.9
- **标签**: 退货, 售后

## 规则 (rule-id: clxxx2)
- **条件**: 退货超过7天
- **回复**: 非常抱歉，已超过7天退货期限。建议您...
- **置信度**: 0.8
- **标签**: 退货, 售后, 仲裁
```

**回复生成的 OpenClaw 调用：**

```
你是一个专业的电商客服代表。

## 可用知识
{从 memorySearch 召回的相关知识规则}

## 客户上下文
- 平台: {channel}
- 客户: {customerName}
- 订单: {orderId}, 状态: {orderStatus}
- 历史工单: {previousTickets}

## 客户消息
{customerMessage}

## 要求
1. 基于上述知识规则生成回复
2. 在回复后列出引用了哪些规则（rule-id）
3. 说明你的推理过程
4. 如果售前咨询，侧重推荐和转化
5. 如果售后问题，侧重解决问题和安抚
```

### P4：多平台连接器 (ChannelManager)

**文件：** `lib/channels/manager.ts`

**数据模型：**

```prisma
model Channel {
  id          String   @id @default(cuid())
  type        String   // "taobao" | "pinduoduo" | "shopify" | "douyin" | "email"
  name        String   // 用户命名，如"淘宝主店"
  config      String   // JSON: 平台特定配置（加密存储）
  status      String   @default("disconnected") // "connected" | "disconnected" | "error"
  lastSync    DateTime?
  messageCount Int     @default(0)
  errorMsg    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tickets     Ticket[]
}

model Ticket {
  id              String   @id @default(cuid())
  channelId       String?
  channel         Channel? @relation(fields: [channelId], references: [id])
  externalId      String?  // 平台原始消息 ID
  customerName    String
  customerMessage String
  intent          String?  // "presale" | "aftersale" | "logistics" | "complaint" | "general"
  sentiment       String?  // "positive" | "neutral" | "negative"
  orderId         String?
  orderInfo       String?  // JSON: 关联订单信息
  status          String   @default("pending") // "pending" | "ai_drafting" | "awaiting_review" | "replied" | "closed"
  aiReply         String?  // AI 生成的回复
  aiReasoning     String?  // JSON: { citedRules[], thinkingProcess }
  finalReply      String?  // 最终发送的回复（可能经过修改）
  repliedAt       DateTime?
  repliedVia      String?  // "auto" | "manual" | "ai_approved"
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**接口：**

```typescript
interface ChannelManager {
  // 渠道管理
  addChannel(type: ChannelType, config: ChannelConfig): Promise<Channel>
  testConnection(id: string): Promise<TestResult>
  removeChannel(id: string): Promise<void>
  listChannels(): Promise<Channel[]>

  // 消息收发
  fetchNewMessages(channelId: string): Promise<IncomingMessage[]>
  sendReply(channelId: string, externalId: string, reply: string): Promise<SendResult>

  // 健康监控
  healthCheck(channelId: string): Promise<HealthStatus>
  getMessageStats(channelId: string, range: DateRange): Promise<MessageStats>
}
```

**各平台连接策略：**

| 平台 | 连接方式 | 消息获取 | 回复发送 |
|------|---------|---------|---------|
| 淘宝/天猫 | OAuth → 千牛 API | 轮询（30s 间隔） | REST API |
| 拼多多 | OAuth → 开放平台 | Webhook + 轮询兜底 | REST API |
| Shopify | Admin API Token | Webhook（推荐） | REST API |
| 抖店 | OAuth → 开放平台 | 轮询 | REST API |
| 邮箱 | IMAP/SMTP（ImapFlow） | IMAP IDLE（实时推送） | SMTP（Nodemailer） |

**轮询机制：**
- 使用 Next.js API Route + `setInterval` 在服务端定时拉取
- 开发阶段：手动触发 `/api/channels/[id]/poll`
- 生产阶段：Vercel Cron Job 或外部调度器

**消息归一化：**

```typescript
interface NormalizedMessage {
  externalId: string       // 平台消息 ID
  channelId: string        // 渠道 ID
  customerName: string
  customerMessage: string  // 纯文本（HTML/富文本已转换）
  attachments?: string[]   // 图片/文件 URL（如有）
  orderId?: string         // 关联订单号（如能提取）
  timestamp: Date
  raw: string              // 原始消息 JSON（备查）
}
```

### 页面组件设计

#### W3d：渠道配置中心

**路由：** `/scenarios/customer-service/channels`

**组件树：**
```
ChannelsPage
├── ChannelList             // 已连接渠道卡片列表
│   └── ChannelCard         // 单个渠道：图标+名称+状态灯+消息数
├── AddChannelWizard        // 添加渠道向导（Sheet/Dialog）
│   ├── Step1: PlatformSelector    // 选平台类型
│   ├── Step2: ConfigForm          // 平台特定配置表单
│   ├── Step3: RouteRules          // 消息路由规则（可选）
│   └── Step4: TestAndConfirm      // 测试连接+完成
└── ChannelHealth            // 渠道健康监控面板
```

#### W3b：知识库工作台

**路由：** `/scenarios/customer-service/knowledge`

**组件树：**
```
KnowledgePage
├── Tabs
│   ├── Tab: 规则管理
│   │   ├── RuleFilters        // 筛选栏（来源/标签/状态/置信度）
│   │   ├── RuleTable          // 规则列表表格
│   │   │   └── RuleRow        // 单条规则（内联编辑、冲突高亮）
│   │   └── ImportDropzone     // 文件拖拽上传区
│   │
│   ├── Tab: 待审区
│   │   ├── CandidateFilters   // 筛选（来源工单/置信度）
│   │   └── CandidateList      // 学习候选规则列表
│   │       └── CandidateCard  // 原始回复 vs 修改 vs 提取规则 + 批准/忽略
│   │
│   └── Tab: 对话增强
│       └── ChatPanel          // 与 OpenClaw 的对话窗口
│           ├── ChatMessages   // 消息列表
│           ├── RulePreview    // OpenClaw 生成的规则预览
│           └── ChatInput      // 输入框
│
└── KnowledgeStats             // 侧边栏：规则总数、活跃/待审/废弃、最近更新
```

#### W3a：智能工单中心

**路由：** `/scenarios/customer-service`（迭代现有页面）

**组件树：**
```
CustomerServicePage
├── TicketSidebar (w-80)       // 左侧工单列表
│   ├── TicketFilters          // 筛选 Tab（全部/待回复/已回复）+ 渠道筛选
│   ├── TicketSearch           // 搜索框
│   └── TicketList             // 工单卡片列表
│       └── TicketCard         // 渠道图标+客户名+摘要+状态+时间
│
├── ConversationArea (flex-1)  // 中间对话区
│   ├── TicketHeader           // 客户名+意图标签+情感标签+渠道
│   ├── CustomerMessage        // 客户消息气泡
│   ├── AiDraftPanel           // AI 回复草稿（可内联编辑）
│   │   ├── DraftEditor        // 富文本编辑器
│   │   ├── CitedRules         // 引用的知识规则（可展开/跳转W3b）
│   │   └── ReasoningCollapse  // AI 推理过程（可折叠）
│   └── ActionBar              // 操作栏
│       ├── ApproveButton      // 批准并发送
│       ├── EditSendButton     // 修改并发送（触发学习提示）
│       └── RejectButton       // 拒绝重新生成
│
└── ContextPanel (w-72)        // 右侧上下文面板
    ├── CustomerProfile        // 客户画像（历史工单数、上次联系）
    ├── OrderInfo              // 关联订单信息
    └── QuickActions           // 快捷操作（查订单/查物流）
```

**学习提示交互（EditSendButton 触发）：**
```
用户点击"修改并发送"
  → 后端 classifyDiff(original, edited) → "semantic"
    → 前端弹出 Toast: "检测到语义修改，是否学习为新规则？"
      → [学习] → extractRule() → 创建 LearningCandidate → 显示在 W3b 待审区
      → [跳过] → 不学习，直接发送
  → 后端 classifyDiff(original, edited) → "cosmetic"
    → 直接发送，不弹提示
```

#### W3c：批量运营台

**路由：** `/scenarios/customer-service/batch`

**组件树：**
```
BatchPage
├── Tabs
│   ├── Tab: 批量工单审核
│   │   ├── BatchFilters       // 筛选（渠道/意图/置信度区间）
│   │   ├── BatchToolbar       // 全选/批量操作按钮
│   │   ├── SpotCheckDialog    // F7 批量预检弹窗（随机 3-5 条详情）
│   │   └── CompactTicketList  // 紧凑列表（虚拟滚动）
│   │       └── CompactRow     // 复选框+摘要+AI回复预览+置信度
│   │
│   └── Tab: 批量规则管理
│       ├── CandidateFilters   // 来源/置信度/时间
│       ├── BatchRuleToolbar   // 批量入库/忽略
│       └── CandidateTable     // 候选规则表格
│
└── BatchStats                 // 本次操作统计：处理数、通过率、节省时间
```

---

## 数据流

### 核心数据流：消息→回复→学习

```
1. 消息进入
   Channel Poll/Webhook → NormalizedMessage → Ticket (status=pending)
   → SSE: ticket:created

2. AI 草稿生成
   Ticket → P1 检索相关规则 → P3 OpenClaw 生成回复
   → Ticket (status=awaiting_review, aiReply=..., aiReasoning=...)
   → SSE: ticket:draft_ready

3. 人类审核
   a) 批准 → Ticket (status=replied) → P4 发送到原渠道
   b) 修改 → P2 分析 diff → 学习候选 → Ticket (status=replied) → P4 发送
   c) 拒绝 → 重新生成（回到步骤 2）

4. 学习闭环
   LearningCandidate (status=pending) → 用户在 W3b 审核
   → 批准 → KnowledgeRule (status=active) → syncToMemory()
   → OpenClaw 记忆更新 → 下次生成回复时知识已更新
```

### 知识导入数据流

```
文件上传 → 解析器（PDF/Excel/CSV/JSON）→ 文本分块
→ OpenClaw 批量提取规则 → KnowledgeRule (status=pending)
→ 用户在 W3b 审核 → 批准 → status=active → syncToMemory()
```

### 对话增强数据流

```
用户在 W3b 输入自然语言 → OpenClaw 解析为结构化规则
→ 预览显示给用户 → 确认 → KnowledgeRule (status=active)
→ syncToMemory()
```

---

## API 设计

### 知识库 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/knowledge/rules` | 规则列表（分页+筛选） |
| POST | `/api/knowledge/rules` | 创建规则 |
| PATCH | `/api/knowledge/rules/[id]` | 更新规则 |
| DELETE | `/api/knowledge/rules/[id]` | 删除规则 |
| POST | `/api/knowledge/import` | 文件导入（multipart） |
| POST | `/api/knowledge/import-conversations` | 历史对话导入 |
| POST | `/api/knowledge/sync` | 手动触发同步到 OpenClaw 记忆 |
| GET | `/api/knowledge/stats` | 知识库统计 |

### 学习引擎 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/learning/candidates` | 学习候选列表 |
| POST | `/api/learning/analyze` | 分析一次修改（diff分类+规则提取） |
| PATCH | `/api/learning/candidates/[id]` | 审核候选（approve/reject/ignore） |
| POST | `/api/learning/candidates/batch` | 批量审核 |

### 工单 API（迭代现有）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/tickets` | 工单列表（含渠道筛选） |
| GET | `/api/tickets/[id]` | 工单详情（含 AI 推理 + 引用规则） |
| POST | `/api/tickets/[id]/approve` | 批准并发送 |
| POST | `/api/tickets/[id]/edit-send` | 修改并发送（触发学习分析） |
| POST | `/api/tickets/[id]/reject` | 拒绝重新生成 |
| POST | `/api/tickets/batch-approve` | 批量审批（含预检） |
| POST | `/api/tickets/batch-approve/preview` | 批量预检（返回随机 3-5 条） |

### 渠道 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/channels` | 渠道列表 |
| POST | `/api/channels` | 添加渠道 |
| DELETE | `/api/channels/[id]` | 删除渠道 |
| POST | `/api/channels/[id]/test` | 测试连接 |
| POST | `/api/channels/[id]/poll` | 手动拉取消息 |
| GET | `/api/channels/[id]/health` | 健康状态 |
| GET | `/api/channels/[id]/stats` | 消息统计 |

### 对话增强 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/knowledge/chat` | 与 OpenClaw 对话增强知识库 |
| GET | `/api/knowledge/chat/history` | 对话历史 |

---

## 错误处理策略

### 平台连接失败
- **检测**：`healthCheck()` 每 5 分钟执行，连续 3 次失败标记 `status=error`
- **降级**：连接断开时，工单中心仍可处理已有工单，新消息暂停进入
- **恢复**：W3d 显示错误详情 + "重新连接"按钮

### OpenClaw 不可用
- **检测**：回复生成超时（30s）或进程异常退出
- **降级**：
  - 回复生成失败 → 工单标记为 `ai_failed`，提示用户手动回复
  - 知识同步失败 → 结构层数据不受影响，仅语义层暂时过期
- **恢复**：OpenClaw 恢复后自动触发一次 `syncToMemory()`

### 学习引擎异常
- **检测**：diff 分析超时或返回无效结果
- **降级**：跳过学习流程，回复正常发送，记录失败日志
- **不阻塞**：学习是增值功能，绝不能阻塞核心"回复客户"流程

### 文件导入失败
- **检测**：解析错误、OpenClaw 提取超时
- **降级**：返回已成功解析的部分规则 + 失败行号列表
- **恢复**：用户可选择只入库成功的部分，或修改文件后重新导入

---

## 测试策略

### 单元测试
- `KnowledgeStore`：规则 CRUD、冲突检测逻辑、同步触发
- `LearningLoop`：diff 分类（预设 semantic/cosmetic 案例）、置信度计算
- `ChannelManager`：消息归一化（各平台格式转换）

### 集成测试
- 完整流程：创建规则 → 同步到 OpenClaw → 生成回复 → 验证引用了正确规则
- 学习闭环：修改回复 → 分析 diff → 提取规则 → 审核 → 同步 → 下次引用

### E2E 测试（手动）
- 配置邮箱渠道 → 发送测试邮件 → 系统生成工单 → 审核回复 → 验证邮件发出
- 导入产品文档 → 验证规则生成 → 提问相关问题 → 验证回复引用了导入的知识
- 批量审核 20 条工单 → 验证预检弹窗 → 确认全部通过 → 验证回复发送

---

## 技术选型

| 依赖 | 选用版本 | 最新稳定版 | 查证日期 | 选型理由 |
|------|---------|-----------|---------|---------|
| Next.js | 16.1.6 | 16.1.6 | 2026-03-19 | 项目已用，保持一致 |
| Prisma | 7.4.2 | 7.4.2 | 2026-03-19 | 项目已用，新增表即可 |
| SQLite | - | - | - | 项目已用，配合 Prisma |
| OpenClaw CLI | 当前安装版 | - | 2026-03-19 | 项目核心 AI 运行时 |
| ImapFlow | ^1.0.x | 1.0.171 | 2026-03-19 | 现代 IMAP 客户端，API 友好 |
| Nodemailer | ^6.x | 6.10.1 | 2026-03-19 | SMTP 发送成熟方案 |
| pdf-parse | ^1.1.1 | 1.1.1 | 2026-03-19 | PDF 文本提取 |
| xlsx | ^0.18.x | 0.18.5 | 2026-03-19 | Excel/CSV 解析 |
| shadcn/ui | 已安装 | - | - | 保持 UI 一致性 |

**不新增的依赖：**
- 不用 sqlite-vec：语义检索交给 OpenClaw memorySearch，避免维护嵌入管道
- 不用独立消息队列：SQLite + 状态字段 + 定时轮询在项目规模内足够
- 不用 WebSocket：SSE 已有基础设施，新增 ticket 事件类型即可

---

## 风险与缓解

| 风险 | 来源 | 缓解措施 |
|------|------|---------|
| 知识库质量差导致 AI 回复不可用 | 调研：知识库鲜度比精度更致命 | 1. 导入时必须经过人工审核（pending→active）；2. 置信度机制自动废弃低质量规则 |
| 规则冲突导致回复矛盾 | ideation Q3 | F1 冲突检测：入库前 OpenClaw 比对；冲突规则在 W3b 高亮 |
| 学习噪音污染知识库 | ideation Q3 | F2 三层过滤：自动 diff 分类 → 用户确认 → 待审区人工审核 |
| OpenClaw 记忆同步延迟 | 双层架构固有 | 写时重建策略：每次规则变更立即触发全量同步（<100ms） |
| 平台 API 变更导致连接失败 | 电商平台 API 不稳定 | 健康检查 + 错误详情展示 + 手动重连；MVP 阶段先支持邮箱（IMAP 标准协议，最稳定） |
| 批量审批通过问题回复 | ideation Q3 | F7 批量预检：随机抽检 3-5 条，确认后再全部通过 |

---

## 已知限制

1. **MVP 阶段平台连接器是轮询模式**：淘宝/拼多多等平台的 Webhook 需要公网回调 URL，本地开发无法直接使用。MVP 用定时轮询，生产部署后切 Webhook。
2. **OpenClaw memorySearch 的召回质量依赖记忆文件的组织方式**：需要实验不同的 Markdown 结构（按标签分文件 vs 按类型分文件），找到最优组织。
3. **历史对话导入的规则提取质量取决于对话数据质量**：格式混乱或语言不规范的对话可能提取出低质量规则，需要人工筛选。
4. **各电商平台 API 申请有审核周期**：淘宝/拼多多开放平台需要注册并审核，可能需要 3-7 天。MVP 阶段建议先接通邮箱（零审核）和模拟数据。
5. **批量预检是随机抽样**：不保证覆盖所有问题类型，高风险场景（如投诉类工单）建议不走批量审批。

---

## 与现有系统的集成点

| 现有组件 | 集成方式 |
|---------|---------|
| `lib/workflow/engine.ts` | 复用工作流引擎触发 AI 回复生成，但工单处理不再走完整工作流（太重），改为直接调用 |
| `lib/workflow/sse-emitter.ts` | 扩展 SSE 事件类型：`ticket:created`, `ticket:draft_ready`, `ticket:replied`, `knowledge:synced` |
| `lib/dre/draft-service.ts` | W3b 待审规则复用 DRE 的审批模式（pending→approved/rejected） |
| `lib/openclaw/client.ts` | 扩展 `sendToOpenClaw()` 支持新的 skill（knowledge-extract, diff-analyze, reply-generate, chat-enhance） |
| `app/approval/page.tsx` | 审批中心新增"知识规则"类型的 Draft 卡片 |
| `prisma/schema.prisma` | 新增 KnowledgeRule, LearningCandidate, Channel, Ticket 四个表 |
| `lib/constants.ts` | 侧栏导航"客服工单"展开为子菜单（工单中心/知识库/批量台/渠道配置） |
