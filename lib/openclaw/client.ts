import { spawn, execFile } from 'child_process'
import { resolve, join } from 'path'
const CALLBACK_URL = process.env.OPENCLAW_CALLBACK_URL || 'http://localhost:3848/api/openclaw/callback'
const PROJECT_DIR = resolve(process.cwd()).replace(/\\/g, '/')
const SCRAPE_SCRIPT = join(PROJECT_DIR, 'openclaw/scripts/platform-scrape.mjs').replace(/\\/g, '/')

export interface OpenClawRequest {
  skillName: string
  params: Record<string, unknown>
  callbackUrl: string
  instanceId: string
  nodeId: string
}

/**
 * Send a task to OpenClaw via CLI subprocess.
 * Spawns `openclaw agent --agent main --message "..."` as a background process.
 * Captures stdout and POSTs the result to callback URL when done.
 */
export async function sendToOpenClaw(
  skillName: string,
  params: Record<string, unknown>,
  instanceId: string,
  nodeId: string
): Promise<{ queued: boolean }> {
  try {
    // Quick check: is openclaw CLI available?
    const available = await checkOpenClawCLI()
    if (!available) {
      console.warn('[openclaw] CLI not available')
      return { queued: false }
    }

    // Pre-scrape for market-research: run Playwright + Google Trends before calling agent
    let preScrapedData = ''
    if (skillName === 'market-research') {
      const keyword = (params.keyword as string) || ''
      const sources = ((params.researchConfig as Record<string, unknown>)?.sources as string[])
        || (params.sources as string[])
        || ['taobao']
      const dateRange = (params.dateRange as number)
        || ((params.researchConfig as Record<string, unknown>)?.dateRange as number)
        || 30

      // Run Playwright scrape and Google Trends in parallel
      const [scrapeResult, trendsResult] = await Promise.all([
        preScrapeForMarketResearch(keyword, sources),
        preGoogleTrends(keyword, dateRange),
      ])
      preScrapedData = scrapeResult.scraped + trendsResult.trends
      console.log(`[openclaw] Pre-scraped ${scrapeResult.productCount} products, Google Trends: ${trendsResult.success ? 'OK' : 'failed'}`)
    }

    // Build the skill prompt (with scraped data injected for market-research)
    const message = buildSkillMessage(skillName, params, instanceId, nodeId) + preScrapedData

    // Use a Node helper script to call openclaw, avoiding shell escaping issues
    const fs = await import('fs')
    const os = await import('os')
    const path = await import('path')

    // Write message to temp file
    const msgFile = path.join(os.tmpdir(), `oc-msg-${Date.now()}.txt`).replace(/\\/g, '/')
    fs.writeFileSync(msgFile, message, 'utf-8')

    // Resolve the actual openclaw entry point (it's a shell wrapper around node + mjs)
    const openclawMjs = await resolveOpenClawMjs()

    // Write a tiny Node script that reads the message and calls openclaw directly
    const helperScript = `
const { execFileSync } = require('child_process');
const fs = require('fs');
const msg = fs.readFileSync('${msgFile}', 'utf-8');
try {
  const result = execFileSync(process.execPath, ['${openclawMjs}', 'agent', '--agent', 'main', '-m', msg, '--json'], {
    encoding: 'utf-8',
    timeout: 600000,
    env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: '' },
  });
  process.stdout.write(result);
} catch (e) {
  if (e.stdout) process.stdout.write(e.stdout);
  if (e.stderr) process.stderr.write(e.stderr);
  process.exit(e.status || 1);
}
try { fs.unlinkSync('${msgFile}'); } catch {}
`
    const scriptFile = path.join(os.tmpdir(), `oc-run-${Date.now()}.js`).replace(/\\/g, '/')
    fs.writeFileSync(scriptFile, helperScript, 'utf-8')

    const child = spawn('node', [scriptFile], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        OPENCLAW_GATEWAY_TOKEN: '',
      },
    })

    // Cleanup script file after process exits
    child.on('exit', () => {
      try { fs.unlinkSync(scriptFile) } catch {}
      try { fs.unlinkSync(msgFile) } catch {}
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString('utf-8') })
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString('utf-8') })

    child.on('close', async (code) => {
      console.log(`[openclaw] Process exited with code ${code}`)
      console.log(`[openclaw] stdout length: ${stdout.length}`)
      if (stderr) console.log(`[openclaw] stderr: ${stderr.slice(0, 200)}`)

      try {
        // Check if agent already sent a valid completed callback (via curl POST)
        // by querying the draft — if it's no longer a placeholder, agent's direct POST worked
        let agentAlreadyUpdated = false
        try {
          const checkRes = await fetch(`${CALLBACK_URL.replace('/api/openclaw/callback', '/api/drafts')}?instanceId=${instanceId}`)
          const checkData = await checkRes.json()
          const draft = checkData.data?.[0]
          if (draft) {
            // Fetch full draft content to check
            const draftRes = await fetch(`${CALLBACK_URL.replace('/api/openclaw/callback', '/api/drafts')}/${draft.id}`)
            const draftData = await draftRes.json()
            const content = draftData.data?.content
            if (content && !content._placeholder && !content._rawText && content.marketSize) {
              console.log('[openclaw] Agent already posted valid report via direct callback, skipping stdout parse')
              agentAlreadyUpdated = true
            }
          }
        } catch { /* check failed, proceed with stdout parse */ }

        if (agentAlreadyUpdated) return

        const keyword = (params.keyword as string) || '产品'
        let report: Record<string, unknown>

        // OpenClaw --json output format: {payloads: [{text: "..."}], meta: {...}}
        // Extract the actual text response first
        let responseText = stdout.trim()
        try {
          const openclawJson = JSON.parse(responseText)
          if (openclawJson.payloads?.[0]?.text) {
            responseText = openclawJson.payloads[0].text
          }
        } catch { /* not openclaw json format, use raw */ }

        // Try to extract structured JSON from the response text
        const jsonBlocks = extractJsonBlocks(responseText)
        if (jsonBlocks.length > 0) {
          // Pick the block that looks most like a MarketReport (has keyword or marketSize)
          const reportBlock = jsonBlocks.find(b => b.marketSize || b.priceDistribution || b.competitors)
            || jsonBlocks.sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length)[0]
          report = { ...reportBlock, keyword }
        } else {
          // Use raw text as report content — this is a degraded state
          console.warn('[openclaw] No JSON found in agent output, using raw text fallback')
          report = {
            keyword,
            overview: responseText || '调研完成',
            generatedAt: new Date().toISOString(),
            _rawText: true,
          }
        }

        // POST completed callback
        console.log('[openclaw] Posting callback to', CALLBACK_URL)
        await fetch(CALLBACK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceId,
            nodeId,
            status: 'completed',
            output: { fullReport: report },
          }),
        })
        console.log('[openclaw] Callback posted successfully')
      } catch (err) {
        console.error('[openclaw] Callback failed:', err)
        try {
          await fetch(CALLBACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instanceId,
              nodeId,
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
            }),
          })
        } catch { /* ignore */ }
      }
    })

    // Timeout: 10 minutes (real search takes longer than LLM-only generation)
    setTimeout(() => {
      try { child.kill() } catch { /* ignore */ }
    }, 10 * 60 * 1000)

    return { queued: true }
  } catch (err) {
    console.error('[openclaw] Failed to spawn:', err)
    return { queued: false }
  }
}

