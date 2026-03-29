import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    knowledgeRule: {
      findMany: vi.fn(),
    },
  },
}))

const mockVs = {
  init: vi.fn().mockResolvedValue(undefined),
  upsert: vi.fn().mockResolvedValue(undefined),
  size: 0,
}

vi.mock('../vector-store', () => ({
  getVectorStore: vi.fn(() => mockVs),
}))

import { prisma } from '@/lib/db/prisma'
import { initializeVectorStore } from '../vector-init'

const mockPrisma = vi.mocked(prisma)

beforeEach(() => {
  vi.clearAllMocks()
  mockVs.size = 0
})

describe('initializeVectorStore', () => {
  it('should batch upsert all active rules into vector store', async () => {
    const rules = [
      { id: 'r1', condition: '退货', content: '支持7天退货', tags: '["退货"]', confidence: 0.8 },
      { id: 'r2', condition: '物流', content: '预计3天', tags: '["物流"]', confidence: 0.9 },
    ]
    mockPrisma.knowledgeRule.findMany.mockResolvedValue(rules as any)

    const count = await initializeVectorStore()

    expect(count).toBe(2)
    expect(mockVs.upsert).toHaveBeenCalledTimes(2)
    expect(mockVs.upsert).toHaveBeenCalledWith('r1', '退货', '支持7天退货', { type: 'rule', tags: '退货' })
    expect(mockVs.upsert).toHaveBeenCalledWith('r2', '物流', '预计3天', { type: 'rule', tags: '物流' })
  })

  it('should skip initialization when vector store already has data', async () => {
    mockVs.size = 10 // already populated

    const count = await initializeVectorStore()

    expect(count).toBe(0)
    expect(mockPrisma.knowledgeRule.findMany).not.toHaveBeenCalled()
  })

  it('should force re-initialization when force=true', async () => {
    mockVs.size = 10
    const rules = [
      { id: 'r1', condition: '退货', content: '支持7天退货', tags: '["退货"]', confidence: 0.8 },
    ]
    mockPrisma.knowledgeRule.findMany.mockResolvedValue(rules as any)

    const count = await initializeVectorStore(true)

    expect(count).toBe(1)
    expect(mockVs.upsert).toHaveBeenCalledTimes(1)
  })

  it('should return 0 when no active rules exist', async () => {
    mockPrisma.knowledgeRule.findMany.mockResolvedValue([])

    const count = await initializeVectorStore()

    expect(count).toBe(0)
    expect(mockVs.upsert).not.toHaveBeenCalled()
  })
})
