import { NextRequest, NextResponse } from 'next/server'
import { parseConversations, sampleConversations } from '@/lib/customer-service/conversation-parser'
import { callOpenClawSync } from '@/lib/openclaw/client'
import { inferTags } from '@/lib/customer-service/file-parser'

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || ''

  let conversations: Array<{ customer: string; agent: string }>
  let originalCount = 0

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const allParsed = await parseConversations(buffer, file.name)
    // parseConversations already does dedup + short-filter internally
    // We need a raw count for stats; re-parse without filter to get original
    const rawText = buffer.toString('utf-8').trim()
    // Estimate original count from raw data
    originalCount = estimateOriginalPairCount(rawText, file.name)
    conversations = allParsed
  } else {
    const body = await req.json()
    conversations = body.conversations
    originalCount = conversations?.length ?? 0
  }

  if (!Array.isArray(conversations) || conversations.length === 0) {
    return NextResponse.json({ error: '未解析到有效对话（短回复已过滤）' }, { status: 400 })
  }

  // Sample conversations before sending to AI
  const afterDedupAndFilter = conversations.length
  const { sampled, stats } = sampleConversations(conversations, 30)

  // Override stats with real counts from parsing pipeline
  stats.original = originalCount || afterDedupAndFilter
  stats.afterDedup = afterDedupAndFilter // parseConversations already deduped
  stats.afterFilter = afterDedupAndFilter // parseConversations already filtered

  // 构建对话文本发给 AI 提取规则
  const convText = sampled.map((c, i) =>
    `对话${i + 1}:\n  客户: ${c.customer}\n  客服: ${c.agent}`
  ).join('\n\n')

  const aiResult = await callOpenClawSync('knowledge-extract-batch', {
    fileContent: convText,
    fileName: '历史对话记录',
  })

  if (aiResult && Array.isArray(aiResult) && aiResult.length > 0) {
    const candidates = (aiResult as Array<{ condition: string; content: string; tags?: string[] }>).map(item => ({
      condition: item.condition || '',
      content: item.content || '',
      tags: item.tags || inferTags(item.condition || '', item.content || ''),
      source: 'conversation' as const,
      confidence: 0.85,
    }))
    return NextResponse.json({
      data: candidates,
      meta: {
        total: candidates.length,
        source: 'ai',
        parsedConversations: sampled.length,
        stats,
      },
    })
  }

  // OpenClaw 不可用：直接用对话对作为规则候选
  const candidates = sampled.map(conv => ({
    condition: conv.customer.length > 50 ? conv.customer.slice(0, 50) + '...' : conv.customer,
    content: conv.agent,
    tags: inferTags(conv.customer, conv.agent),
    source: 'conversation' as const,
    confidence: 0.7,
  }))

  return NextResponse.json({
    data: candidates,
    meta: {
      total: candidates.length,
      source: 'local',
      parsedConversations: sampled.length,
      stats,
    },
  })
}

/**
 * Estimate the original number of customer-agent pairs before dedup/filter.
 * This counts raw customer→agent transitions in the data.
 */
function estimateOriginalPairCount(text: string, filename: string): number {
  try {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    if (ext === 'json' || text.startsWith('[')) {
      const data = JSON.parse(text)
      if (!Array.isArray(data)) return 0
      let count = 0
      for (let i = 0; i < data.length; i++) {
        if (data[i]?.role === 'customer' && i + 1 < data.length && data[i + 1]?.role === 'agent') {
          count++
        }
      }
      return count
    }
    // CSV: count customer rows followed by agent rows
    const lines = text.split('\n').filter(l => l.trim())
    let count = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const commaIdx = line.indexOf(',')
      if (commaIdx < 0) continue
      const role = line.slice(0, commaIdx).trim()
      if (role === 'customer' && i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        const nextComma = nextLine.indexOf(',')
        if (nextComma >= 0 && nextLine.slice(0, nextComma).trim() === 'agent') {
          count++
        }
      }
    }
    return count
  } catch {
    return 0
  }
}