/**
 * Run platform-scrape.mjs for a single platform.
 * Returns the parsed JSON output or null on failure.
 */
function scrapePlatform(platform: string, keyword: string, limit: number = 20): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const child = execFile('node', [SCRAPE_SCRIPT, platform, keyword, '--limit', String(limit)], {
      encoding: 'utf-8',
      timeout: 45000,
      env: process.env,
    }, (error, stdout, stderr) => {
      if (stderr) console.log(`[scrape:${platform}] ${stderr.slice(0, 200)}`)
      if (error) {
        console.warn(`[scrape:${platform}] Failed:`, error.message?.slice(0, 100))
        resolve(null)
        return
      }
      try {
        const result = JSON.parse(stdout.trim())
        if (result.success && result.products?.length > 0) {
          console.log(`[scrape:${platform}] Got ${result.products.length} products`)
          resolve(result)
        } else {
          console.warn(`[scrape:${platform}] No products:`, result.error || 'empty')
          resolve(null)
        }
      } catch {
        console.warn(`[scrape:${platform}] Invalid JSON output`)
        resolve(null)
      }
    })
    // Safety timeout
    setTimeout(() => { try { child.kill() } catch {} }, 50000)
  })
}

/**
 * Pre-scrape enabled platforms before calling OpenClaw.
 * Returns a summary string to inject into the agent prompt.
 */
