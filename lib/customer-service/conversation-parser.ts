export interface ConversationPair {
  customer: string
  agent: string
}

export interface SamplingStats {
  original: number
  afterDedup: number
  afterFilter: number
  sampled: number
  groups: Record<string, number>
}

interface RawMessage {
  role: string
  content: string
}

/**
 * Parse a buffer of conversations into customer-agent pairs.
 * Supports JSON array [{role, content}] and CSV (role,content) formats.
 * - Pairs customer messages with immediately following agent replies
 * - Discards agent replies shorter than 10 characters
 * - Deduplicates identical pairs
 */
export async function parseConversations(
  buffer: Buffer,
  filename: string
): Promise<ConversationPair[]> {
  const text = buffer.toString('utf-8').trim()
  if (!text) return []

  const ext = filename.split('.').pop()?.toLowerCase() || ''
  let messages: RawMessage[]

  if (ext === 'json' || text.startsWith('[')) {
    messages = parseJsonMessages(text)
  } else {
    messages = parseCsvMessages(text)
  }

  return pairAndFilter(messages)
}

function parseJsonMessages(text: string): RawMessage[] {
  try {
    const data = JSON.parse(text)
    if (!Array.isArray(data)) return []
    return data
      .filter((m: Record<string, unknown>) => m.role && m.content)
      .map((m: Record<string, unknown>) => ({
        role: String(m.role),
        content: String(m.content),
      }))
  } catch {
    return []
  }
}

function parseCsvMessages(text: string): RawMessage[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length === 0) return []

  // Detect and skip header
  const firstLine = lines[0].toLowerCase()
  const startIdx = (firstLine.includes('role') && firstLine.includes('content')) ? 1 : 0

  const messages: RawMessage[] = []
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i]
    // Split on first comma only
    const commaIdx = line.indexOf(',')
    if (commaIdx < 0) continue
    const role = line.slice(0, commaIdx).trim()
    const content = line.slice(commaIdx + 1).trim()
    if (role && content) {
      messages.push({ role, content })
    }
  }
  return messages
}

function pairAndFilter(messages: RawMessage[]): ConversationPair[] {
  const pairs: ConversationPair[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.role === 'customer' && i + 1 < messages.length) {
      const next = messages[i + 1]
      if (next.role === 'agent') {
        // Skip if agent reply is too short
        if (next.content.length >= 10) {
          pairs.push({ customer: msg.content, agent: next.content })
        }
        i++ // skip the agent message
      }
      // If next is also customer, skip (unpaired)
    }
  }

  // Deduplicate
  const seen = new Set<string>()
  return pairs.filter(p => {
    const key = `${p.customer}|${p.agent}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Keyword groups for sampling ────────────────────────────────────────────────

const KEYWORD_GROUPS: Record<string, string[]> = {
  '退货退款': ['退货', '退款', '退回', '不想要', '换货'],
  '物流配送': ['物流', '快递', '配送', '发货', '运费', '到货', '签收'],
  '尺码规格': ['尺码', '尺寸', '大小', '规格', '颜色', '款式'],
  '优惠活动': ['优惠', '打折', '折扣', '满减', '券', '活动', '促销'],
}

function classifyPair(pair: ConversationPair): string {
  const text = pair.customer + pair.agent
  for (const [group, keywords] of Object.entries(KEYWORD_GROUPS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return group
    }
  }
  return '通用'
}

/**
 * Sample representative conversations from a larger set.
 * 1. Group by keyword category
 * 2. Each group takes at most ceil(maxSamples / groupCount) items
 * 3. Within each group, prefer longer agent replies (more detailed)
 */
export function sampleConversations(
  pairs: ConversationPair[],
  maxSamples: number = 30
): { sampled: ConversationPair[]; stats: SamplingStats } {
  // parseConversations already handles dedup and short-filter,
  // but we track the original count passed in for stats
  const afterFilter = pairs.length

  // Group by keyword
  const grouped: Record<string, ConversationPair[]> = {}
  for (const pair of pairs) {
    const group = classifyPair(pair)
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(pair)
  }

  const groupCount = Object.keys(grouped).length
  const perGroup = Math.ceil(maxSamples / groupCount)

  const sampled: ConversationPair[] = []
  const groupStats: Record<string, number> = {}

  for (const [group, items] of Object.entries(grouped)) {
    // Sort by agent reply length descending (more detailed first)
    const sorted = [...items].sort((a, b) => b.agent.length - a.agent.length)
    const taken = sorted.slice(0, perGroup)
    sampled.push(...taken)
    groupStats[group] = taken.length
  }

  // If total exceeds maxSamples, trim (take from largest groups last)
  const finalSampled = sampled.slice(0, maxSamples)

  return {
    sampled: finalSampled,
    stats: {
      original: afterFilter, // Will be overridden by caller with true original count
      afterDedup: afterFilter, // Will be overridden by caller
      afterFilter,
      sampled: finalSampled.length,
      groups: groupStats,
    },
  }
}
