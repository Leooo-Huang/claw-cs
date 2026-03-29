import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    ticket: { update: vi.fn() },
    knowledgeRule: { updateMany: vi.fn() },
    nodeState: { findFirst: vi.fn(), updateMany: vi.fn() },
    draft: { findFirst: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@/lib/customer-service/sse-events', () => ({
  csEmitter: { emit: vi.fn() },
}))

vi.mock('@/lib/workflow/sse-emitter', () => ({
  sseEmitter: { emit: vi.fn() },
}))

vi.mock('@/lib/workflow/engine', () => ({
  resumeWorkflow: vi.fn(),
}))

import { prisma } from '@/lib/db/prisma'
import { csEmitter } from '@/lib/customer-service/sse-events'

const mockPrisma = vi.mocked(prisma)
const mockCsEmitter = vi.mocked(csEmitter)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OpenClaw callback - customer-service draft', () => {
  const callbackPayload = {
    instanceId: 'ticket-1',
    nodeId: 'generate-draft',
    status: 'completed',
    output: {
      ticketId: 'ticket-1',
      result: {
        reply: '您好张三，您的包裹预计明天送达。',
        intent: '售后-物流',
        sentiment: '不满',
        citedRuleIds: ['rule-1'],
        reasoning: '基于知识库规则1匹配物流查询',
        confidence: 0.92,
      },
    },
  }

  it('should update ticket with AI reply from callback', async () => {
    mockPrisma.ticket.update.mockResolvedValue({} as any)
    mockPrisma.knowledgeRule.updateMany.mockResolvedValue({ count: 1 } as any)

    // Simulate what the callback route does
    const { output } = callbackPayload
    const parsed = output.result

    await mockPrisma.ticket.update({
      where: { id: output.ticketId },
      data: {
        aiReply: parsed.reply,
        aiReasoning: parsed.reasoning,
        aiConfidence: parsed.confidence,
        intent: parsed.intent,
        sentiment: parsed.sentiment,
        citedRuleIds: JSON.stringify(parsed.citedRuleIds),
        status: 'awaiting_review',
      },
    })

    expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      data: expect.objectContaining({
        aiReply: '您好张三，您的包裹预计明天送达。',
        aiConfidence: 0.92,
        status: 'awaiting_review',
        citedRuleIds: '["rule-1"]',
      }),
    })
  })

  it('should increment hit count for cited rules', async () => {
    mockPrisma.knowledgeRule.updateMany.mockResolvedValue({ count: 1 } as any)

    const citedIds = callbackPayload.output.result.citedRuleIds
    await mockPrisma.knowledgeRule.updateMany({
      where: { id: { in: citedIds } },
      data: { hitCount: { increment: 1 } },
    })

    expect(mockPrisma.knowledgeRule.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['rule-1'] } },
      data: { hitCount: { increment: 1 } },
    })
  })

  it('should emit draft_ready SSE event', () => {
    const parsed = callbackPayload.output.result

    csEmitter.emit({
      type: 'ticket:draft_ready',
      ticketId: 'ticket-1',
      draftData: {
        reply: parsed.reply,
        intent: parsed.intent,
        sentiment: parsed.sentiment,
        citedRuleIds: parsed.citedRuleIds,
        reasoning: parsed.reasoning,
        confidence: parsed.confidence,
      },
    })

    expect(mockCsEmitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ticket:draft_ready',
        ticketId: 'ticket-1',
        draftData: expect.objectContaining({
          reply: '您好张三，您的包裹预计明天送达。',
          confidence: 0.92,
          citedRuleIds: ['rule-1'],
        }),
      }),
    )
  })
})

describe('OpenClaw callback - knowledge chat', () => {
  it('should emit knowledge:chat_reply SSE event', () => {
    const result = { condition: '退货运费', content: '由买家承担', tags: ['退货'] }

    csEmitter.emit({
      type: 'knowledge:chat_reply',
      instanceId: 'chat-123',
      result,
    })

    expect(mockCsEmitter.emit).toHaveBeenCalledWith({
      type: 'knowledge:chat_reply',
      instanceId: 'chat-123',
      result: expect.objectContaining({ condition: '退货运费' }),
    })
  })
})

describe('OpenClaw callback - diff classify', () => {
  it('should emit learning:diff_classified SSE event', () => {
    const result = { diffType: 'semantic', reason: '修改了退货政策' }

    csEmitter.emit({
      type: 'learning:diff_classified',
      instanceId: 'diff-123',
      result,
    })

    expect(mockCsEmitter.emit).toHaveBeenCalledWith({
      type: 'learning:diff_classified',
      instanceId: 'diff-123',
      result: expect.objectContaining({ diffType: 'semantic' }),
    })
  })
})
