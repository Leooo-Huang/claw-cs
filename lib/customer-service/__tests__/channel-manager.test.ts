import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    channel: { findUnique: vi.fn(), update: vi.fn() },
    ticket: { create: vi.fn() },
  },
}))

vi.mock('../ticket-processor', () => ({
  generateAiDraft: vi.fn(),
}))

vi.mock('../sse-events', () => ({
  csEmitter: { emit: vi.fn() },
}))

import { prisma } from '@/lib/db/prisma'
import { generateAiDraft } from '../ticket-processor'
import { csEmitter } from '../sse-events'
import { pollMessages } from '../channel-manager'

const mockPrisma = vi.mocked(prisma)
const mockGenerateAiDraft = vi.mocked(generateAiDraft)
const mockCsEmitter = vi.mocked(csEmitter)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('pollMessages', () => {
  it('should create a mock ticket and auto-trigger AI draft generation', async () => {
    mockPrisma.channel.findUnique.mockResolvedValue({
      id: 'ch-1',
      type: 'mock',
      name: '模拟渠道',
      status: 'connected',
      config: '{}',
      errorMsg: null,
      messageCount: 0,
      lastPollAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    mockPrisma.ticket.create.mockResolvedValue({
      id: 'ticket-new',
      channelId: 'ch-1',
      channelType: 'mock',
      customerName: '张三',
      customerMessage: '测试消息',
      status: 'pending',
    } as any)

    mockPrisma.channel.update.mockResolvedValue({} as any)
    mockGenerateAiDraft.mockResolvedValue({ status: 'queued', ticketId: 'ticket-new' })

    const count = await pollMessages('ch-1')

    expect(count).toBe(1)
    expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channelId: 'ch-1',
          channelType: 'mock',
          status: 'pending',
        }),
      }),
    )

    // Verify ticket:created SSE event emitted
    expect(mockCsEmitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ticket:created' }),
    )

    // Verify AI draft auto-triggered (fire-and-forget)
    // Need to wait for the microtask to execute
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(mockGenerateAiDraft).toHaveBeenCalledWith('ticket-new')
  })

  it('should return 0 for disconnected channel', async () => {
    mockPrisma.channel.findUnique.mockResolvedValue({
      id: 'ch-1',
      type: 'mock',
      status: 'disconnected',
    } as any)

    const count = await pollMessages('ch-1')
    expect(count).toBe(0)
  })

  it('should return 0 for non-mock channel type', async () => {
    mockPrisma.channel.findUnique.mockResolvedValue({
      id: 'ch-1',
      type: 'taobao',
      status: 'connected',
    } as any)

    const count = await pollMessages('ch-1')
    expect(count).toBe(0)
  })
})
