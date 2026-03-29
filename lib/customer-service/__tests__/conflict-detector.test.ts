import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVs = {
  init: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
}

vi.mock('../vector-store', () => ({
  getVectorStore: vi.fn(() => mockVs),
}))

import { detectConflicts, checkDuplicate } from '../conflict-detector'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('detectConflicts', () => {
  const existingRules = [
    { id: 'r1', condition: '退货政策', content: '支持7天无理由退货，运费由卖家承担', tags: '["退货"]' },
    { id: 'r2', condition: '退款时效', content: '退款3个工作日内到账', tags: '["退款"]' },
    { id: 'r3', condition: '物流查询', content: '包裹预计3-5天到达', tags: '["物流"]' },
  ]

  it('should detect conflict when new rule contradicts existing rule', async () => {
    // Mock vector store returns high similarity match
    mockVs.query.mockResolvedValue([
      { id: 'r1', score: 0.85, metadata: { tags: '退货' }, document: '退货政策 支持7天无理由退货，运费由卖家承担' },
    ])

    const newRule = {
      condition: '退货政策',
      content: '不支持退货，所有商品一经售出概不退换',
      tags: ['退货'],
      source: 'manual' as const,
      confidence: 0.8,
    }

    const conflicts = await detectConflicts(newRule, existingRules)

    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts[0].ruleId).toBe('r1')
    expect(conflicts[0].similarity).toBeGreaterThanOrEqual(0.7)
  })

  it('should not detect conflict when rules are similar but not contradictory', async () => {
    mockVs.query.mockResolvedValue([
      { id: 'r1', score: 0.8, metadata: { tags: '退货' }, document: '退货政策 支持7天无理由退货，运费由卖家承担' },
    ])

    const newRule = {
      condition: '退货政策补充',
      content: '支持7天无理由退货，需要保持包装完好',
      tags: ['退货'],
      source: 'manual' as const,
      confidence: 0.8,
    }

    const conflicts = await detectConflicts(newRule, existingRules)
    expect(conflicts.length).toBe(0)
  })

  it('should not detect conflict when similarity is below threshold', async () => {
    mockVs.query.mockResolvedValue([
      { id: 'r3', score: 0.5, metadata: { tags: '物流' }, document: '物流查询 包裹预计3-5天到达' },
    ])

    const newRule = {
      condition: '退货政策',
      content: '不支持退货',
      tags: ['退货'],
      source: 'manual' as const,
      confidence: 0.8,
    }

    const conflicts = await detectConflicts(newRule, existingRules)
    expect(conflicts.length).toBe(0)
  })

  it('should detect contradiction signal words: 由买家 vs 由卖家', async () => {
    mockVs.query.mockResolvedValue([
      { id: 'r1', score: 0.75, metadata: { tags: '退货' }, document: '退货政策 支持7天无理由退货，运费由卖家承担' },
    ])

    const newRule = {
      condition: '退货运费',
      content: '退货运费由买家承担',
      tags: ['退货'],
      source: 'manual' as const,
      confidence: 0.8,
    }

    const conflicts = await detectConflicts(newRule, existingRules)
    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts[0].reason).toBeTruthy()
  })

  it('should return empty array when vector store query fails', async () => {
    mockVs.query.mockRejectedValue(new Error('VectorStore error'))

    const newRule = {
      condition: '任何条件',
      content: '任何内容',
      tags: [],
      source: 'manual' as const,
      confidence: 0.8,
    }

    const conflicts = await detectConflicts(newRule, existingRules)
    expect(conflicts).toEqual([])
  })

  it('should return empty array when no existing rules', async () => {
    mockVs.query.mockResolvedValue([])

    const newRule = {
      condition: '新规则',
      content: '新内容',
      tags: [],
      source: 'manual' as const,
      confidence: 0.8,
    }

    const conflicts = await detectConflicts(newRule, [])
    expect(conflicts).toEqual([])
  })
})

describe('checkDuplicate', () => {
  it('should return duplicate when similarity > 0.9', async () => {
    mockVs.query.mockResolvedValue([
      { id: 'r1', score: 0.95, metadata: {}, document: '退货政策 支持7天无理由退货' },
    ])

    const result = await checkDuplicate('退货政策', '支持7天无理由退货')
    expect(result.status).toBe('duplicate')
    expect(result.existingRuleId).toBe('r1')
    expect(result.similarity).toBe(0.95)
  })

  it('should return conflict when similarity 0.7-0.9 with contradiction', async () => {
    mockVs.query.mockResolvedValue([
      { id: 'r1', score: 0.8, metadata: {}, document: '退货政策 支持退货，运费由卖家承担' },
    ])

    const result = await checkDuplicate('退货运费', '退货运费由买家承担')
    expect(result.status).toBe('conflict')
    expect(result.existingRuleId).toBe('r1')
    expect(result.reason).toBeTruthy()
  })

  it('should return ok when similarity is low', async () => {
    mockVs.query.mockResolvedValue([
      { id: 'r1', score: 0.3, metadata: {}, document: '物流查询 包裹预计3天到达' },
    ])

    const result = await checkDuplicate('退货政策', '支持退货')
    expect(result.status).toBe('ok')
  })

  it('should return ok when no results', async () => {
    mockVs.query.mockResolvedValue([])

    const result = await checkDuplicate('全新规则', '全新内容')
    expect(result.status).toBe('ok')
  })

  it('should return ok when similarity 0.7-0.9 but no contradiction', async () => {
    mockVs.query.mockResolvedValue([
      { id: 'r1', score: 0.8, metadata: {}, document: '退货政策 支持退货，需保持包装完好' },
    ])

    const result = await checkDuplicate('退货政策补充', '支持退货，需要提供发票')
    expect(result.status).toBe('ok')
  })
})