async function preScrapeForMarketResearch(
  keyword: string,
  sources: string[]
): Promise<{ scraped: string; productCount: number }> {
  const scrapablePlatforms = sources.filter(s =>
    ['taobao', 'jd', '1688', 'pinduoduo', 'douyin', 'xiaohongshu'].includes(s)
  )

  if (scrapablePlatforms.length === 0) {
    return { scraped: '', productCount: 0 }
  }

  console.log(`[pre-scrape] Scraping ${scrapablePlatforms.length} platforms for "${keyword}"`)

  // Run scrapers sequentially to avoid overloading
  const allProducts: Record<string, unknown>[] = []
  const platformResults: string[] = []

  for (const platform of scrapablePlatforms) {
    const result = await scrapePlatform(platform, keyword)
    if (result && Array.isArray(result.products)) {
      const products = result.products as Record<string, unknown>[]
      allProducts.push(...products)
      platformResults.push(`### ${platform} (${products.length} products)\n${JSON.stringify(products.slice(0, 30), null, 0)}`)
    } else {
      platformResults.push(`### ${platform}\n采集失败或无数据`)
    }
  }

  const scraped = `\n\n=== 以下是 Playwright 真实采集的商品数据（共 ${allProducts.length} 条）===\n请直接使用这些数据生成报告，不要编造任何商品或店铺。每条 product 中的 url 字段是真实链接，必须原样传递到 competitors 的 url 字段。\n\n${platformResults.join('\n\n')}\n\n=== 采集数据结束 ===`

  return { scraped, productCount: allProducts.length }
}

/**
 * Fetch Google Trends "interest over time" data for a keyword.
 * Returns formatted string to inject into agent prompt.
 */
async function preGoogleTrends(
  keyword: string,
  days: number
): Promise<{ trends: string; success: boolean }> {
  try {
    const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const result = await googleTrends.interestOverTime({
      keyword,
      startTime,
      geo: 'CN',
    })
    const parsed = JSON.parse(result)
    const timeline = parsed.default?.timelineData
    if (!timeline || timeline.length === 0) {
      console.warn('[google-trends] No timeline data returned')
      return { trends: '', success: false }
    }

    // Extract date + value pairs
    const dataPoints = timeline.map((point: { formattedTime: string; value: number[] }) => ({
      date: point.formattedTime,
      value: point.value[0],
    }))

    const trendsStr = `\n\n=== 以下是 Google Trends 真实搜索热度数据（关键词: "${keyword}", 地区: 中国, 近${days}天）===\n数据格式: [{date, value}]，value 为 0-100 的相对搜索热度。\n请直接使用这些数据生成 searchTrends 章节，不要编造趋势数据。\n\n${JSON.stringify(dataPoints)}\n\n=== Google Trends 数据结束 ===`

    console.log(`[google-trends] Got ${dataPoints.length} data points for "${keyword}"`)
    return { trends: trendsStr, success: true }
  } catch (err) {
    console.warn('[google-trends] Failed:', err instanceof Error ? err.message : String(err))
    return { trends: '', success: false }
  }
}

function checkOpenClawCLI(): Promise<boolean> {
  return new Promise((resolve) => {
    const check = spawn('openclaw', ['--version'], { shell: true, stdio: 'pipe' })
    check.on('close', (code) => resolve(code === 0))
    check.on('error', () => resolve(false))
    setTimeout(() => { try { check.kill() } catch {} resolve(false) }, 3000)
  })
}

/** Resolve the openclaw .mjs entry point for direct node invocation */
async function resolveOpenClawMjs(): Promise<string> {
  const fs = await import('fs')
  const path = await import('path')

  // Try nvm-managed global install (most common)
  const nvmPath = path.join(path.dirname(process.execPath), 'node_modules', 'openclaw', 'openclaw.mjs')
  if (fs.existsSync(nvmPath)) return nvmPath.replace(/\\/g, '/')

  // Try npm global (APPDATA on Windows)
  if (process.env.APPDATA) {
    const npmPath = path.join(process.env.APPDATA, 'npm', 'node_modules', 'openclaw', 'openclaw.mjs')
    if (fs.existsSync(npmPath)) return npmPath.replace(/\\/g, '/')
  }

  // Fallback
  return 'D:/App/Dev/nvm/v24.13.0/node_modules/openclaw/openclaw.mjs'
}

