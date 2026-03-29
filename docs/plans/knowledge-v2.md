# 知识库 V2 — 双层架构 + 查重合并 + 导入重构 + AI 过程可视化

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans

**Goal:** 将知识库从"纯规则"改造为"文档+话术规则"双层架构，支持查重/冲突合并，改善导入交互，AI 回复过程可视化

**排除：** 真实渠道连接（已标明 demo）

---

## 架构变更概览

```
之前（V1）:
  所有知识 → KnowledgeRule 表（条件→回复）
  检索 → 向量搜规则 → 喂给 AI

之后（V2）:
  文档类 → KnowledgeDocument + KnowledgeChunk 表（原始段落）
  话术类 → KnowledgeRule 表（条件→标准回复）
  检索 → 向量同时搜文档段落+话术规则 → 两者一起喂给 AI
  导入 → 智能分流：文档存段落，对话提取规则，话术文件两者都做
```

---

## Task 1: 数据模型 — KnowledgeDocument + KnowledgeChunk

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/customer-service/types.ts`

- [ ] **Step 1: 添加 Prisma 模型**

```prisma
model KnowledgeDocument {
  id          String   @id @default(cuid())
  filename    String
  fileType    String   // pdf, xlsx, csv, txt, json
  fileSize    Int      // bytes
  chunkCount  Int      @default(0)
  sourceType  String   // 'product_manual' | 'conversation' | 'script' | 'other'
  status      String   @default("active") // active | deleted
  uploadedAt  DateTime @default(now())
  chunks      KnowledgeChunk[]
}

