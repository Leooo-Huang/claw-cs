import { NextRequest, NextResponse } from 'next/server'
import { createRule } from '@/lib/customer-service/knowledge-store'
import { callOpenClawSync } from '@/lib/openclaw/client'

export async function POST(req: NextRequest) {
  const { message, action, ruleData } = await req.json()

  // If confirming a rule for ingestion
  if (action === 'confirm' && ruleData) {
    const rule = await createRule({
      condition: ruleData.condition,
      content: ruleData.content,
      tags: ruleData.tags || [],
      source: 'conversation',
      confidence: 0.9,
    })
    return NextResponse.json({
      data: {
        type: 'rule_created',
        rule,
        reply: `规则已入库：${ruleData.condition}`,
      },
    })
  }

  // 调 OpenClaw 同步等待 AI 提取规则
  const aiResult = await callOpenClawSync('knowledge-extract', { message })

  if (aiResult && typeof aiResult === 'object' && !Array.isArray(aiResult)) {
    const extracted = aiResult as { condition?: string; content?: string; tags?: string[] }
    if (extracted.condition && extracted.content) {
      return NextResponse.json({
        data: {
          type: 'rule_preview',
          candidate: {
            condition: extracted.condition,
            content: extracted.content,
            tags: extracted.tags || inferTags(extracted.condition + ' ' + extracted.content),
          },
          reply: '根据您的描述，AI 整理了以下规则：',
          source: 'ai',
        },
      })
    }
  }

  // OpenClaw 不可用 — 本地 regex 提取
  const extracted = extractRuleFromMessage(message)
  return NextResponse.json({
    data: {
      type: 'rule_preview',
      candidate: extracted,
      reply: '根据您的描述，我整理了以下规则：',
      source: 'local',
    },
  })
}

function extractRuleFromMessage(text: string): {
  condition: string
  content: string
  tags: string[]
} {
  const conditionalPatterns = [
    /如果(?:客户)?(.+?)[,，](?:就|则|应该)?(.+)/,
    /当(?:客户)?(.+?)[,，](.+)/,
    /(?:客户)?(.+?)的时候[,，](.+)/,
    /(.+?)时[,，](.+)/,
  ]

  for (const pattern of conditionalPatterns) {
    const match = text.match(pattern)
    if (match) {
      return {
        condition: match[1].trim(),
        content: match[2].trim(),
        tags: inferTags(text),
      }
    }
  }

  return {
    condition: text.length > 30 ? text.slice(0, 30) + '...' : text,
    content: text,
    tags: inferTags(text),
  }
}

function inferTags(text: string): string[] {
  const tags: string[] = []
  if (/退[货款换]|退回|退货/.test(text)) tags.push('退货')
  if (/尺[码号寸]|大小|偏大|偏小/.test(text)) tags.push('尺码')
  if (/物流|快递|包裹|发货|配送/.test(text)) tags.push('物流')
  if (/价格|优惠|折扣|满减|活动/.test(text)) tags.push('优惠')
  if (/材质|面料|成分|纯棉/.test(text)) tags.push('材质')
  if (/运费/.test(text)) tags.push('运费')
  if (tags.length === 0) tags.push('通用')
  return tags
}
