import { prisma } from '@/lib/db/prisma'
import { getVectorStore } from './vector-store'

/**
 * Initialize the VectorStore from all active rules in Prisma.
 * Skips if the store already has data (unless force=true).
 * Returns the number of rules loaded.
 */
export async function initializeVectorStore(force = false): Promise<number> {
  const vs = getVectorStore()
  await vs.init()

  // Skip if already populated
  if (!force && vs.size > 0) {
    return 0
  }

  const rules = await prisma.knowledgeRule.findMany({
    where: { status: 'active' },
  })

  if (rules.length === 0) return 0

  for (const rule of rules) {
    const tags: string[] = JSON.parse(rule.tags)
    await vs.upsert(rule.id, rule.condition, rule.content, { type: 'rule', tags: tags.join(',') })
  }

  return rules.length
}