function buildSkillMessage(
  skillName: string,
  params: Record<string, unknown>,
  instanceId: string,
  nodeId: string
): string {
  if (skillName === 'market-research') {
    const keyword = params.keyword || '产品'
    const sources = params.sources || ['taobao', 'jd', 'xiaohongshu', 'google_trends']
    const depth = params.depth || 'standard'
    const dateRange = params.dateRange || 30

    return `/market-research keyword="${keyword}" sources=${JSON.stringify(sources)} depth="${depth}" dateRange=${dateRange} callbackUrl="${CALLBACK_URL}" instanceId="${instanceId}" nodeId="${nodeId}"`
  }

  if (skillName === 'marketing-factory') {
    const keyword = params.keyword || '产品'
    const style = params.style || '活力'
    return `你是一个专业的电商营销文案专家。为"${keyword}"写营销文案，风格：${style}。

返回严格JSON格式（不要任何其他文字、不要markdown代码块）：
{
  "headlines": ["标题1", "标题2", "标题3"],
  "mainCopy": "主文案（50-100字）",
  "hashtags": ["#话题1", "#话题2", "#话题3"],
  "callToAction": "行动号召语"
}

完成后将结果 POST 到 ${CALLBACK_URL}：
{"instanceId":"${instanceId}","nodeId":"${nodeId}","status":"completed","output":{"result": <你的JSON结果>}}`
  }

  if (skillName === 'customer-service') {
    const customerMessage = params.customerMessage || params.message || '我的订单什么时候发货？'
    const customerName = params.customerName || params.name || '顾客'
    const orderInfo = params.orderInfo ? JSON.stringify(params.orderInfo) : ''
    const intent = (params.intent as string) || ''
    const sentiment = (params.sentiment as string) || ''
    const ticketId = (params.ticketId as string) || instanceId

    // Inject knowledge context: both document chunks and rules
    let knowledgeContext = ''
    const chunks = params.knowledgeChunks as Array<{ id: string; content: string; filename: string; chunkIndex: number; score: number }> | undefined
    const rules = params.knowledgeRules as Array<{ id: string; condition: string; content: string; confidence: number; score: number }> | undefined

    if (chunks && chunks.length > 0) {
      knowledgeContext += `\n\n【文档参考】以下是从文档库检索到的相关片段，基于它自由组织回复：\n${chunks.map((c, i) => `片段${i + 1} [来源:${c.filename}]:\n  ${c.content}`).join('\n\n')}\n【文档参考结束】`
    }
    if (rules && rules.length > 0) {
      knowledgeContext += `\n\n【话术参考】以下是标准回复模板，优先参考这些话术：\n${rules.map((r, i) => `规则${i + 1} [ID:${r.id}]:\n  条件：${r.condition}\n  回复参考：${r.content}\n  置信度：${(r.confidence * 100).toFixed(0)}%`).join('\n\n')}\n【话术参考结束】`
    }

    return `你是一个专业的电商客服代表，请处理以下客户工单并生成回复草稿。

客户姓名：${customerName}
客户消息：${customerMessage}
${intent ? `意图分类：${intent}` : ''}
${sentiment ? `客户情绪：${sentiment}` : ''}
${orderInfo ? `订单信息：${orderInfo}` : ''}
${knowledgeContext}

要求：
1. 语气亲切专业，解决客户问题
2. 如果知识库规则中有相关回复参考，请基于它生成回复（可适当调整措辞），并在 citedRuleIds 中标注引用的规则 ID
3. 回复简洁明了，不超过150字
4. reasoning 字段说明你为什么这样回复（引用了哪些规则、做了什么判断）

返回严格JSON格式（不要任何其他文字、不要markdown代码块）：
{
  "reply": "回复内容",
  "intent": "意图分类",
  "sentiment": "情感分析",
  "citedRuleIds": ["引用的规则ID"],
  "reasoning": "推理过程说明",
  "confidence": 0.85
}

完成后将结果 POST 到 ${CALLBACK_URL}：
{"instanceId":"${instanceId}","nodeId":"${nodeId}","status":"completed","output":{"result": <你的JSON结果>, "ticketId": "${ticketId}"}}`
  }

  if (skillName === 'product-listing') {
    const keyword = params.keyword || '产品'
    const category = params.category || '通用'
    const productInfo = params.productInfo ? JSON.stringify(params.productInfo) : '{}'
    return `你是一个专业的电商产品上架专家。请为以下产品生成完整的上架信息。

产品名称：${keyword}
品类：${category}
产品信息：${productInfo}

返回严格JSON格式（不要任何其他文字、不要markdown代码块）：
{
  "title": "产品标题（不超过60字，包含关键词）",
  "bullets": ["卖点1", "卖点2", "卖点3", "卖点4", "卖点5"],
  "description": "产品描述（100-200字）",
  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"],
  "suggestedPrice": 299,
  "pricingReason": "定价依据说明"
}

完成后将结果 POST 到 ${CALLBACK_URL}：
{"instanceId":"${instanceId}","nodeId":"${nodeId}","status":"completed","output":{"result": <你的JSON结果>}}`
  }

  if (skillName === 'diff-classify') {
    const original = params.original || ''
    const edited = params.edited || ''
    return `你是一个文本分析专家。请判断以下两段客服回复之间的修改属于"语义修改"还是"措辞修改"。

原始回复：${original}
修改后回复：${edited}

判断标准：
- 语义修改(semantic)：改变了回复的实质内容、政策、承诺或解决方案
- 措辞修改(cosmetic)：只调整了用语、语气、格式，但实质内容不变

返回严格JSON格式（不要任何其他文字）：
{"diffType": "semantic或cosmetic", "reason": "判断依据"}

完成后将结果 POST 到 ${CALLBACK_URL}：
{"instanceId":"${instanceId}","nodeId":"${nodeId}","status":"completed","output":{"result": <你的JSON结果>}}`
  }

  if (skillName === 'knowledge-extract') {
    const message = params.message || ''
    return `你是一个客服知识管理专家。用户用自然语言描述了一条业务规则，请从中提取结构化的知识规则。

用户输入：${message}

请从中提取：
1. condition: 触发条件（什么情况下使用这条规则）
2. content: 回复内容（客服应该怎么说）
3. tags: 标签数组（如：退货、尺码、物流、优惠、材质、运费等）

返回严格JSON格式（不要任何其他文字）：
{"condition": "触发条件", "content": "回复内容", "tags": ["标签1", "标签2"]}

完成后将结果 POST 到 ${CALLBACK_URL}：
{"instanceId":"${instanceId}","nodeId":"${nodeId}","status":"completed","output":{"result": <你的JSON结果>}}`
  }

  if (skillName === 'knowledge-extract-batch') {
    const fileContent = params.fileContent || ''
    const fileName = params.fileName || '未知文件'
    return `你是一个专业的客服知识管理专家。请从以下文件内容中提取客服知识规则。

${fileContent}

要求：
1. 从文件内容中识别出所有可用于客服自动回复的知识点
2. 每条规则转化为：condition（客户可能问的问题）、content（客服回复内容）、tags（标签）
3. 如果原文是产品说明/规格，请转化为客户 Q&A 的形式
4. content 应该语气亲切专业，适合直接作为客服回复使用
5. tags 从以下选择：退货、物流、尺码、材质、优惠、售后、支付、售前、定制、运费

返回严格JSON数组格式（不要任何其他文字、不要markdown代码块）：
[{"condition":"客户问...", "content":"回复内容...", "tags":["标签"]}]

完成后将结果 POST 到 ${CALLBACK_URL}：
{"instanceId":"${instanceId}","nodeId":"${nodeId}","status":"completed","output":{"result": <你的JSON数组>, "fileName": "${fileName}"}}`
  }

  return `/skill ${skillName} ${JSON.stringify(params)}`
}

