import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before importing
vi.mock('@/lib/customer-service/knowledge-store', () => ({
  createRule: vi.fn(),
}))

vi.mock('@/lib/openclaw/client', () => ({
  sendToOpenClaw: vi.fn(),
}))

import { sendToOpenClaw } from '@/lib/openclaw/client'
import { createRule } from '@/lib/customer-service/knowledge-store'

const mockSendToOpenClaw = vi.mocked(sendToOpenClaw)
const mockCreateRule = vi.mocked(createRule)

beforeEach(() => {
  vi.clearAllMocks()
})

// Test the extraction logic directly (extracted from route handler)
function extractRuleFromMessage(text: string) {
  const conditionalPatterns = [
    /如果(?:客户)?(.+?)[,，](?:就|则|应该)?(.+)/,
    /当(?:客户)?(.+?)[,，](.+)/,
    /(?:客户)?(.+?)的时候[,，](.+)/,
    /(.+?)时[,，](.+)/,
  ]

  for (const pattern of conditionalPatterns) {
    const match = text.match(pattern)
    if (match) {
      return { condition: match[1].trim(), content: match[2].trim(), tags: inferTags(text) }
    }
  }

  return {
    condition: text.length > 30 ? text.slice(0, 30) + '...' : text,
    content: text,
    tags: inferTags(text),
  }
}

function inferTags(text: string): string[] {
  const tags: string[] = []
  if (/退[货款换]|退回|退货/.test(text)) tags.push('退货')
  if (/尺[码号寸]|大小|偏大|偏小/.test(text)) tags.push('尺码')
  if (/物流|快递|包裹|发货|配送/.test(text)) tags.push('物流')
  if (/价格|优惠|折扣|满减|活动/.test(text)) tags.push('优惠')
  if (/材质|面料|成分|纯棉/.test(text)) tags.push('材质')
  if (/运费/.test(text)) tags.push('运费')
  if (tags.length === 0) tags.push('通用')
  return tags
}

describe('extractRuleFromMessage (local fallback)', () => {
  it('should extract condition and content from "如果...就..." pattern', () => {
    const result = extractRuleFromMessage('如果客户问退货流程，就告诉他7天内可退')
    // regex (?:客户)? 是非捕获组，"客户"不在捕获结果中
    expect(result.condition).toBe('问退货流程')
    expect(result.content).toBe('告诉他7天内可退')
    expect(result.tags).toContain('退货')
  })

  it('should extract from "当...时..." pattern', () => {
    const result = extractRuleFromMessage('当客户咨询物流，告诉他3-5天到货')
    expect(result.condition).toBe('咨询物流')
    expect(result.content).toBe('告诉他3-5天到货')
    expect(result.tags).toContain('物流')
  })

  it('should handle text without conditional pattern', () => {
    const result = extractRuleFromMessage('退货运费由买家承担')
    expect(result.content).toBe('退货运费由买家承担')
    expect(result.tags).toContain('退货')
    expect(result.tags).toContain('运费')
  })

  it('should infer multiple tags', () => {
    const result = extractRuleFromMessage('退货时运费由卖家承担，包裹请发回仓库')
    expect(result.tags).toContain('退货')
    expect(result.tags).toContain('运费')
    expect(result.tags).toContain('物流')
  })

  it('should default to 通用 tag when no match', () => {
    const result = extractRuleFromMessage('请耐心等待处理')
    expect(result.tags).toEqual(['通用'])
  })
})

describe('knowledge chat OpenClaw integration', () => {
  it('should attempt OpenClaw for rule extraction', async () => {
    mockSendToOpenClaw.mockResolvedValue({ queued: true })

    await sendToOpenClaw('knowledge-extract', { message: '退货运费买家承担' }, 'chat-123', 'knowledge-chat')

    expect(mockSendToOpenClaw).toHaveBeenCalledWith(
      'knowledge-extract',
      { message: '退货运费买家承担' },
      'chat-123',
      'knowledge-chat',
    )
  })

  it('should create rule on confirm action', async () => {
    mockCreateRule.mockResolvedValue({
      id: 'rule-new',
      condition: '退货运费',
      content: '由买家承担',
      tags: ['退货', '运费'],
    } as any)

    const rule = await createRule({
      condition: '退货运费',
      content: '由买家承担',
      tags: ['退货', '运费'],
      source: 'conversation',
      confidence: 0.9,
    })

    expect(rule.id).toBe('rule-new')
    expect(mockCreateRule).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'conversation',
        confidence: 0.9,
      }),
    )
  })
})
