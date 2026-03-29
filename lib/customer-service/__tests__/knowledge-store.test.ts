import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    knowledgeRule: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../memory-sync', () => ({
  syncKnowledgeToMemory: vi.fn().mockResolvedValue(0),
}))

vi.mock('../vector-store', () => {
  const mockVs = {
    init: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  }
  return {
    getVectorStore: vi.fn(() => mockVs),
    __mockVs: mockVs,
  }
})

vi.mock('../conflict-detector', () => ({
  detectConflicts: vi.fn().mockResolvedValue([]),
  checkDuplicate: vi.fn().mockResolvedValue({ status: 'ok' }),
}))

import { prisma } from '@/lib/db/prisma'
import { syncKnowledgeToMemory } from '../memory-sync'
import { getVectorStore } from '../vector-store'
import { createRule, updateRule, deprecateRule } from '../knowledge-store'

const mockPrisma = vi.mocked(prisma)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createRule', () => {
  it('should upsert to VectorStore after creating rule in Prisma', async () => {
    const mockRule = {
      id: 'rule-1',
      condition: '客户要退货',
      content: '支持7天无理由退货',
      tags: '["退货"]',
      category: 'general',
      source: 'manual',
      sourceRef: null,
      confidence: 0.8,
      status: 'active',
      conflictsWith: '[]',
      hitCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.knowledgeRule.findMany.mockResolvedValue([])
    mockPrisma.knowledgeRule.create.mockResolvedValue(mockRule as any)

    const result = await createRule({
      condition: '客户要退货',
      content: '支持7天无理由退货',
      tags: ['退货'],
      source: 'manual',
      confidence: 0.8,
    })

    expect(result.status).toBe('created')
    const vs = getVectorStore()
    expect(vs.upsert).toHaveBeenCalledWith(
      'rule-1',
      '客户要退货',
      '支持7天无理由退货',
      { type: 'rule', tags: '退货' }
    )
  })

  it('should call syncKnowledgeToMemory with tags after creating rule', async () => {
    const mockRule = {
      id: 'rule-2',
      condition: '物流查询',
      content: '预计3天到达',
      tags: '["物流","售后"]',
      category: 'general',
      source: 'document',
      sourceRef: null,
      confidence: 0.7,
      status: 'active',
      conflictsWith: '[]',
      hitCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.knowledgeRule.findMany.mockResolvedValue([])
    mockPrisma.knowledgeRule.create.mockResolvedValue(mockRule as any)

    const result = await createRule({
      condition: '物流查询',
      content: '预计3天到达',
      tags: ['物流', '售后'],
      source: 'document',
      confidence: 0.7,
    })

    expect(result.status).toBe('created')
    expect(syncKnowledgeToMemory).toHaveBeenCalledWith(['物流', '售后'])
  })
})

describe('updateRule', () => {
  it('should upsert to VectorStore after updating rule in Prisma', async () => {
    const mockRule = {
      id: 'rule-1',
      condition: '客户要退货（更新）',
      content: '支持7天无理由退货，运费由卖家承担',
      tags: '["退货"]',
      category: 'general',
      source: 'manual',
      sourceRef: null,
      confidence: 0.9,
      status: 'active',
      conflictsWith: '[]',
      hitCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.knowledgeRule.update.mockResolvedValue(mockRule as any)

    await updateRule('rule-1', {
      condition: '客户要退货（更新）',
      content: '支持7天无理由退货，运费由卖家承担',
      tags: ['退货'],
      confidence: 0.9,
    })

    const vs = getVectorStore()
    expect(vs.upsert).toHaveBeenCalledWith(
      'rule-1',
      '客户要退货（更新）',
      '支持7天无理由退货，运费由卖家承担',
      { type: 'rule', tags: '退货' }
    )
  })

  it('should call syncKnowledgeToMemory with tags when tags provided', async () => {
    const mockRule = {
      id: 'rule-1',
      condition: '条件',
      content: '内容',
      tags: '["退货","售后"]',
      category: 'general',
      source: 'manual',
      sourceRef: null,
      confidence: 0.9,
      status: 'active',
      conflictsWith: '[]',
      hitCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.knowledgeRule.update.mockResolvedValue(mockRule as any)

    await updateRule('rule-1', { tags: ['退货', '售后'] })

    expect(syncKnowledgeToMemory).toHaveBeenCalledWith(['退货', '售后'])
  })
})

describe('deprecateRule', () => {
  it('should remove from VectorStore after deprecating rule in Prisma', async () => {
    const mockRule = {
      id: 'rule-1',
      condition: '条件',
      content: '内容',
      tags: '[]',
      status: 'deprecated',
      category: 'general',
      source: 'manual',
      sourceRef: null,
      confidence: 0.8,
      conflictsWith: '[]',
      hitCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockPrisma.knowledgeRule.update.mockResolvedValue(mockRule as any)

    await deprecateRule('rule-1')

    const vs = getVectorStore()
    expect(vs.remove).toHaveBeenCalledWith('rule-1')
  })
})
