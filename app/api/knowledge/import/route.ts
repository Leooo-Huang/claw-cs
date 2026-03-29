import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromFile, inferTags } from '@/lib/customer-service/file-parser'
import { callOpenClawSync } from '@/lib/openclaw/client'
import { storeDocument } from '@/lib/customer-service/document-store'
import { prisma } from '@/lib/db/prisma'

/**
 * File import flow:
 * - storeAsDocument=true -> store in document library (chunks + vectors)
 * - extractRules=true -> extract rules via AI (or local fallback), write as pending
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const storeAsDocument = formData.get('storeAsDocument') !== 'false'
  const extractRules = formData.get('extractRules') !== 'false'

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = file.name.split('.').pop()?.toLowerCase() || 'txt'

  const results: {
    document?: { id: string; filename: string; chunkCount: number }
    candidateRules?: number
    extractSource?: string
  } = {}

  // 1. Store as document
  if (storeAsDocument) {
    try {
      const doc = await storeDocument(file.name, ext, buffer, 'other')
      results.document = doc
    } catch (err) {
      // If document storage fails but rule extraction requested, continue
      if (!extractRules) {
        return NextResponse.json({
          error: err instanceof Error ? err.message : '文档存储失败',
        }, { status: 400 })
      }
    }
  }

  // 2. Extract rules
  if (extractRules) {
    const { text, structured } = await extractTextFromFile(buffer, file.name)

    if (!text && structured.length === 0) {
      if (!results.document) {
        return NextResponse.json({ error: '文件内容为空或格式无法识别' }, { status: 400 })
      }
      // Document stored but no rules extractable
      return NextResponse.json({ data: results })
    }

    // Build AI input
    let aiInput = ''
    if (structured.length > 0) {
      aiInput = structured.map((row, i) =>
        `第${i + 1}条:\n  问题/条件: ${row.condition}\n  回答/内容: ${row.content}`
      ).join('\n\n')
    } else {
      aiInput = text.slice(0, 8000)
    }

    // Try AI extraction
    const aiResult = await callOpenClawSync('knowledge-extract-batch', {
      fileContent: aiInput,
      fileName: file.name,
    })

    let candidates: Array<{ condition: string; content: string; tags: string[]; confidence: number; source: string }>
    let extractSource: string

    if (aiResult && Array.isArray(aiResult) && aiResult.length > 0) {
      candidates = (aiResult as Array<{ condition: string; content: string; tags?: string[] }>).map(item => ({
        condition: item.condition || '',
        content: item.content || '',
        tags: item.tags || inferTags(item.condition || '', item.content || ''),
        confidence: 0.85,
        source: 'document',
      }))
      extractSource = 'ai'
    } else {
      candidates = localExtract(text, structured)
      extractSource = 'local'
    }

    // Write candidates as pending rules directly to DB
    let createdCount = 0
    for (const c of candidates) {
      if (!c.condition || !c.content) continue
      await prisma.knowledgeRule.create({
        data: {
          condition: c.condition,
          content: c.content,
          tags: JSON.stringify(c.tags),
          category: 'general',
          source: 'document',
          sourceRef: file.name,
          confidence: c.confidence,
          status: 'pending',
          conflictsWith: '[]',
        },
      })
      createdCount++
    }

    results.candidateRules = createdCount
    results.extractSource = extractSource
  }

  return NextResponse.json({ data: results })
}

/**
 * Local extraction fallback
 */
function localExtract(
  text: string,
  structured: Array<{ condition: string; content: string }>
) {
  if (structured.length > 0) {
    return structured.map(row => ({
      condition: row.condition,
      content: row.content,
      tags: inferTags(row.condition, row.content),
      source: 'document' as const,
      confidence: 0.7,
    }))
  }

  const lines = text.split('\n').filter(l => l.trim().length > 10)
  return lines.slice(0, 50).map(line => {
    if (line.includes('|')) {
      const [cond, cont] = line.split('|').map(s => s.trim())
      return {
        condition: cond || cont.slice(0, 40),
        content: cont || cond,
        tags: inferTags(cond, cont),
        source: 'document' as const,
        confidence: 0.7,
      }
    }
    return {
      condition: line.slice(0, 50) + (line.length > 50 ? '...' : ''),
      content: line,
      tags: inferTags(line, ''),
      source: 'document' as const,
      confidence: 0.5,
    }
  })
}
