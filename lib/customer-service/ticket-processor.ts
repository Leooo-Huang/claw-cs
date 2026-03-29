import { prisma } from '@/lib/db/prisma'
import { extractLearningCandidate } from './learning-loop'
import { csEmitter } from './sse-events'
import { sendToOpenClaw } from '@/lib/openclaw/client'
import { getVectorStore } from './vector-store'
import type { TicketListQuery } from './types'

export async function listTickets(query: TicketListQuery) {
  const { status, channelType, search, page = 1, limit = 20 } = query

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (channelType) where.channelType = channelType
  if (search) {
    where.OR = [
      { customerName: { contains: search } },
      { customerMessage: { contains: search } },
    ]
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: { channel: { select: { name: true, type: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ])

  return {
    data: tickets.map(t => ({
      ...t,
      citedRuleIds: JSON.parse(t.citedRuleIds),
    })),
    meta: { total, page, limit },
  }
}

export async function getTicketDetail(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { channel: true },
  })
  if (!ticket) return null

  const ruleIds: string[] = JSON.parse(ticket.citedRuleIds)
  const citedRules = ruleIds.length > 0
    ? await prisma.knowledgeRule.findMany({ where: { id: { in: ruleIds } } })
    : []

  return {
    ...ticket,
    citedRuleIds: ruleIds,
    citedRules: citedRules.map(r => ({ ...r, tags: JSON.parse(r.tags) })),
  }
}

/**
 * Generate AI draft for a ticket via OpenClaw.
 * 1. Fetch matching knowledge rules as context
 * 2. Send to OpenClaw with knowledge context
 * 3. If OpenClaw unavailable, fall back to template reply
 * Callback route handles the result and updates the ticket.
 */
export async function generateAiDraft(ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) throw new Error('Ticket not found')

  await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'ai_drafting' } })

  csEmitter.emit({ type: 'ticket:ai_generating', ticketId })

  // Fetch relevant knowledge (both chunks and rules)
  const knowledgeContext = await fetchRelevantKnowledge(ticket.customerMessage, ticket.intent)

  // Save search metadata to ticket
  const searchMeta = JSON.stringify({
    searchTimeMs: knowledgeContext.searchTimeMs,
    chunks: knowledgeContext.chunks,
    rules: knowledgeContext.rules,
  })
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { aiSearchMeta: searchMeta },
  })

  // Try OpenClaw first
  const result = await sendToOpenClaw('customer-service', {
    customerMessage: ticket.customerMessage,
    customerName: ticket.customerName,
    orderInfo: ticket.orderId ? { orderNo: ticket.orderId } : undefined,
    intent: ticket.intent,
    sentiment: ticket.sentiment,
    knowledgeRules: knowledgeContext.rules,
    knowledgeChunks: knowledgeContext.chunks,
    ticketId,
  }, ticketId, 'generate-draft')

  if (result.queued) {
    // OpenClaw will POST back to /api/openclaw/callback when done
    // Safety timeout: if callback never arrives, fallback after 90s
    setTimeout(async () => {
      try {
        const check = await prisma.ticket.findUnique({ where: { id: ticketId } })
        if (check && (check.status === 'ai_drafting' || check.status === 'pending')) {
          console.warn(`[generateAiDraft] Ticket ${ticketId} still in ${check.status} after 90s, falling back to template`)
          const fallbackReply = generateTemplateReply(check.customerName, check.intent, check.orderId)
          await prisma.ticket.update({
            where: { id: ticketId },
            data: {
              aiReply: fallbackReply,
              aiReasoning: 'OpenClaw 回调超时，使用模板回复',
              aiConfidence: 0.5,
              status: 'awaiting_review',
            },
          })
          csEmitter.emit({ type: 'ticket:draft_ready', ticketId, draftData: {
            reply: fallbackReply, intent: check.intent || '通用', sentiment: check.sentiment || '中性',
            citedRuleIds: [], reasoning: 'OpenClaw 回调超时，使用模板回复', confidence: 0.5,
          }})
        }
      } catch (err) {
        console.error(`[generateAiDraft] Timeout fallback failed for ${ticketId}:`, err)
      }
    }, 90000)

    return { status: 'queued', ticketId }
  }

  // Fallback: OpenClaw not available, use template reply
  const reply = generateTemplateReply(ticket.customerName, ticket.intent, ticket.orderId)

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      aiReply: reply,
      aiReasoning: 'OpenClaw 不可用，使用模板回复',
      aiConfidence: 0.6,
      citedRuleIds: JSON.stringify(knowledgeContext.ruleIds),
      status: 'awaiting_review',
    },
  })

  csEmitter.emit({
    type: 'ticket:draft_ready',
    ticketId,
    draftData: {
      reply,
      intent: ticket.intent || '通用',
      sentiment: ticket.sentiment || '中性',
      citedRuleIds: knowledgeContext.ruleIds,
      reasoning: 'OpenClaw 不可用，使用模板回复',
      confidence: 0.6,
    },
  })

  return { status: 'fallback', ticketId }
}

/**
 * Unified knowledge retrieval: fetch both document chunks and rules
 * via vector store semantic search.
 */
