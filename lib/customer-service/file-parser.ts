import type { KnowledgeRuleData } from './types'

const TAG_KEYWORDS: Record<string, string[]> = {
  '退货': ['退货', '退换', '退回', '退款', '七天无理由', '7天无理由'],
  '物流': ['物流', '快递', '配送', '发货', '包裹', '运输', '到达'],
  '尺码': ['尺码', '尺寸', '大小', '号码', '偏大', '偏小', '码数'],
  '材质': ['材质', '面料', '纯棉', '涤纶', '成分', '布料'],
  '优惠': ['优惠', '折扣', '满减', '促销', '打折', '优惠券', '活动'],
  '售后': ['售后', '维修', '保修', '换货', '质量问题'],
  '支付': ['支付', '付款', '转账', '货到付款', '分期'],
  '运费': ['运费', '包邮', '邮费'],
}

/**
 * Infer tags from text using keyword matching.
 * Used as fallback when OpenClaw is unavailable.
 */
export function inferTags(condition: string, content: string): string[] {
  const text = `${condition} ${content}`
  const matched: string[] = []
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      matched.push(tag)
    }
  }
  return matched.length > 0 ? matched : ['通用']
}

/**
 * Extract raw text and structured data from an uploaded file.
 * Does NOT create rules — just extracts content for AI processing.
 *
 * Returns:
 * - text: raw text content (for PDF/TXT)
 * - structured: pre-parsed rows with condition/content (for CSV/Excel with headers)
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string
): Promise<{ text: string; structured: Array<{ condition: string; content: string }> }> {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  try {
    switch (ext) {
      case 'xlsx':
      case 'xls':
        return await extractExcel(buffer)
      case 'pdf':
        return await extractPdf(buffer)
      case 'csv':
        return extractCsv(buffer.toString('utf-8'))
      case 'txt':
      default:
        return { text: buffer.toString('utf-8'), structured: [] }
    }
  } catch (err) {
    console.error(`[file-parser] Failed to extract from ${filename}:`, err)
    return { text: '', structured: [] }
  }
}

/**
 * Extract from CSV: if headers match known column names, return structured data.
 * Otherwise return as raw text.
 */
function extractCsv(text: string): { text: string; structured: Array<{ condition: string; content: string }> } {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return { text, structured: [] }

  const header = lines[0]
  const headerLower = header.toLowerCase()
  const sep = header.includes('\t') ? '\t' : ','
  const cols = header.split(sep).map(c => c.trim().toLowerCase())

  // Try to find condition/content columns
  const condIdx = cols.findIndex(c =>
    ['条件', 'condition', '问题', 'question', 'q', '触发'].includes(c)
  )
  const contIdx = cols.findIndex(c =>
    ['内容', 'content', '回答', 'answer', 'a', '回复', 'reply'].includes(c)
  )

  if (condIdx >= 0 && contIdx >= 0) {
    // Structured: has recognizable columns
    const structured = []
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(sep).map(c => c.trim())
      const condition = cells[condIdx]
      const content = cells[contIdx]
      if (condition && content) {
        structured.push({ condition, content })
      }
    }
    return { text, structured }
  }

  // No recognizable headers — return as raw text for AI to process
  return { text, structured: [] }
}

/**
 * Extract from Excel: read first sheet, try to find structured columns.
 */
async function extractExcel(buffer: Buffer): Promise<{ text: string; structured: Array<{ condition: string; content: string }> }> {
  const xlsxMod = await import('xlsx')
  // Handle both ESM default and CJS module
  const XLSX = (xlsxMod as any).default ?? xlsxMod
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return { text: '', structured: [] }

  // Get raw text representation
  const text = XLSX.utils.sheet_to_csv(sheet)

  // Try structured extraction
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet)
  const structured: Array<{ condition: string; content: string }> = []

  for (const row of rows) {
    const condition = row['条件'] || row['condition'] || row['Condition'] ||
                     row['问题'] || row['question'] || row['Question'] || ''
    const content = row['内容'] || row['content'] || row['Content'] ||
                   row['回答'] || row['answer'] || row['Answer'] || row['回复'] || ''

    if (condition && content) {
      structured.push({ condition: String(condition), content: String(content) })
    }
  }

  // If no structured columns found, just return all row values as text
  if (structured.length === 0) {
    return { text, structured: [] }
  }

  return { text, structured }
}

/**
 * Extract text from PDF.
 */
async function extractPdf(buffer: Buffer): Promise<{ text: string; structured: Array<{ condition: string; content: string }> }> {
  const pdfModule = await import('pdf-parse')
  const pdfParse = (pdfModule as any).default || pdfModule
  const data = await pdfParse(buffer)
  return { text: data.text || '', structured: [] }
}

/**
 * Legacy: parse file directly into rules (kept for backward compatibility with tests).
 */
export async function parseFile(buffer: Buffer, filename: string): Promise<KnowledgeRuleData[]> {
  const { text, structured } = await extractTextFromFile(buffer, filename)

  if (structured.length > 0) {
    return structured.map(row => ({
      condition: row.condition,
      content: row.content,
      tags: inferTags(row.condition, row.content),
      source: 'document' as const,
      confidence: 0.7,
    }))
  }

  // Fallback for raw text
  const lines = text.split('\n').filter(l => l.trim().length > 10)
  return lines.slice(0, 50).map(line => {
    if (line.includes('|')) {
      const [cond, cont] = line.split('|').map(s => s.trim())
      return {
        condition: cond || cont.slice(0, 40),
        content: cont || cond,
        tags: inferTags(cond, cont),
        source: 'document' as const,
        confidence: 0.7,
      }
    }
    return {
      condition: line.slice(0, 50) + (line.length > 50 ? '...' : ''),
      content: line,
      tags: inferTags(line, ''),
      source: 'document' as const,
      confidence: 0.5,
    }
  })
}
