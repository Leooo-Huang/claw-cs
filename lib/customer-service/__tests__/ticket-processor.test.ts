import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    ticket: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    knowledgeRule: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    knowledgeChunk: {
      findMany: vi.fn(),
    },
    learningCandidate: { create: vi.fn() },
  },
}))

vi.mock('@/lib/openclaw/client', () => ({
  sendToOpenClaw: vi.fn(),
}))

vi.mock('../sse-events', () => ({
  csEmitter: { emit: vi.fn() },
}))

vi.mock('../learning-loop', () => ({
  extractLearningCandidate: vi.fn(),
}))

const mockVs = {
  init: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
  upsert: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}

vi.mock('../vector-store', () => ({
  getVectorStore: vi.fn(() => mockVs),
}))

import { prisma } from '@/lib/db/prisma'
import { sendToOpenClaw } from '@/lib/openclaw/client'
import { csEmitter } from '../sse-events'
import { generateAiDraft } from '../ticket-processor'

const mockPrisma = vi.mocked(prisma)
const mockSendToOpenClaw = vi.mocked(sendToOpenClaw)
const mockCsEmitter = vi.mocked(csEmitter)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateAiDraft', () => {
  const mockTicket = {
    id: 'ticket-1',
    customerName: '张三',
    customerMessage: '我的包裹怎么还没到？',
    intent: '售后-物流',
    sentiment: '不满',
    orderId: 'ORD-001',
    channelId: 'ch-1',
    channelType: 'mock',
    status: 'pending',
    citedRuleIds: '[]',
    aiReply: null,
    aiReasoning: null,
    aiConfidence: null,
    aiSearchMeta: null,
    finalReply: null,
    repliedVia: null,
    repliedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('should call OpenClaw with knowledge rules context when available', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket as any)
    mockPrisma.ticket.update.mockResolvedValue({ ...mockTicket, status: 'ai_drafting' } as any)
    mockVs.query.mockResolvedValue([
      { id: 'rule-1', score: 0.85, metadata: { tags: '物流' }, document: '物流查询 您的包裹已发出' },
    ])
    mockPrisma.knowledgeRule.findMany.mockResolvedValue([
      { id: 'rule-1', condition: '物流查询', content: '您的包裹已发出', confidence: 0.9, tags: '["物流"]', hitCount: 5, status: 'active', source: 'document', sourceRef: null, category: 'general', conflictsWith: '[]', createdAt: new Date(), updatedAt: new Date() },
    ] as any)
    ;(mockPrisma as any).knowledgeChunk.findMany.mockResolvedValue([])
    mockSendToOpenClaw.mockResolvedValue({ queued: true })

    const result = await generateAiDraft('ticket-1')

    expect(result.status).toBe('queued')
    expect(mockSendToOpenClaw).toHaveBeenCalledWith(
      'customer-service',
      expect.objectContaining({
        customerMessage: '我的包裹怎么还没到？',
        customerName: '张三',
        intent: '售后-物流',
        knowledgeRules: expect.arrayContaining([
          expect.objectContaining({ id: 'rule-1', condition: '物流查询' }),
        ]),
        ticketId: 'ticket-1',
      }),
      'ticket-1',
      'generate-draft',
    )
  })

  it('should set ticket status to ai_drafting before calling OpenClaw', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket as any)
    mockPrisma.ticket.update.mockResolvedValue({ ...mockTicket, status: 'ai_drafting' } as any)
    mockPrisma.knowledgeRule.findMany.mockResolvedValue([])
    mockSendToOpenClaw.mockResolvedValue({ queued: true })

    await generateAiDraft('ticket-1')

    expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      data: { status: 'ai_drafting' },
    })
  })

  it('should emit ai_generating SSE event', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket as any)
    mockPrisma.ticket.update.mockResolvedValue({ ...mockTicket } as any)
    mockPrisma.knowledgeRule.findMany.mockResolvedValue([])
    mockSendToOpenClaw.mockResolvedValue({ queued: true })

    await generateAiDraft('ticket-1')

    expect(mockCsEmitter.emit).toHaveBeenCalledWith({
      type: 'ticket:ai_generating',
      ticketId: 'ticket-1',
    })
  })

  it('should fallback to template reply when OpenClaw is unavailable', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket as any)
    mockPrisma.ticket.update.mockResolvedValue({ ...mockTicket } as any)
    mockPrisma.knowledgeRule.findMany.mockResolvedValue([])
    mockSendToOpenClaw.mockResolvedValue({ queued: false })

    const result = await generateAiDraft('ticket-1')

    expect(result.status).toBe('fallback')
    // Should update ticket with template reply
    expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1' },
        data: expect.objectContaining({
          status: 'awaiting_review',
          aiReply: expect.stringContaining('张三'),
          aiReasoning: 'OpenClaw 不可用，使用模板回复',
          aiConfidence: 0.6,
        }),
      }),
    )
  })

  it('should emit draft_ready SSE event on fallback', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue(mockTicket as any)
    mockPrisma.ticket.update.mockResolvedValue({ ...mockTicket } as any)
    mockPrisma.knowledgeRule.findMany.mockResolvedValue([])
    mockSendToOpenClaw.mockResolvedValue({ queued: false })

    await generateAiDraft('ticket-1')

    expect(mockCsEmitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ticket:draft_ready',
        ticketId: 'ticket-1',
        draftData: expect.objectContaining({
          reply: expect.any(String),
          confidence: 0.6,
        }),
      }),
    )
  })

  it('should throw when ticket not found', async () => {
    mockPrisma.ticket.findUnique.mockResolvedValue(null)

    await expect(generateAiDraft('nonexistent')).rejects.toThrow('Ticket not found')
  })
})
