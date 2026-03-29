import { prisma } from '@/lib/db/prisma'
import { syncKnowledgeToMemory } from './memory-sync'
import { getVectorStore } from './vector-store'
import { detectConflicts, checkDuplicate } from './conflict-detector'
import type { RuleListQuery, KnowledgeRuleData } from './types'

export interface CreateRuleResult {
  status: 'created' | 'duplicate' | 'conflict'
  rule?: Record<string, unknown>
  existingRuleId?: string
  similarity?: number
  reason?: string
}

function formatRule(r: { id: string; condition: string; content: string; tags: string; conflictsWith: string; [key: string]: unknown }) {
  return { ...r, tags: JSON.parse(r.tags), conflictsWith: JSON.parse(r.conflictsWith) }
}

export async function listRules(query: RuleListQuery) {
  const { source, status, tags, confidenceMin, confidenceMax, search, page = 1, limit = 20 } = query

  const where: Record<string, unknown> = {}
  if (source) where.source = source
  if (status) where.status = status
  if (confidenceMin !== undefined || confidenceMax !== undefined) {
    where.confidence = {
      ...(confidenceMin !== undefined ? { gte: confidenceMin } : {}),
      ...(confidenceMax !== undefined ? { lte: confidenceMax } : {}),
    }
  }
  if (search) {
    where.OR = [
      { condition: { contains: search } },
      { content: { contains: search } },
    ]
  }
  if (tags && tags.length > 0) {
    where.AND = tags.map(tag => ({ tags: { contains: `"${tag}"` } }))
  }

  const [rules, total] = await Promise.all([
    prisma.knowledgeRule.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.knowledgeRule.count({ where }),
  ])

  return {
    data: rules.map(r => ({ ...r, tags: JSON.parse(r.tags), conflictsWith: JSON.parse(r.conflictsWith) })),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

export async function createRule(data: KnowledgeRuleData): Promise<CreateRuleResult> {
  // Check for duplicates/conflicts via vector similarity
  const dupCheck = await checkDuplicate(data.condition, data.content)

  if (dupCheck.status === 'duplicate') {
    return {
      status: 'duplicate',
      existingRuleId: dupCheck.existingRuleId,
      similarity: dupCheck.similarity,
    }
  }

  if (dupCheck.status === 'conflict') {
    // Still create the rule but mark the conflict
    const existingRules = await prisma.knowledgeRule.findMany({ where: { status: 'active' } })
    const conflicts = await detectConflicts(data, existingRules)
    const conflictIds = conflicts.map(c => c.ruleId)

    const rule = await prisma.knowledgeRule.create({
      data: {
        condition: data.condition,
        content: data.content,
        tags: JSON.stringify(data.tags),
        category: data.category || 'general',
        source: data.source,
        sourceRef: data.sourceRef || null,
        confidence: data.confidence,
        conflictsWith: JSON.stringify(conflictIds),
      },
    })

    const vs = getVectorStore()
    await vs.upsert(rule.id, data.condition, data.content, { type: 'rule', tags: data.tags.join(',') })
    await syncKnowledgeToMemory(data.tags)

    return {
      status: 'conflict',
      rule: formatRule(rule),
      existingRuleId: dupCheck.existingRuleId,
      similarity: dupCheck.similarity,
      reason: dupCheck.reason,
    }
  }

  // Normal create
  const existingRules = await prisma.knowledgeRule.findMany({ where: { status: 'active' } })
  const conflicts = await detectConflicts(data, existingRules)
  const conflictIds = conflicts.map(c => c.ruleId)

  const rule = await prisma.knowledgeRule.create({
    data: {
      condition: data.condition,
      content: data.content,
      tags: JSON.stringify(data.tags),
      category: data.category || 'general',
      source: data.source,
      sourceRef: data.sourceRef || null,
      confidence: data.confidence,
      conflictsWith: JSON.stringify(conflictIds),
    },
  })

  const vs = getVectorStore()
  await vs.upsert(rule.id, data.condition, data.content, { type: 'rule', tags: data.tags.join(',') })
  await syncKnowledgeToMemory(data.tags)

  return { status: 'created', rule: formatRule(rule) }
}

export async function updateRule(id: string, data: Partial<KnowledgeRuleData> & { status?: string }) {
  const updateData: Record<string, unknown> = {}
  if (data.condition !== undefined) updateData.condition = data.condition
  if (data.content !== undefined) updateData.content = data.content
  if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags)
  if (data.category !== undefined) updateData.category = data.category
  if (data.confidence !== undefined) updateData.confidence = data.confidence
  if (data.status !== undefined) updateData.status = data.status

  const rule = await prisma.knowledgeRule.update({ where: { id }, data: updateData })

  // Sync to vector store
  const vs = getVectorStore()
  const tags: string[] = JSON.parse(rule.tags)
  await vs.upsert(rule.id, rule.condition, rule.content, { type: 'rule', tags: tags.join(',') })

  await syncKnowledgeToMemory(data.tags)
  return { ...rule, tags, conflictsWith: JSON.parse(rule.conflictsWith) }
}

export async function deprecateRule(id: string) {
  const rule = await prisma.knowledgeRule.update({
    where: { id },
    data: { status: 'deprecated' },
  })

  // Remove from vector store
  const vs = getVectorStore()
  await vs.remove(id)

  await syncKnowledgeToMemory()
  return rule
}

export async function getKnowledgeStats() {
  const [total, active, pending, deprecated] = await Promise.all([
    prisma.knowledgeRule.count(),
    prisma.knowledgeRule.count({ where: { status: 'active' } }),
    prisma.knowledgeRule.count({ where: { status: 'pending' } }),
    prisma.knowledgeRule.count({ where: { status: 'deprecated' } }),
  ])

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const weekNew = await prisma.knowledgeRule.count({
    where: { createdAt: { gte: oneWeekAgo } },
  })

  return { total, active, pending, deprecated, weekNew }
}

export function parseImportedText(text: string): KnowledgeRuleData[] {
  const lines = text.split('\n').filter(l => l.trim())
  const rules: KnowledgeRuleData[] = []

  for (const line of lines) {
    if (line.includes('|')) {
      const [condition, content] = line.split('|').map(s => s.trim())
      if (condition && content) {
        rules.push({ condition, content, tags: [], source: 'document', confidence: 0.8 })
      }
    } else if (line.length > 10) {
      rules.push({
        condition: line.slice(0, 40) + (line.length > 40 ? '...' : ''),
        content: line,
        tags: [],
        source: 'document',
        confidence: 0.6,
      })
    }
  }

  return rules
}
