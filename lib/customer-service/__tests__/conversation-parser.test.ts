import { describe, it, expect } from 'vitest'
import { parseConversations } from '../conversation-parser'

describe('parseConversations', () => {
  it('should parse JSON format conversations', async () => {
    const json = JSON.stringify([
      { role: 'customer', content: '我想退货' },
      { role: 'agent', content: '好的，我们支持7天无理由退货，请提供订单号' },
      { role: 'customer', content: '快递到哪了' },
      { role: 'agent', content: '您的包裹预计明天到达' },
    ])
    const buffer = Buffer.from(json, 'utf-8')
    const pairs = await parseConversations(buffer, 'chat.json')

    expect(pairs.length).toBe(2)
    expect(pairs[0].customer).toBe('我想退货')
    expect(pairs[0].agent).toBe('好的，我们支持7天无理由退货，请提供订单号')
    expect(pairs[1].customer).toBe('快递到哪了')
  })

  it('should parse CSV format conversations', async () => {
    const csv = 'role,content\ncustomer,我要退款\nagent,好的马上为您处理退款请耐心等待\ncustomer,物流太慢了\nagent,抱歉让您久等了您的包裹预计明天到达'
    const buffer = Buffer.from(csv, 'utf-8')
    const pairs = await parseConversations(buffer, 'chat.csv')

    expect(pairs.length).toBe(2)
    expect(pairs[0].customer).toBe('我要退款')
    expect(pairs[0].agent).toContain('退款')
  })

  it('should discard agent replies shorter than 10 characters', async () => {
    const json = JSON.stringify([
      { role: 'customer', content: '我想退货' },
      { role: 'agent', content: '好的' }, // too short
      { role: 'customer', content: '快递到哪了' },
      { role: 'agent', content: '您的包裹预计明天到达，请耐心等待' },
    ])
    const buffer = Buffer.from(json, 'utf-8')
    const pairs = await parseConversations(buffer, 'chat.json')

    expect(pairs.length).toBe(1)
    expect(pairs[0].customer).toBe('快递到哪了')
  })

  it('should deduplicate identical pairs', async () => {
    const json = JSON.stringify([
      { role: 'customer', content: '我想退货' },
      { role: 'agent', content: '好的，我们支持7天无理由退货，请提供订单号' },
      { role: 'customer', content: '我想退货' },
      { role: 'agent', content: '好的，我们支持7天无理由退货，请提供订单号' },
    ])
    const buffer = Buffer.from(json, 'utf-8')
    const pairs = await parseConversations(buffer, 'chat.json')

    expect(pairs.length).toBe(1)
  })

  it('should handle empty input', async () => {
    const buffer = Buffer.from('[]', 'utf-8')
    const pairs = await parseConversations(buffer, 'chat.json')
    expect(pairs).toEqual([])
  })

  it('should handle unpaired messages (customer without agent reply)', async () => {
    const json = JSON.stringify([
      { role: 'customer', content: '我想退货' },
      { role: 'customer', content: '快递到哪了' },
      { role: 'agent', content: '您的包裹预计明天到达，请耐心等待' },
    ])
    const buffer = Buffer.from(json, 'utf-8')
    const pairs = await parseConversations(buffer, 'chat.json')

    // Only the customer-agent pair should be matched
    expect(pairs.length).toBe(1)
    expect(pairs[0].customer).toBe('快递到哪了')
  })
})