/**
 * Extract JSON objects from text (handles markdown code blocks and raw JSON)
 */
function extractJsonBlocks(text: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = []

  // Try markdown code blocks first
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)```/g
  let match
  while ((match = codeBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (typeof parsed === 'object' && parsed !== null) {
        results.push(parsed)
      }
    } catch { /* not valid JSON */ }
  }

  // Try raw JSON objects
  if (results.length === 0) {
    const jsonRegex = /\{[\s\S]*\}/g
    while ((match = jsonRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[0])
        if (typeof parsed === 'object' && parsed !== null) {
          results.push(parsed)
        }
      } catch { /* not valid JSON */ }
    }
  }

  return results
}

export function isOpenClawAvailable(): boolean {
  return true
}

/**
 * Synchronous OpenClaw call: spawns CLI, waits for result, returns parsed output.
 * Use this when you NEED the AI result before responding (e.g., file import).
 * Timeout: 120 seconds.
 * Returns null if OpenClaw CLI is unavailable or fails.
 */
export async function callOpenClawSync(
  skillName: string,
  params: Record<string, unknown>,
  timeoutMs: number = 120000
): Promise<unknown | null> {
  try {
    const available = await checkOpenClawCLI()
    if (!available) {
      console.warn('[openclaw-sync] CLI not available')
      return null
    }

    // Build message (reuse buildSkillMessage but without callback instructions)
    const dummyId = `sync-${Date.now()}`
    let message = buildSkillMessage(skillName, params, dummyId, 'sync')

    // Strip the "POST to callback" instruction — we read stdout directly
    const callbackIdx = message.indexOf('完成后将结果 POST')
    if (callbackIdx > 0) {
      message = message.slice(0, callbackIdx).trim()
    }

    // Append instruction to return JSON to stdout
    message += '\n\n请直接返回JSON结果，不要POST到任何URL。'

    const fs = await import('fs')
    const os = await import('os')
    const path = await import('path')

    const msgFile = path.join(os.tmpdir(), `oc-sync-${Date.now()}.txt`).replace(/\\/g, '/')
    fs.writeFileSync(msgFile, message, 'utf-8')

    const openclawMjs = await resolveOpenClawMjs()

    // Use helper script to avoid command line length limits (same pattern as sendToOpenClaw)
    const helperScript = `
