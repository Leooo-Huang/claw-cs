import { getVectorStore } from './vector-store'
import type { KnowledgeRuleData } from './types'

export interface ConflictResult {
  ruleId: string
  reason: string
  similarity: number
}

export interface DuplicateCheckResult {
  status: 'duplicate' | 'conflict' | 'ok'
  existingRuleId?: string
  similarity?: number
  reason?: string
}

/**
 * Contradiction signal word pairs.
 * If one rule contains the first element and the other contains the second,
 * it's a contradiction signal.
 */
const CONTRADICTION_PAIRS: [string, string][] = [
  ['不支持', '支持'],
  ['不能', '可以'],
  ['不可以', '可以'],
  ['无法', '可以'],
  ['不允许', '允许'],
  ['由买家', '由卖家'],
  ['买家承担', '卖家承担'],
  ['不退', '退货'],
  ['概不退换', '退货'],
  ['不赔', '赔偿'],
  ['免费', '收费'],
  ['不包邮', '包邮'],
]

/**
 * Check if two texts have contradicting signal words.
 */
function findContradiction(newContent: string, existingContent: string): string | null {
  for (const [wordA, wordB] of CONTRADICTION_PAIRS) {
    // New rule has A, existing has B (or vice versa)
    if (
      (newContent.includes(wordA) && existingContent.includes(wordB) && !existingContent.includes(wordA)) ||
      (newContent.includes(wordB) && existingContent.includes(wordA) && !existingContent.includes(wordB))
    ) {
      return `矛盾信号: 新规则含"${newContent.includes(wordA) ? wordA : wordB}"，现有规则含"${existingContent.includes(wordB) ? wordB : wordA}"`
    }
  }
  return null
}

/**
 * Detect conflicts between a new rule and existing rules.
 * Uses vector similarity + contradiction signal word detection.
 *
 * 1. Query VectorStore for semantically similar existing rules (similarity > 0.7)
 * 2. For each similar rule, check for contradiction signals
 * 3. Return conflicts with rule IDs, reasons, and similarity scores
 */
export async function detectConflicts(
  newRule: KnowledgeRuleData,
  existingRules: Array<{ id: string; condition: string; content: string; tags: string }>
): Promise<ConflictResult[]> {
  if (existingRules.length === 0) return []

  const vs = getVectorStore()
  try {
    await vs.init()
    const queryText = `${newRule.condition} ${newRule.content}`
    const vectorResults = await vs.query(queryText, 10)

    const conflicts: ConflictResult[] = []
    const existingMap = new Map(existingRules.map(r => [r.id, r]))

    for (const result of vectorResults) {
      if (result.score < 0.7) continue

      const existing = existingMap.get(result.id)
      if (!existing) continue

      const contradiction = findContradiction(newRule.content, existing.content)
      if (contradiction) {
        conflicts.push({
          ruleId: result.id,
          reason: contradiction,
          similarity: result.score,
        })
      }
    }

    return conflicts
  } catch {
    return []
  }
}

/**
 * Check if a new rule is a duplicate or conflict with existing rules.
 * Uses vector similarity:
 * - score > 0.9 => duplicate (skip)
 * - score 0.7-0.9 + contradiction signal => conflict
 * - otherwise => ok
 */
export async function checkDuplicate(
  condition: string,
  content: string
): Promise<DuplicateCheckResult> {
  const vs = getVectorStore()
  try {
    await vs.init()
    const queryText = `${condition} ${content}`
    const results = await vs.query(queryText, 3)

    if (results.length === 0) {
      return { status: 'ok' }
    }

    const top = results[0]

    // High similarity => duplicate
    if (top.score > 0.9) {
      return {
        status: 'duplicate',
        existingRuleId: top.id,
        similarity: top.score,
      }
    }

    // Medium similarity + contradiction => conflict
    if (top.score >= 0.7) {
      const contradiction = findContradiction(content, top.document)
      if (contradiction) {
        return {
          status: 'conflict',
          existingRuleId: top.id,
          similarity: top.score,
          reason: contradiction,
        }
      }
    }

    return { status: 'ok' }
  } catch {
    return { status: 'ok' }
  }
}
