import { readFileSync } from 'fs'
import { parseFile } from '../../lib/customer-service/file-parser'
import { parseConversations } from '../../lib/customer-service/conversation-parser'

async function main() {
  // CSV
  const csv = readFileSync('data/test-files/产品规格FAQ.csv')
  const csvRules = await parseFile(Buffer.from(csv), '产品规格FAQ.csv')
  console.log('=== CSV: 产品规格FAQ ===')
  console.log(`解析出 ${csvRules.length} 条规则`)
  for (const r of csvRules.slice(0, 3)) {
    console.log(`  [${r.tags.join(',')}] ${r.condition} → ${r.content.slice(0, 40)}...`)
  }

  // TXT
  const txt = readFileSync('data/test-files/客服话术手册.txt')
  const txtRules = await parseFile(Buffer.from(txt), '客服话术手册.txt')
  console.log(`\n=== TXT: 客服话术手册 ===`)
  console.log(`解析出 ${txtRules.length} 条规则`)
  for (const r of txtRules.slice(0, 3)) {
    console.log(`  [${r.tags.join(',')}] ${r.condition} → ${r.content.slice(0, 40)}...`)
  }

  // Excel
  const xlsx = readFileSync('data/test-files/箱包产品FAQ.xlsx')
  const xlsxRules = await parseFile(Buffer.from(xlsx), '箱包产品FAQ.xlsx')
  console.log(`\n=== Excel: 箱包产品FAQ ===`)
  console.log(`解析出 ${xlsxRules.length} 条规则`)
  for (const r of xlsxRules.slice(0, 3)) {
    console.log(`  [${r.tags.join(',')}] ${r.condition} → ${r.content.slice(0, 40)}...`)
  }

  // JSON conversations
  const json = readFileSync('data/test-files/历史聊天记录.json')
  const convos = await parseConversations(Buffer.from(json), '历史聊天记录.json')
  console.log(`\n=== JSON: 历史聊天记录 ===`)
  console.log(`解析出 ${convos.length} 组有效对话对（已去短回复）`)
  for (const c of convos.slice(0, 3)) {
    console.log(`  客户: ${c.customer.slice(0, 40)}...`)
    console.log(`  客服: ${c.agent.slice(0, 40)}...`)
    console.log()
  }

  console.log('\n✅ 所有解析器验证通过')
}

main().catch(e => {
  console.error('❌ ERROR:', e)
  process.exit(1)
})
