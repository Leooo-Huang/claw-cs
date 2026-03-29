import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/openclaw/client', () => ({
  callOpenClawSync: vi.fn(),
}))

import { parseConversations } from '../conversation-parser'

describe('parseConversations', () => {
  it('should parse JSON conversations into customer-agent pairs', async () => {
    const json = JSON.stringify([
      { role: 'customer', content: '我的包裹怎么还没到？' },
      { role: 'agent', content: '非常抱歉让您久等了，您的包裹预计明天送达。' },
      { role: 'customer', content: '能退货吗' },
      { role: 'agent', content: '支持7天无理由退货，请在订单详情页申请。' },
    ])
    const pairs = await parseConversations(Buffer.from(json), 'chat.json')
    expect(pairs).toHaveLength(2)
    expect(pairs[0].customer).toBe('我的包裹怎么还没到？')
    expect(pairs[0].agent).toContain('包裹预计明天送达')
  })

  it('should filter out short agent replies (<10 chars)', async () => {
    const json = JSON.stringify([
      { role: 'customer', content: '你好' },
      { role: 'agent', content: '你好' },  // 太短，丢弃
      { role: 'customer', content: '能退货吗' },
      { role: 'agent', content: '支持7天无理由退货，请在订单详情页申请退货。' },
    ])
    const pairs = await parseConversations(Buffer.from(json), 'chat.json')
    expect(pairs).toHaveLength(1)
    expect(pairs[0].customer).toBe('能退货吗')
  })

  it('should deduplicate identical pairs', async () => {
    const json = JSON.stringify([
      { role: 'customer', content: '能退货吗' },
      { role: 'agent', content: '支持7天无理由退货。' },
      { role: 'customer', content: '能退货吗' },
      { role: 'agent', content: '支持7天无理由退货。' },
    ])
    const pairs = await parseConversations(Buffer.from(json), 'chat.json')
    expect(pairs).toHaveLength(1)
  })

  it('should return empty for empty file', async () => {
    const pairs = await parseConversations(Buffer.from(''), 'empty.json')
    expect(pairs).toHaveLength(0)
  })

  it('should parse CSV format conversations', async () => {
    const csv = 'role,content\ncustomer,我要退货\nagent,支持7天无理由退货请在订单详情页申请'
    const pairs = await parseConversations(Buffer.from(csv), 'chat.csv')
    expect(pairs).toHaveLength(1)
  })
})