const { execFileSync } = require('child_process');
const fs = require('fs');
const msg = fs.readFileSync('${msgFile}', 'utf-8');
try {
  const result = execFileSync(process.execPath, ['${openclawMjs}', 'agent', '--agent', 'main', '-m', msg, '--json'], {
    encoding: 'utf-8',
    timeout: ${timeoutMs},
    env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: '' },
  });
  process.stdout.write(result);
} catch (e) {
  if (e.stdout) process.stdout.write(e.stdout);
  if (e.stderr) process.stderr.write(e.stderr);
  process.exit(e.status || 1);
}
`
    const scriptFile = path.join(os.tmpdir(), `oc-sync-run-${Date.now()}.js`).replace(/\\/g, '/')
    fs.writeFileSync(scriptFile, helperScript, 'utf-8')

    return new Promise((resolve) => {
      const child = spawn('node', [scriptFile], {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, OPENCLAW_GATEWAY_TOKEN: '' },
      })

      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (data: Buffer) => { stdout += data.toString('utf-8') })
      child.stderr.on('data', (data: Buffer) => { stderr += data.toString('utf-8') })

      const timer = setTimeout(() => {
        try { child.kill() } catch {}
        console.warn('[openclaw-sync] Timeout after', timeoutMs, 'ms')
        resolve(null)
      }, timeoutMs)

      child.on('close', (code) => {
        clearTimeout(timer)
        try { fs.unlinkSync(msgFile) } catch {}
        try { fs.unlinkSync(scriptFile) } catch {}

        console.log(`[openclaw-sync] Exit code: ${code}, stdout: ${stdout.length} bytes`)
        if (stderr) console.log(`[openclaw-sync] stderr: ${stderr.slice(0, 200)}`)

        if (!stdout.trim()) {
          resolve(null)
          return
        }

        // Parse OpenClaw --json output: {payloads: [{text: "..."}]}
        let responseText = stdout.trim()
        try {
          const openclawJson = JSON.parse(responseText)
          if (openclawJson.payloads?.[0]?.text) {
            responseText = openclawJson.payloads[0].text
          }
        } catch { /* not openclaw wrapper, use raw */ }

        // Extract JSON from response
        // Try JSON array first (for batch extraction)
        const arrayMatch = responseText.match(/\[[\s\S]*\]/)
        if (arrayMatch) {
          try {
            const parsed = JSON.parse(arrayMatch[0])
            if (Array.isArray(parsed)) {
              resolve(parsed)
              return
            }
          } catch { /* not valid array */ }
        }

        // Try JSON object
        const blocks = extractJsonBlocks(responseText)
        if (blocks.length > 0) {
          resolve(blocks.length === 1 ? blocks[0] : blocks)
          return
        }

        console.warn('[openclaw-sync] No JSON found in output')
        resolve(null)
      })

      child.on('error', () => {
        clearTimeout(timer)
        resolve(null)
      })
    })
  } catch (err) {
    console.error('[openclaw-sync] Failed:', err)
    return null
  }
}
