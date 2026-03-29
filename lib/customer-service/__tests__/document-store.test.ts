import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    knowledgeDocument: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    knowledgeChunk: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('../file-parser', () => ({
  extractTextFromFile: vi.fn(),
}))

const mockVs = {
  init: vi.fn().mockResolvedValue(undefined),
  upsert: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}

vi.mock('../vector-store', () => ({
  getVectorStore: vi.fn(() => mockVs),
}))

import { prisma } from '@/lib/db/prisma'
import { extractTextFromFile } from '../file-parser'
import {
  storeDocument,
  listDocuments,
  getDocumentChunks,
  deleteDocument,
  chunkText,
} from '../document-store'

const mockPrisma = vi.mocked(prisma)
const mockExtract = vi.mocked(extractTextFromFile)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('chunkText', () => {
  it('should split text by double newlines', () => {
    const p1 = 'First paragraph that is definitely long enough to pass the fifty char minimum.'
    const p2 = 'Second paragraph that is also long enough to exceed fifty characters easily.'
    const p3 = 'Third paragraph is equally long and exceeds the fifty character threshold too.'
    const text = `${p1}\n\n${p2}\n\n${p3}`
    const chunks = chunkText(text)
    expect(chunks).toEqual([p1, p2, p3])
  })

  it('should merge short paragraphs (< 50 chars) with previous', () => {
    const text = 'This is a long enough paragraph that exceeds fifty characters easily.\n\nShort.\n\nAnother long paragraph that also exceeds fifty characters in length.'
    const chunks = chunkText(text)
    // "Short." should be merged with first paragraph
    expect(chunks.length).toBe(2)
    expect(chunks[0]).toContain('Short.')
  })

  it('should truncate chunks longer than 500 chars at sentence boundary', () => {
    // Build a paragraph > 500 chars with sentences
    const sentences = []
    for (let i = 0; i < 20; i++) {
      sentences.push(`This is sentence number ${i} with enough text.`)
    }
    const longText = sentences.join('')
    const chunks = chunkText(longText)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(550) // some tolerance for boundary
    }
  })

  it('should return empty array for empty text', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   ')).toEqual([])
  })

  it('should handle text with only short paragraphs by merging all', () => {
    const text = 'Hi.\n\nOk.\n\nYes.'
    const chunks = chunkText(text)
    // All short, merged into one
    expect(chunks.length).toBe(1)
    expect(chunks[0]).toContain('Hi.')
    expect(chunks[0]).toContain('Ok.')
    expect(chunks[0]).toContain('Yes.')
  })
})

describe('storeDocument', () => {
  it('should extract text, chunk, create document and chunks in DB, and vectorize', async () => {
    const buffer = Buffer.from('Test content')
    mockExtract.mockResolvedValue({
      text: 'First paragraph is long enough to exceed fifty characters for testing.\n\nSecond paragraph is also long enough to exceed fifty chars easily.',
      structured: [],
    })

    const mockDoc = {
      id: 'doc-1',
      filename: 'test.txt',
      fileType: 'txt',
      fileSize: 12,
      chunkCount: 2,
      sourceType: 'other',
      status: 'active',
      uploadedAt: new Date(),
    }
    mockPrisma.knowledgeDocument.create.mockResolvedValue(mockDoc as any)
    mockPrisma.knowledgeChunk.createMany.mockResolvedValue({ count: 2 })
    mockPrisma.knowledgeChunk.findMany.mockResolvedValue([
      { id: 'chunk-a', documentId: 'doc-1', content: 'First paragraph...', chunkIndex: 0, createdAt: new Date() },
      { id: 'chunk-b', documentId: 'doc-1', content: 'Second paragraph...', chunkIndex: 1, createdAt: new Date() },
    ] as any)

    const result = await storeDocument('test.txt', 'txt', buffer, 'other')

    expect(mockExtract).toHaveBeenCalledWith(buffer, 'test.txt')
    expect(mockPrisma.knowledgeDocument.create).toHaveBeenCalled()
    expect(mockPrisma.knowledgeChunk.createMany).toHaveBeenCalled()
    // Vectorize each chunk
    expect(mockVs.upsert).toHaveBeenCalledTimes(2)
    expect(mockVs.upsert).toHaveBeenCalledWith(
      'chunk-chunk-a',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ type: 'chunk', documentId: 'doc-1', filename: 'test.txt' })
    )
    expect(result.id).toBe('doc-1')
    expect(result.chunkCount).toBe(2)
  })

  it('should throw when file content is empty', async () => {
    mockExtract.mockResolvedValue({ text: '', structured: [] })
    await expect(storeDocument('empty.txt', 'txt', Buffer.from(''), 'other')).rejects.toThrow()
  })
})

describe('listDocuments', () => {
  it('should return documents with chunk counts', async () => {
    mockPrisma.knowledgeDocument.findMany.mockResolvedValue([
      { id: 'doc-1', filename: 'a.pdf', fileType: 'pdf', fileSize: 1000, chunkCount: 5, sourceType: 'other', status: 'active', uploadedAt: new Date() },
    ] as any)

    const docs = await listDocuments()
    expect(docs).toHaveLength(1)
    expect(docs[0].chunkCount).toBe(5)
  })
})

describe('getDocumentChunks', () => {
  it('should return all chunks for a document', async () => {
    mockPrisma.knowledgeChunk.findMany.mockResolvedValue([
      { id: 'c1', documentId: 'doc-1', content: 'chunk 1', chunkIndex: 0, createdAt: new Date() },
      { id: 'c2', documentId: 'doc-1', content: 'chunk 2', chunkIndex: 1, createdAt: new Date() },
    ] as any)

    const chunks = await getDocumentChunks('doc-1')
    expect(chunks).toHaveLength(2)
    expect(mockPrisma.knowledgeChunk.findMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
      orderBy: { chunkIndex: 'asc' },
    })
  })
})

describe('deleteDocument', () => {
  it('should delete document, chunks, and remove vectors', async () => {
    mockPrisma.knowledgeChunk.findMany.mockResolvedValue([
      { id: 'c1', documentId: 'doc-1', content: 'chunk 1', chunkIndex: 0, createdAt: new Date() },
      { id: 'c2', documentId: 'doc-1', content: 'chunk 2', chunkIndex: 1, createdAt: new Date() },
    ] as any)
    mockPrisma.knowledgeChunk.deleteMany.mockResolvedValue({ count: 2 })
    mockPrisma.knowledgeDocument.update.mockResolvedValue({} as any)

    await deleteDocument('doc-1')

    expect(mockVs.remove).toHaveBeenCalledWith('chunk-c1')
    expect(mockVs.remove).toHaveBeenCalledWith('chunk-c2')
    expect(mockPrisma.knowledgeChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    })
    expect(mockPrisma.knowledgeDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'deleted' },
    })
  })
})
