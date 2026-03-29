import { prisma } from '@/lib/db/prisma'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { csEmitter } from './sse-events'

const MEMORY_DIR = join(process.cwd(), 'openclaw', 'memory')

/**
 * Write-time rebuild: read all active rules from Prisma,
 * generate Markdown files, write to OpenClaw memory directory.
 */
export async function syncKnowledgeToMemory(changedTags?: string[]): Promise<number> {
  const rules = await prisma.knowledgeRule.findMany({
    where: { status: 'active' },
    orderBy: { hitCount: 'desc' },
  })

  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true })
  }

  // Group by primary tag
  const tagGroups: Record<string, typeof rules> = {}
  for (const rule of rules) {
    const tags: string[] = JSON.parse(rule.tags)
    const primaryTag = tags[0] || 'general'
    if (!tagGroups[primaryTag]) tagGroups[primaryTag] = []
    tagGroups[primaryTag].push(rule)
  }

  for (const [tag, groupRules] of Object.entries(tagGroups)) {
    // If changedTags specified, only rewrite those tag files
    if (changedTags && changedTags.length > 0 && !changedTags.includes(tag)) {
      continue
    }
    const content = generateMemoryMarkdown(tag, groupRules)
    writeFileSync(join(MEMORY_DIR, `cs-rules-${tag}.md`), content, 'utf-8')
  }

  // Write summary index
  const summary = generateSummaryMarkdown(rules)
  writeFileSync(join(MEMORY_DIR, 'cs-rules-index.md'), summary, 'utf-8')

  csEmitter.emit({ type: 'knowledge:synced', ruleCount: rules.length })
  return rules.length
}

function generateMemoryMarkdown(
  tag: string,
  rules: Array<{ condition: string; content: string; confidence: number }>
): string {
  const lines = [
    `# 客服知识规则 — ${tag}`,
    '',
    `> 共 ${rules.length} 条规则，按引用频率排序`,
    '',
  ]

  for (const rule of rules) {
    lines.push(`## 当：${rule.condition}`)
    lines.push('')
    lines.push(rule.content)
    lines.push('')
    lines.push(`置信度：${(rule.confidence * 100).toFixed(0)}%`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

function generateSummaryMarkdown(
  rules: Array<{ condition: string; tags: string; confidence: number }>
): string {
  const lines = [
    '# 客服知识规则索引',
    '',
    `> 共 ${rules.length} 条活跃规则`,
    '',
    '| 条件 | 标签 | 置信度 |',
    '|------|------|--------|',
  ]

  for (const rule of rules) {
    const tags = JSON.parse(rule.tags).join(', ')
    lines.push(`| ${rule.condition} | ${tags} | ${(rule.confidence * 100).toFixed(0)}% |`)
  }

  return lines.join('\n')
}
