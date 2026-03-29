import { NextRequest, NextResponse } from 'next/server'
import { listRules, createRule } from '@/lib/customer-service/knowledge-store'
import type { RuleListQuery } from '@/lib/customer-service/types'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const query: RuleListQuery = {
    source: (sp.get('source') as RuleListQuery['source']) || undefined,
    status: (sp.get('status') as RuleListQuery['status']) || undefined,
    tags: sp.get('tags')?.split(',').filter(Boolean) || undefined,
    confidenceMin: sp.get('confidenceMin') ? Number(sp.get('confidenceMin')) : undefined,
    confidenceMax: sp.get('confidenceMax') ? Number(sp.get('confidenceMax')) : undefined,
    search: sp.get('search') || undefined,
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    limit: sp.get('limit') ? Number(sp.get('limit')) : 20,
  }
  const result = await listRules(query)
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Batch create: { rules: [...] }
  if (Array.isArray(body.rules)) {
    const created: unknown[] = []
    const duplicates: Array<{ condition: string; existingRuleId?: string }> = []
    const conflicts: Array<{ new: unknown; existing: { id?: string }; reason?: string }> = []
    const errors: Array<{ condition: string; error: string }> = []

    for (const item of body.rules) {
      try {
        const result = await createRule({
          condition: item.condition,
          content: item.content,
          tags: item.tags || [],
          source: item.source || 'document',
          confidence: item.confidence ?? 0.8,
        })

        if (result.status === 'duplicate') {
          duplicates.push({
            condition: item.condition,
            existingRuleId: result.existingRuleId,
          })
        } else if (result.status === 'conflict') {
          conflicts.push({
            new: result.rule,
            existing: { id: result.existingRuleId },
            reason: result.reason,
          })
          // Still created, so add to created list
          if (result.rule) created.push(result.rule)
        } else {
          if (result.rule) created.push(result.rule)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push({ condition: item.condition, error: msg })
      }
    }

    return NextResponse.json({
      created,
      duplicates,
      conflicts,
      errors: errors.length > 0 ? errors : undefined,
      meta: {
        createdCount: created.length,
        duplicateCount: duplicates.length,
        conflictCount: conflicts.length,
      },
    })
  }

  // Single create
  const result = await createRule(body)
  if (result.status === 'duplicate') {
    return NextResponse.json({
      status: 'duplicate',
      existingRuleId: result.existingRuleId,
    }, { status: 409 })
  }
  return NextResponse.json({ data: result.rule, status: result.status })
}