async function fetchRelevantKnowledge(message: string, intent: string | null) {
  const vs = getVectorStore()
  const startTime = Date.now()
  try {
    await vs.init()
    const queryText = intent ? `${intent} ${message}` : message
    const results = await vs.query(queryText, 8)

    // Split by type
    const chunkResults = results.filter(r => r.metadata.type === 'chunk')
    const ruleResults = results.filter(r => r.metadata.type !== 'chunk')

    // Fetch chunk details
    const chunkIds = chunkResults.map(r => r.id.replace('chunk-', ''))
    const chunks = chunkIds.length > 0
      ? await prisma.knowledgeChunk.findMany({
          where: { id: { in: chunkIds } },
          include: { document: { select: { filename: true } } },
        })
      : []

    // Fetch rule details
    const ruleIds = ruleResults.map(r => r.id)
    const rules = ruleIds.length > 0
      ? await prisma.knowledgeRule.findMany({
          where: { id: { in: ruleIds }, status: 'active' },
        })
      : []

    const searchTimeMs = Date.now() - startTime

    return {
      chunks: chunks.map(c => {
        const matchResult = chunkResults.find(r => r.id === `chunk-${c.id}`)
        return {
          id: c.id,
          content: c.content,
          filename: c.document.filename,
          chunkIndex: c.chunkIndex,
          score: matchResult?.score || 0,
        }
      }),
      rules: rules.map(r => {
        const matchResult = ruleResults.find(res => res.id === r.id)
        return {
          id: r.id,
          condition: r.condition,
          content: r.content,
          confidence: r.confidence,
          score: matchResult?.score || 0,
        }
      }),
      ruleIds: rules.map(r => r.id),
      searchTimeMs,
    }
  } catch {
    return { chunks: [], rules: [], ruleIds: [], searchTimeMs: Date.now() - startTime }
  }
}

function generateTemplateReply(customerName: string, intent: string | null, orderId: string | null): string {
  const name = customerName
  switch (intent) {
    case '售后-物流':
      return `${name}您好，非常抱歉让您久等了。${orderId ? `查询到您的订单 ${orderId} ` : '您的订单'}已发出，物流信息显示正在配送中，预计1-2天内送达。如有疑问请随时联系我们。`
    case '售后-退货':
      return `${name}您好，非常理解您的心情。我们支持7天无理由退货，请您在订单详情页申请退货，我们会尽快为您处理。退货运费由我们承担。`
    case '售前-尺码':
      return `${name}您好！建议您参考商品详情页底部的尺码表，根据您的身高体重选择合适的尺码。如果在两个尺码之间犹豫，建议选大一号更舒适。`
    case '售前-材质':
      return `${name}您好！这款产品采用优质面料，具体材质信息请查看商品详情页的"材质成分"部分。如果您对面料有特殊要求，请告诉我，我帮您推荐更合适的款式。`
    case '售后-修改':
      return `${name}您好！${orderId ? `订单 ${orderId} ` : '您的订单'}如果还未发货，可以为您修改收货地址。请您提供新的收货地址，我马上为您处理。`
    case '售前-优惠':
      return `${name}您好！目前店铺有满减活动，多件购买更优惠哦。具体活动详情请查看店铺首页。如果您需要大批量购买，我可以为您申请更多优惠。`
    default:
      return `${name}您好，感谢您的咨询。我已收到您的消息，正在为您处理中。请稍等片刻，我会尽快给您答复。`
  }
}

export async function approveTicket(id: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket || !ticket.aiReply) throw new Error('No AI reply to approve')

  const ruleIds: string[] = JSON.parse(ticket.citedRuleIds)
  if (ruleIds.length > 0) {
    await prisma.knowledgeRule.updateMany({
      where: { id: { in: ruleIds } },
      data: { hitCount: { increment: 1 } },
    })
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      status: 'replied',
      finalReply: ticket.aiReply,
      repliedVia: 'ai_approved',
      repliedAt: new Date(),
    },
  })

  csEmitter.emit({ type: 'ticket:replied', ticketId: id })
  return updated
}

export async function editAndSendTicket(id: string, editedReply: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket) throw new Error('Ticket not found')

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      status: 'replied',
      finalReply: editedReply,
      repliedVia: 'manual',
      repliedAt: new Date(),
    },
  })

  csEmitter.emit({ type: 'ticket:replied', ticketId: id })

  let learningResult = null
  if (ticket.aiReply) {
    learningResult = await extractLearningCandidate(id, ticket.aiReply, editedReply)
  }

  return { ticket: updated, learning: learningResult }
}

export async function rejectTicket(id: string) {
  await prisma.ticket.update({
    where: { id },
    data: {
      status: 'pending',
      aiReply: null,
      aiReasoning: null,
      aiConfidence: null,
      citedRuleIds: '[]',
    },
  })
  return generateAiDraft(id)
}

export async function batchApprovePreview(ticketIds: string[], sampleSize = 5) {
  const sampled = ticketIds
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize)

  return prisma.ticket.findMany({
    where: { id: { in: sampled } },
    include: { channel: { select: { name: true, type: true } } },
  })
}

export async function batchApproveTickets(ticketIds: string[]) {
  let success = 0
  let failed = 0

  for (const id of ticketIds) {
    try {
      await approveTicket(id)
      success++
    } catch {
      failed++
    }
  }

  return { success, failed, total: ticketIds.length }
}
