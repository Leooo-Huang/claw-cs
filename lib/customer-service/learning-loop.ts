import { prisma } from '@/lib/db/prisma'
import { createRule } from './knowledge-store'
import { csEmitter } from './sse-events'
import { callOpenClawSync } from '@/lib/openclaw/client'

/**
 * Analyze edit diff: classify semantic vs cosmetic changes.
 * Quick local check first (identical = cosmetic).
 * Returns conservative 'semantic' immediately for responsiveness.
 * Async AI classification runs in background and updates the candidate.
 */
export function analyzeEditDiffQuick(original: string, edited: string): {
  isSemanticChange: boolean
  diffType: 'semantic' | 'cosmetic'
} {
  if (original.trim() === edited.trim()) {
    return { isSemanticChange: false, diffType: 'cosmetic' }
  }
  // Conservative: assume semantic for immediate response
  return { isSemanticChange: true, diffType: 'semantic' }
}

/**
 * Async AI diff classification. Runs in background after candidate is created.
 * Updates the candidate's diffType based on AI judgment.
 * If AI says 'cosmetic', auto-ignores the candidate.
 */
export async function classifyDiffAsync(candidateId: string, original: string, edited: string) {
  try {
    const aiResult = await callOpenClawSync('diff-classify', {
      original,
      edited,
    }, 60000) // 60s timeout for diff classification

    if (aiResult && typeof aiResult === 'object' && !Array.isArray(aiResult)) {
      const result = aiResult as { diffType?: string; reason?: string }

      if (result.diffType === 'cosmetic') {
        // AI says cosmetic → auto-ignore this candidate
        await prisma.learningCandidate.update({
          where: { id: candidateId },
          data: { diffType: 'cosmetic', status: 'ignored' },
        })
        csEmitter.emit({
          type: 'learning:diff_classified',
          instanceId: candidateId,
          result: { diffType: 'cosmetic', reason: result.reason || 'AI 判定为措辞修改', autoIgnored: true },
        })
        return
      }

      if (result.diffType === 'semantic') {
        // AI confirms semantic → keep candidate, update reason
        await prisma.learningCandidate.update({
          where: { id: candidateId },
          data: { diffType: 'semantic' },
        })
        csEmitter.emit({
          type: 'learning:diff_classified',
          instanceId: candidateId,
          result: { diffType: 'semantic', reason: result.reason || 'AI 判定为语义修改' },
        })
        return
      }
    }

    // AI returned unexpected format → keep as semantic (conservative)
    console.warn('[classifyDiffAsync] Unexpected AI result:', aiResult)
  } catch (err) {
    console.error('[classifyDiffAsync] Failed:', err)
    // Keep candidate as-is (semantic, conservative)
  }
}

/**
 * Extract a learning candidate from a human edit on an AI draft.
 */
export async function extractLearningCandidate(
  ticketId: string,
  originalReply: string,
  editedReply: string,
): Promise<{ candidateId: string | null; isSemanticChange: boolean }> {
  const { isSemanticChange, diffType } = analyzeEditDiffQuick(originalReply, editedReply)

  if (!isSemanticChange) {
    return { candidateId: null, isSemanticChange: false }
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return { candidateId: null, isSemanticChange: true }

  // Dynamic confidence: boost by 0.05 when same intent has >= 3 approved candidates
  let confidence = 0.7
  if (ticket.intent) {
    const approvedCount = await prisma.learningCandidate.count({
      where: {
        status: 'approved',
        ticket: { intent: ticket.intent },
      },
    })
    if (approvedCount >= 3) {
      confidence = Math.min(0.95, confidence + 0.05 * Math.floor(approvedCount / 3))
    }
  }

  const candidate = await prisma.learningCandidate.create({
    data: {
      ticketId,
      originalReply,
      editedReply,
      diffType,
      extractedCondition: ticket.intent || '客户咨询',
      extractedContent: editedReply,
      extractedTags: JSON.stringify(ticket.intent ? [ticket.intent] : []),
      confidence,
    },
  })

  csEmitter.emit({
    type: 'learning:new_candidate',
    candidateId: candidate.id,
    ticketId,
  })

  // Fire-and-forget: async AI classification in background
  // If AI says 'cosmetic', candidate will be auto-ignored
  classifyDiffAsync(candidate.id, originalReply, editedReply).catch(err => {
    console.error('[extractLearningCandidate] Background diff classify failed:', err)
  })

  return { candidateId: candidate.id, isSemanticChange: true }
}

/**
 * Review a learning candidate: approve (create rule) or ignore.
 */
export async function reviewCandidate(
  id: string,
  action: 'approve' | 'reject' | 'ignore',
  editedData?: { condition?: string; content?: string; tags?: string[] }
) {
  const candidate = await prisma.learningCandidate.update({
    where: { id },
    data: {
      status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'ignored',
      reviewedAt: new Date(),
    },
  })

  if (action === 'approve') {
    const tags: string[] = editedData?.tags || JSON.parse(candidate.extractedTags)
    await createRule({
      condition: editedData?.condition || candidate.extractedCondition,
      content: editedData?.content || candidate.extractedContent,
      tags,
      source: 'learning',
      sourceRef: candidate.ticketId,
      confidence: candidate.confidence,
    })
  }

  return candidate
}

/**
 * Batch review candidates.
 */
export async function batchReviewCandidates(
  ids: string[],
  action: 'approve' | 'ignore'
) {
  const results = []
  for (const id of ids) {
    const result = await reviewCandidate(id, action)
    results.push(result)
  }
  return results
}

/**
 * List learning candidates with pagination.
 */
export async function listCandidates(status?: string, page = 1, limit = 20) {
  const where = status ? { status } : {}
  const [candidates, total] = await Promise.all([
    prisma.learningCandidate.findMany({
      where,
      include: { ticket: { select: { customerName: true, customerMessage: true, intent: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.learningCandidate.count({ where }),
  ])

  return {
    data: candidates.map(c => ({ ...c, extractedTags: JSON.parse(c.extractedTags) })),
    meta: { total, page, limit },
  }
}
