import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { csEmitter } from '@/lib/customer-service/sse-events'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { instanceId, nodeId, skillName, result, meta, type, section, data, status, output, error } = body

  // ── Direct-mode callbacks (from sendToOpenClawDirect) ─────────────────────
  // These carry a 'meta' field instead of instanceId/nodeId
  if (meta) {
    if (skillName === 'customer-service' && meta.ticketId) {
      const parsed = typeof result === 'string' ? JSON.parse(result) : result

      await prisma.ticket.update({
        where: { id: meta.ticketId },
        data: {
          aiReply: parsed.reply || null,
          aiReasoning: parsed.reasoning || null,
          aiConfidence: parsed.confidence || 0.8,
          intent: parsed.intent || null,
          sentiment: parsed.sentiment || null,
          citedRuleIds: JSON.stringify(parsed.citedRuleIds || []),
          status: 'awaiting_review',
        },
      })

      csEmitter.emit({
        type: 'ticket:draft_ready',
        ticketId: meta.ticketId,
        draftData: {
          reply: parsed.reply || '',
          intent: parsed.intent || '',
          sentiment: parsed.sentiment || '',
          citedRuleIds: parsed.citedRuleIds || [],
          reasoning: parsed.reasoning || '',
          confidence: parsed.confidence || 0.8,
        },
      })
    }

    // knowledge-chat callback handling would go here
    // diff-classify callback handling would go here

    return NextResponse.json({ data: { success: true } })
  }

  // ── Workflow callbacks (require instanceId and nodeId) ────────────────────
  if (!instanceId || !nodeId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'instanceId and nodeId are required' } },
      { status: 400 }
    )
  }

  // ── Intermediate section callback (market-research progressive generation) ──
  if (type === 'report:section') {
    csEmitter.emit({
      type: 'report:section',
      section,
      data,
    })
    return NextResponse.json({ data: { success: true } })
  }

  // ── Customer-service AI draft callback ──────────────────────────────────────
  if (status === 'completed' && output?.result && (output?.ticketId || nodeId === 'generate-draft')) {
    const ticketId = output.ticketId || instanceId
    const parsed = typeof output.result === 'string' ? JSON.parse(output.result) : output.result

    try {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          aiReply: parsed.reply || null,
          aiReasoning: parsed.reasoning || null,
          aiConfidence: parsed.confidence || 0.8,
          intent: parsed.intent || null,
          sentiment: parsed.sentiment || null,
          citedRuleIds: JSON.stringify(parsed.citedRuleIds || []),
          status: 'awaiting_review',
        },
      })

      // Increment hit count for cited rules
      const citedIds: string[] = parsed.citedRuleIds || []
      if (citedIds.length > 0) {
        await prisma.knowledgeRule.updateMany({
          where: { id: { in: citedIds } },
          data: { hitCount: { increment: 1 } },
        })
      }

      csEmitter.emit({
        type: 'ticket:draft_ready',
        ticketId,
        draftData: {
          reply: parsed.reply || '',
          intent: parsed.intent || '',
          sentiment: parsed.sentiment || '',
          citedRuleIds: citedIds,
          reasoning: parsed.reasoning || '',
          confidence: parsed.confidence || 0.8,
        },
      })

      return NextResponse.json({ data: { success: true, ticketId } })
    } catch (err) {
      console.error('[callback] Failed to update ticket:', err)
    }
  }

  // ── Knowledge chat AI callback ────────────────────────────────────────────
  if (status === 'completed' && output?.result && nodeId === 'knowledge-chat') {
    // Result is forwarded back to the chat panel via SSE
    csEmitter.emit({
      type: 'knowledge:chat_reply',
      instanceId,
      result: output.result,
    })
    return NextResponse.json({ data: { success: true } })
  }

  // ── Diff classification callback ──────────────────────────────────────────
  if (status === 'completed' && output?.result && nodeId === 'diff-classify') {
    csEmitter.emit({
      type: 'learning:diff_classified',
      instanceId,
      result: output.result,
    })
    return NextResponse.json({ data: { success: true } })
  }

  // ── Final completed callback with full report ──────────────────────────────
  if (status === 'completed' && output?.fullReport) {
    // Find the placeholder draft created for this node and update its content
    const nodeState = await prisma.nodeState.findFirst({
      where: { instanceId, nodeId },
    })

    if (nodeState) {
      const draft = await prisma.draft.findFirst({
        where: { nodeStateId: nodeState.id },
      })

      if (draft) {
        const report = output.fullReport as Record<string, unknown>
        await prisma.draft.update({
          where: { id: draft.id },
          data: {
            content: JSON.stringify(report),
            thumbnail: `${report.keyword || ''} | ${report.marketSize || 'N/A'} | ${report.growth || 'N/A'} | ${report.competitionLevel || '未知'}竞争`,
          },
        })

        csEmitter.emit({
          type: 'draft:updated',
          draftId: draft.id,
        })
      }
    }

    return NextResponse.json({ data: { success: true } })
  }

  // ── Standard node state update (non-market-research or error callbacks) ────
  await prisma.nodeState.updateMany({
    where: { instanceId, nodeId },
    data: {
      status: status || 'completed',
      output: output ? JSON.stringify(output) : null,
      error: error || null,
      completedAt: new Date(),
    }
  })

  csEmitter.emit({
    type: 'node:status',
    nodeId,
    status: status || 'completed',
    timestamp: new Date().toISOString()
  })

  if (status === 'completed' || !status) {
    // No workflow to resume in standalone mode
  }

  return NextResponse.json({ data: { success: true } })
}
