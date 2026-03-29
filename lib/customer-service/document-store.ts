import { prisma } from '@/lib/db/prisma'
import { extractTextFromFile } from './file-parser'
import { getVectorStore } from './vector-store'

/**
 * Split raw text into chunks using paragraph-based strategy:
 * 1. Split by \n\n
 * 2. Merge short paragraphs (< 50 chars) with previous
 * 3. Truncate chunks > 500 chars at sentence/comma boundary
 */
export function chunkText(text: string): string[] {
  if (!text.trim()) return []

  // Split by double newlines
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
  if (paragraphs.length === 0) return []

  // Merge short paragraphs with previous
  const merged: string[] = []
  for (const para of paragraphs) {
    if (merged.length > 0 && para.length < 50) {
      merged[merged.length - 1] += '\n\n' + para
    } else if (para.length < 50 && merged.length === 0) {
      // First paragraph is short — start it anyway, merge subsequent into it
      merged.push(para)
    } else {
      merged.push(para)
    }
  }

  // Truncate long chunks at sentence boundaries
  const result: string[] = []
  for (const chunk of merged) {
    if (chunk.length <= 500) {
      result.push(chunk)
    } else {
      // Split at sentence boundaries (period, comma in Chinese/English)
      let remaining = chunk
      while (remaining.length > 500) {
        // Find the last sentence boundary before 500
        let cutAt = -1
        const breakChars = ['\u3002', '.', '\uff0c', ',', '\uff1b', ';']
        for (const ch of breakChars) {
          const idx = remaining.lastIndexOf(ch, 500)
          if (idx > cutAt) cutAt = idx
        }
        if (cutAt <= 0) {
          // No good break point, force cut at 500
          cutAt = 500
        } else {
          cutAt += 1 // include the delimiter
        }
        result.push(remaining.slice(0, cutAt).trim())
        remaining = remaining.slice(cutAt).trim()
      }
      if (remaining.length > 0) {
        result.push(remaining)
      }
    }
  }

  return result.filter(c => c.length > 0)
}

/**
 * Store a file as a document with chunked content.
 * Extracts text -> chunks -> writes to Prisma -> vectorizes each chunk.
 */
export async function storeDocument(
  filename: string,
  fileType: string,
  buffer: Buffer,
  sourceType: string
) {
  const { text } = await extractTextFromFile(buffer, filename)

  if (!text || !text.trim()) {
    throw new Error('文件内容为空或无法提取文本')
  }

  const chunks = chunkText(text)
  if (chunks.length === 0) {
    throw new Error('文件内容分块后为空')
  }

  // Create document record
  const doc = await prisma.knowledgeDocument.create({
    data: {
      filename,
      fileType,
      fileSize: buffer.length,
      chunkCount: chunks.length,
      sourceType,
    },
  })

  // Create chunk records
  await prisma.knowledgeChunk.createMany({
    data: chunks.map((content, index) => ({
      documentId: doc.id,
      content,
      chunkIndex: index,
    })),
  })

  // Fetch created chunks (to get their IDs for vectorization)
  const createdChunks = await prisma.knowledgeChunk.findMany({
    where: { documentId: doc.id },
    orderBy: { chunkIndex: 'asc' },
  })

  // Vectorize each chunk
  const vs = getVectorStore()
  await vs.init()
  for (const chunk of createdChunks) {
    await vs.upsert(
      `chunk-${chunk.id}`,
      chunk.content,
      '',
      { type: 'chunk', documentId: doc.id, filename }
    )
  }

  return { id: doc.id, filename, chunkCount: chunks.length }
}

/**
 * List all active documents.
 */
export async function listDocuments() {
  const docs = await prisma.knowledgeDocument.findMany({
    where: { status: 'active' },
    orderBy: { uploadedAt: 'desc' },
  })
  return docs
}

/**
 * Get all chunks for a document.
 */
export async function getDocumentChunks(documentId: string) {
  return prisma.knowledgeChunk.findMany({
    where: { documentId },
    orderBy: { chunkIndex: 'asc' },
  })
}

/**
 * Delete a document and its chunks, remove vectors.
 */
export async function deleteDocument(documentId: string) {
  // Get chunk IDs for vector removal
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { documentId },
  })

  // Remove vectors
  const vs = getVectorStore()
  await vs.init()
  for (const chunk of chunks) {
    await vs.remove(`chunk-${chunk.id}`)
  }

  // Delete chunks
  await prisma.knowledgeChunk.deleteMany({
    where: { documentId },
  })

  // Soft-delete document
  await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { status: 'deleted' },
  })
}