model KnowledgeChunk {
  id          String   @id @default(cuid())
  documentId  String
  document    KnowledgeDocument @relation(fields: [documentId], references: [id])
  content     String
  chunkIndex  Int
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 2: pnpm db:push**
- [ ] **Step 3: 更新 types.ts**
- [ ] **Step 4: Commit**

---

## Task 2: 文档存储层 — DocumentStore

**Files:**
- Create: `lib/customer-service/document-store.ts`
- Test: `lib/customer-service/__tests__/document-store.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
describe('DocumentStore', () => {
  it('should store a document and split into chunks')
  it('should vectorize each chunk')
  it('should list all documents with chunk counts')
  it('should delete document and remove all chunk vectors')
  it('should split text by paragraphs (min 50 chars)')
  it('should split CSV/Excel by rows')
})
```

- [ ] **Step 2: 实现 document-store.ts**

```typescript
export async function storeDocument(
  filename: string,
  fileType: string,
  buffer: Buffer,
  sourceType: 'product_manual' | 'conversation' | 'script' | 'other'
): Promise<{ documentId: string; chunkCount: number }>

// 1. 提取文本（复用 extractTextFromFile）
// 2. 按段落分块（min 50 chars，不跨段落）
// 3. 写入 Prisma: KnowledgeDocument + KnowledgeChunk[]
// 4. 每个 chunk 写入 VectorStore: id = `chunk-${chunkId}`, document = chunk.content
// 5. 返回 documentId + chunkCount

export async function listDocuments(): Promise<DocumentSummary[]>
export async function deleteDocument(id: string): Promise<void>
export async function getDocumentChunks(id: string): Promise<Chunk[]>
```

- [ ] **Step 3: 运行测试 + Commit**

---

## Task 3: 向量检索统一 — 搜文档+规则

**Files:**
- Modify: `lib/customer-service/vector-store.ts` — 支持 type 标记（chunk vs rule）
- Modify: `lib/customer-service/ticket-processor.ts` — fetchRelevantRules 改为 fetchRelevantKnowledge

- [ ] **Step 1: VectorStore upsert 支持 type metadata**

```typescript
// upsert 时 metadata 加 type 字段
await vs.upsert(id, condition, content, { type: 'rule', tags: '...' })
await vs.upsert(`chunk-${chunkId}`, '', chunkContent, { type: 'chunk', documentId: '...', filename: '...' })
```

- [ ] **Step 2: 改造 fetchRelevantKnowledge**

```typescript
async function fetchRelevantKnowledge(message: string, intent: string | null) {
  const vs = getVectorStore()
  const results = await vs.query(queryText, 8) // 多取一些

  // 按 type 分组
  const chunks = results.filter(r => r.metadata.type === 'chunk')
  const rules = results.filter(r => r.metadata.type === 'rule')

  // 从 Prisma 获取完整数据
  const chunkData = chunks 取 KnowledgeChunk 完整内容 + 关联的 document filename
  const ruleData = rules 取 KnowledgeRule 完整内容

  return { chunks: chunkData, rules: ruleData }
}
```

- [ ] **Step 3: OpenClaw prompt 改造**

```
=== 以下是知识库中与本工单相关的信息 ===

【文档参考】（AI 基于这些内容自由组织回复）
文档: 产品规格说明书.pdf — 段落3
内容: 常规款180g，加厚款280g，冬季加绒款380g。克重越高越厚实。
相似度: 0.91

【话术参考】（如有匹配，优先参考这些标准回复）
条件: 客户问产品材质
回复: 本产品采用100%精梳纯棉面料...
相似度: 0.93

=== 知识库信息结束 ===
```

- [ ] **Step 4: Commit**

---

## Task 4: 规则查重 + 冲突合并

**Files:**
- Modify: `lib/customer-service/knowledge-store.ts` — createRule 时查重+冲突
- Modify: `lib/customer-service/conflict-detector.ts` — 增加查重逻辑

- [ ] **Step 1: 写测试**

```typescript
describe('rule dedup and conflict', () => {
  it('should skip duplicate rule (similarity > 0.9)')
  it('should mark conflicting rules and let user choose')
  it('should merge rules: keep higher confidence one, mark other as deprecated')
})
```

- [ ] **Step 2: 实现查重**

createRule 前：
1. 向量检索同条件的已有规则（相似度 > 0.9）
2. 如果找到 → 返回 `{ action: 'duplicate', existingRule }` 不入库
3. 如果找到相似但矛盾的（0.7-0.9 + 矛盾信号词）→ 返回 `{ action: 'conflict', existingRule, newRule }`
4. 都没找到 → 正常入库

- [ ] **Step 3: 批量入库时的查重**

POST /api/knowledge/rules 批量入库：
- 逐条查重
- 返回结果分三类：`{ created: [...], duplicates: [...], conflicts: [...] }`
- 前端展示：
  - created → 绿色"已入库"
  - duplicates → 灰色"已跳过（重复）"
  - conflicts → 橙色"存在冲突" + 展示新旧两条 + [保留新的] [保留旧的] [都保留]

- [ ] **Step 4: Commit**

---

## Task 5: 导入交互重构 — 不锁弹窗

**Files:**
- Modify: `components/scenarios/customer-service/import-dialog.tsx` — 简化为上传+选择处理方式
- Modify: `app/scenarios/customer-service/knowledge/page.tsx` — 规则以 pending 状态显示在列表中
- Modify: `app/api/knowledge/import/route.ts` — 返回处理结果
- Modify: `app/api/knowledge/import-conversations/route.ts` — 同上

- [ ] **Step 1: 导入弹窗简化**

弹窗只做两件事：
1. 选择文件
2. 选择处理方式（如果需要）

```
┌──────────────────────────────────────┐
│  导入知识                    [✕]     │
├──────────────────────────────────────┤
│                                      │
│  📎 拖拽文件或点击选择               │
│                                      │
│  ─── 检测到文件类型 ───              │
│                                      │
│  📄 客服话术手册.txt                  │
│                                      │
│  处理方式：                           │
│  ☑ 存入文档库（用于 AI 参考）        │
│  ☑ 提取话术规则（用于标准回复）      │
│                                      │
│           [开始处理]                  │
└──────────────────────────────────────┘
```

点击"开始处理"后：
- 弹窗关闭
- 顶部显示进度条/Toast："正在处理 客服话术手册.txt..."
- 处理完成后：
  - 文档出现在"文档库"Tab
  - 提取的规则以 pending 状态出现在"话术规则"Tab
  - 全局通知："已导入 客服话术手册.txt — 8 个段落 + 5 条候选规则"

- [ ] **Step 2: 话术规则 Tab 支持 pending 状态**

pending 规则显示在表格顶部：
- 浅黄背景
- 操作列：[✓ 入库] [✗ 忽略] [✎ 编辑]
- 批量操作：全选 pending → 批量入库

- [ ] **Step 3: 智能分流逻辑**

```typescript
// 根据文件类型 + 内容特征自动判断
function detectSourceType(filename: string, content: string): {
  shouldStoreAsDocument: boolean
  shouldExtractRules: boolean
  sourceType: string
} {
  const ext = filename.split('.').pop()?.toLowerCase()

  // JSON 对话记录
  if (content.trimStart().startsWith('[') && content.includes('"role"')) {
    return { shouldStoreAsDocument: true, shouldExtractRules: true, sourceType: 'conversation' }
  }

  // CSV/Excel 有条件+内容列 → 话术文件
  if (['csv', 'xlsx'].includes(ext) && hasQAColumns(content)) {
    return { shouldStoreAsDocument: true, shouldExtractRules: true, sourceType: 'script' }
  }

  // PDF → 产品手册（默认文档）
  if (ext === 'pdf') {
    return { shouldStoreAsDocument: true, shouldExtractRules: true, sourceType: 'product_manual' }
  }

  // TXT 有管道分隔 → 话术
  if (content.includes('|') && content.split('\n').filter(l => l.includes('|')).length > 3) {
    return { shouldStoreAsDocument: true, shouldExtractRules: true, sourceType: 'script' }
  }

  // 默认：两者都做
  return { shouldStoreAsDocument: true, shouldExtractRules: true, sourceType: 'other' }
}
```

- [ ] **Step 4: Commit**

---

## Task 6: 文档库 Tab UI

**Files:**
- Create: `components/scenarios/customer-service/document-list.tsx`
- Modify: `app/scenarios/customer-service/knowledge/page.tsx` — 添加文档库 Tab

- [ ] **Step 1: 实现文档卡片列表**

- 每个文档显示：文件图标 + 文件名 + 上传时间 + 段落数 + 向量状态
- 可展开查看段落内容
- 删除按钮（AlertDialog 确认）
- 右上角"上传文档"按钮（触发导入弹窗）

- [ ] **Step 2: 文档详情 API**

GET /api/knowledge/documents — 列表
GET /api/knowledge/documents/[id] — 详情（含 chunks）
DELETE /api/knowledge/documents/[id] — 删除（含 chunks + vectors）

- [ ] **Step 3: Commit**

---

## Task 7: AI 思考过程可视化

**Files:**
- Modify: `lib/customer-service/ticket-processor.ts` — generateAiDraft 返回检索过程
- Modify: `lib/openclaw/client.ts` — customer-service prompt 改为双层知识
- Modify: `app/api/openclaw/callback/route.ts` — 保存检索元数据
- Modify: `components/scenarios/customer-service/ai-draft-editor.tsx` — 展示三步过程
- Modify: Prisma schema — ticket 表加 aiSearchMeta 字段

- [ ] **Step 1: ticket 表加检索元数据字段**

```prisma
model Ticket {
  // ...existing fields
  aiSearchMeta  String?  // JSON: { chunks: [...], rules: [...], searchTimeMs: number }
}
```

- [ ] **Step 2: generateAiDraft 保存检索结果**

fetchRelevantKnowledge 的结果保存到 ticket.aiSearchMeta：
```json
{
  "searchTimeMs": 12,
  "chunks": [
    { "id": "chunk-xxx", "filename": "产品规格.pdf", "chunkIndex": 3, "content": "常规款180g...", "score": 0.91 }
  ],
  "rules": [
    { "id": "rule-xxx", "condition": "客户问材质", "content": "本产品采用...", "score": 0.93 }
  ]
}
```

- [ ] **Step 3: OpenClaw prompt 改为双层**

prompt 中分两块注入：
```
【文档参考】
  产品规格说明书.pdf — 段落3: "常规款180g..."

【话术参考】
  条件: 客户问材质 → 回复: "本产品采用..."
```

- [ ] **Step 4: AI 思考过程 UI**

改造 AiDraftEditor 中的"推理过程"折叠面板为三步展示：
- ① 理解意图（intent + sentiment）
- ② 知识检索（文档命中 N 条 + 话术命中 M 条，各显示内容+相似度+来源文件名，耗时）
- ③ 生成回复（推理说明 + 置信度）

数据来自 ticket.aiSearchMeta + ticket.aiReasoning

- [ ] **Step 5: Commit**

---

## Task 8: 端到端测试

- [ ] **Step 1: 单元测试**

```bash
pnpm test  # 全部通过
pnpm build  # 零错误
```

- [ ] **Step 2: E2E 流程 — 文档导入**

1. 上传 产品规格FAQ.csv
2. 弹窗显示处理方式（默认两者都勾选）
3. 点击"开始处理" → 弹窗关闭
4. 文档库 Tab → 看到新文档（段落可展开）
5. 话术规则 Tab → 看到 pending 状态的候选规则
6. 批量入库候选 → 规则变 active

- [ ] **Step 3: E2E 流程 — 工单 RAG**

1. 拉取模拟消息
2. 点击工单 → 看 AI 草稿
3. 展开"AI 思考过程" → 看到 ①②③ 三步
4. ② 中看到文档段落命中 + 话术命中

- [ ] **Step 4: E2E 流程 — 查重验证**

1. 再次导入同一个 CSV
2. 话术规则 Tab → 看到"已跳过（重复）"提示
3. 不会产生重复规则

---

## 改动总览

| Task | 内容 | 核心变化 |
|------|------|---------|
| 1 | 数据模型 | 新增 KnowledgeDocument + KnowledgeChunk 表 |
| 2 | 文档存储层 | 分块 + 向量化 + CRUD |
| 3 | 向量检索统一 | 同时搜文档段落和话术规则 |
| 4 | 查重+冲突合并 | 重复跳过 + 矛盾标记让用户选 |
| 5 | 导入交互重构 | 弹窗简化 → 后台处理 → 列表审核 |
| 6 | 文档库 Tab UI | 文档卡片列表 + 段落展开 |
| 7 | AI 过程可视化 | 三步展示：意图→检索→生成 |
| 8 | 端到端测试 | 3 个 E2E 流程验证 |
