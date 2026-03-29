import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    ticket: { findUnique: vi.fn() },
    learningCandidate: { create: vi.fn(), count: vi.fn(), update: vi.fn() },
    knowledgeRule: { create: vi.fn() },
  },
}))

vi.mock('@/lib/openclaw/client', () => ({
  sendToOpenClaw: vi.fn(),
  callOpenClawSync: vi.fn(),
}))

vi.mock('../sse-events', () => ({
  csEmitter: { emit: vi.fn() },
}))

vi.mock('../knowledge-store', () => ({
  createRule: vi.fn(),
}))

import * as openclawClient from '@/lib/openclaw/client'
import { analyzeEditDiffQuick, classifyDiffAsync, extractLearningCandidate } from '../learning-loop'
import { prisma } from '@/lib/db/prisma'
import { csEmitter } from '../sse-events'

const mockCallOpenClawSync = vi.mocked(openclawClient.callOpenClawSync)
const mockPrisma = vi.mocked(prisma)
const mockCsEmitter = vi.mocked(csEmitter)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('analyzeEditDiffQuick', () => {
  it('should return cosmetic for identical text', () => {
    const result = analyzeEditDiffQuick('你好', '你好')
    expect(result).toEqual({ isSemanticChange: false, diffType: 'cosmetic' })
  })

  it('should return semantic for different text (conservative)', () => {
    const result = analyzeEditDiffQuick('支持退货', '不支持退货')
    expect(result).toEqual({ isSemanticChange: true, diffType: 'semantic' })
  })
})

describe('classifyDiffAsync', () => {
  it('should auto-ignore candidate when AI says cosmetic', async () => {
    mockCallOpenClawSync.mockResolvedValue({ diffType: 'cosmetic', reason: '只改了语气' })
    mockPrisma.learningCandidate.update.mockResolvedValue({} as any)

    await classifyDiffAsync('candidate-1', '原文', '修改后')

    expect(mockPrisma.learningCandidate.update).toHaveBeenCalledWith({
      where: { id: 'candidate-1' },
      data: { diffType: 'cosmetic', status: 'ignored' },
    })
    expect(mockCsEmitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'learning:diff_classified',
        result: expect.objectContaining({ diffType: 'cosmetic', autoIgnored: true }),
      }),
    )
  })

  it('should keep candidate when AI says semantic', async () => {
    mockCallOpenClawSync.mockResolvedValue({ diffType: 'semantic', reason: '修改了退货政策' })
    mockPrisma.learningCandidate.update.mockResolvedValue({} as any)

    await classifyDiffAsync('candidate-2', '原文', '修改后')

    expect(mockPrisma.learningCandidate.update).toHaveBeenCalledWith({
      where: { id: 'candidate-2' },
      data: { diffType: 'semantic' },
    })
  })

  it('should keep candidate as semantic when AI unavailable', async () => {
    mockCallOpenClawSync.mockResolvedValue(null)

    await classifyDiffAsync('candidate-3', '原文', '修改后')

    // No update call — candidate stays as-is (conservative semantic)
    expect(mockPrisma.learningCandidate.update).not.toHaveBeenCalled()
  })
})

describe('extractLearningCandidate', () => {
  it('should create a learning candidate for semantic changes', async () => {
    mockCallOpenClawSync.mockResolvedValue(null) // background classify won't block
    mockPrisma.ticket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      intent: '售后-退货',
      customerMessage: '我要退货',
    } as any)
    mockPrisma.learningCandidate.create.mockResolvedValue({
      id: 'candidate-1',
      ticketId: 'ticket-1',
    } as any)

    const result = await extractLearningCandidate(
      'ticket-1',
      '支持7天无理由退货',
      '已超过退货期限，无法退货',
    )

    expect(result.candidateId).toBe('candidate-1')
    expect(result.isSemanticChange).toBe(true)
    expect(mockPrisma.learningCandidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: 'ticket-1',
        originalReply: '支持7天无理由退货',
        editedReply: '已超过退货期限，无法退货',
        diffType: 'semantic',
      }),
    })
  })

  it('should emit learning:new_candidate SSE event', async () => {
    mockCallOpenClawSync.mockResolvedValue(null)
    mockPrisma.ticket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      intent: '售后-退货',
    } as any)
    mockPrisma.learningCandidate.create.mockResolvedValue({
      id: 'candidate-1',
      ticketId: 'ticket-1',
    } as any)

    await extractLearningCandidate('ticket-1', '原文', '修改后')

    expect(mockCsEmitter.emit).toHaveBeenCalledWith({
      type: 'learning:new_candidate',
      candidateId: 'candidate-1',
      ticketId: 'ticket-1',
    })
  })

  it('should return null candidateId for identical replies', async () => {
    const result = await extractLearningCandidate('ticket-1', '同样的回复', '同样的回复')
    expect(result.candidateId).toBeNull()
    expect(result.isSemanticChange).toBe(false)
  })

  it('should boost confidence by 0.05 when same intent has >= 3 approved candidates', async () => {
    mockCallOpenClawSync.mockResolvedValue(null)
    mockPrisma.ticket.findUnique.mockResolvedValue({
      id: 'ticket-2',
      intent: '售后-退货',
      customerMessage: '我要退货',
    } as any)
    // 3 previous approved candidates with same intent
    mockPrisma.learningCandidate.count.mockResolvedValue(3)
    mockPrisma.learningCandidate.create.mockResolvedValue({
      id: 'candidate-2',
      ticketId: 'ticket-2',
    } as any)

    await extractLearningCandidate('ticket-2', '原文', '修改后内容变了很多')

    expect(mockPrisma.learningCandidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confidence: 0.75, // 0.7 + 0.05
      }),
    })
  })

  it('should cap confidence at 0.95', async () => {
    mockCallOpenClawSync.mockResolvedValue(null)
    mockPrisma.ticket.findUnique.mockResolvedValue({
      id: 'ticket-3',
      intent: '售后-退货',
      customerMessage: '我要退货',
    } as any)
    // Many approved candidates
    mockPrisma.learningCandidate.count.mockResolvedValue(100)
    mockPrisma.learningCandidate.create.mockResolvedValue({
      id: 'candidate-3',
      ticketId: 'ticket-3',
    } as any)

    await extractLearningCandidate('ticket-3', '原文', '修改后内容变化了')

    expect(mockPrisma.learningCandidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confidence: expect.any(Number),
      }),
    })
    // Verify confidence <= 0.95
    const call = mockPrisma.learningCandidate.create.mock.calls[0][0]
    expect((call as any).data.confidence).toBeLessThanOrEqual(0.95)
  })

  it('should use base confidence 0.7 when fewer than 3 approved candidates', async () => {
    mockCallOpenClawSync.mockResolvedValue(null)
    mockPrisma.ticket.findUnique.mockResolvedValue({
      id: 'ticket-4',
      intent: '售后-退货',
      customerMessage: '我要退货',
    } as any)
    mockPrisma.learningCandidate.count.mockResolvedValue(1)
    mockPrisma.learningCandidate.create.mockResolvedValue({
      id: 'candidate-4',
      ticketId: 'ticket-4',
    } as any)

    await extractLearningCandidate('ticket-4', '原文', '修改后内容较长了')

    expect(mockPrisma.learningCandidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confidence: 0.7,
      }),
    })
  })
})
