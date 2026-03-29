import { describe, it, expect, vi, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync, existsSync } from 'fs'

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    knowledgeRule: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../sse-events', () => ({
  csEmitter: { emit: vi.fn() },
}))

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}))

import { prisma } from '@/lib/db/prisma'
import { syncKnowledgeToMemory } from '../memory-sync'

const mockPrisma = vi.mocked(prisma)
const mockWriteFileSync = vi.mocked(writeFileSync)
const mockExistsSync = vi.mocked(existsSync)

beforeEach(() => {
  vi.clearAllMocks()
  mockExistsSync.mockReturnValue(true)
})

describe('syncKnowledgeToMemory', () => {
  const mockRules = [
    { id: 'r1', condition: '退货', content: '7天无理由', tags: '["退货"]', confidence: 0.8, hitCount: 5 },
    { id: 'r2', condition: '物流', content: '预计3天', tags: '["物流"]', confidence: 0.9, hitCount: 3 },
    { id: 'r3', condition: '尺码', content: '参考尺码表', tags: '["退货"]', confidence: 0.7, hitCount: 1 },
  ]

  it('should write all tag files when no changedTags specified', async () => {
    mockPrisma.knowledgeRule.findMany.mockResolvedValue(mockRules as any)

    await syncKnowledgeToMemory()

    // Should write index + 2 tag files (退货 and 物流)
    const writeCalls = mockWriteFileSync.mock.calls
    const paths = writeCalls.map(c => c[0] as string)
    expect(paths.some(p => p.includes('cs-rules-退货.md'))).toBe(true)
    expect(paths.some(p => p.includes('cs-rules-物流.md'))).toBe(true)
    expect(paths.some(p => p.includes('cs-rules-index.md'))).toBe(true)
  })

  it('should only write changed tag files when changedTags specified', async () => {
    mockPrisma.knowledgeRule.findMany.mockResolvedValue(mockRules as any)

    await syncKnowledgeToMemory(['物流'])

    const writeCalls = mockWriteFileSync.mock.calls
    const paths = writeCalls.map(c => c[0] as string)
    // Should write 物流 tag file and index, but NOT 退货
    expect(paths.some(p => p.includes('cs-rules-物流.md'))).toBe(true)
    expect(paths.some(p => p.includes('cs-rules-index.md'))).toBe(true)
    expect(paths.some(p => p.includes('cs-rules-退货.md'))).toBe(false)
  })

  it('should always write index file even with changedTags', async () => {
    mockPrisma.knowledgeRule.findMany.mockResolvedValue(mockRules as any)

    await syncKnowledgeToMemory(['nonexistent-tag'])

    const writeCalls = mockWriteFileSync.mock.calls
    const paths = writeCalls.map(c => c[0] as string)
    expect(paths.some(p => p.includes('cs-rules-index.md'))).toBe(true)
  })

  it('should return rule count', async () => {
    mockPrisma.knowledgeRule.findMany.mockResolvedValue(mockRules as any)
    const count = await syncKnowledgeToMemory()
    expect(count).toBe(3)
  })
})
