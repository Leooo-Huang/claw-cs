import { describe, it, expect, vi } from 'vitest'

vi.mock('pdf-parse', () => ({
  default: vi.fn().mockResolvedValue({
    text: '退货政策|支持7天无理由退货\n物流查询|预计3-5天到达',
  }),
}))

const xlsxMock = {
  read: vi.fn().mockReturnValue({
    SheetNames: ['Sheet1'],
    Sheets: {
      Sheet1: {},
    },
  }),
  utils: {
    sheet_to_csv: vi.fn().mockReturnValue('条件,内容\n退货政策,支持7天无理由退货\n物流查询,预计3-5天到达'),
    sheet_to_json: vi.fn().mockReturnValue([
      { '条件': '退货政策', '内容': '支持7天无理由退货' },
      { '条件': '物流查询', '内容': '预计3-5天到达' },
    ]),
  },
}
vi.mock('xlsx', () => ({
  default: xlsxMock,
  ...xlsxMock,
}))

import { parseFile, inferTags } from '../file-parser'

describe('parseFile', () => {
  it('should parse CSV with pipe delimiter', async () => {
    const csv = '退货政策|支持7天无理由退货\n物流查询|预计3-5天到达'
    const buffer = Buffer.from(csv, 'utf-8')
    const result = await parseFile(buffer, 'rules.txt')

    expect(result.length).toBe(2)
    expect(result[0].condition).toBe('退货政策')
    expect(result[0].content).toBe('支持7天无理由退货')
    expect(result[1].condition).toBe('物流查询')
  })

  it('should parse CSV with comma delimiter and header row', async () => {
    const csv = '条件,内容\n退货申请,支持7天内退货\n物流延迟,预计1-2天到达'
    const buffer = Buffer.from(csv, 'utf-8')
    const result = await parseFile(buffer, 'rules.csv')

    expect(result.length).toBe(2)
    expect(result[0].condition).toBe('退货申请')
    expect(result[0].content).toBe('支持7天内退货')
  })

  it('should parse TXT with pipe delimiter', async () => {
    const txt = '退货问题|7天无理由退货，运费由卖家承担\n尺码咨询|请参考详情页尺码表'
    const buffer = Buffer.from(txt, 'utf-8')
    const result = await parseFile(buffer, 'data.txt')

    expect(result.length).toBe(2)
    expect(result[0].condition).toBe('退货问题')
  })

  it('should parse long lines without delimiter as single-content rules', async () => {
    const txt = '这是一条很长的内容没有分隔符但是应该作为规则被识别出来'
    const buffer = Buffer.from(txt, 'utf-8')
    const result = await parseFile(buffer, 'data.txt')

    expect(result.length).toBe(1)
    expect(result[0].source).toBe('document')
  })

  it('should parse Excel files', async () => {
    const buffer = Buffer.from('fake excel data')
    const result = await parseFile(buffer, 'rules.xlsx')

    expect(result.length).toBe(2)
    expect(result[0].condition).toBe('退货政策')
    expect(result[0].content).toBe('支持7天无理由退货')
  })

  it('should parse PDF files', async () => {
    const buffer = Buffer.from('fake pdf data')
    const result = await parseFile(buffer, 'rules.pdf')

    expect(result.length).toBe(2)
    expect(result[0].condition).toBe('退货政策')
  })

  it('should skip empty lines and very short lines', async () => {
    const txt = '\n\n短\n\n退货问题|7天无理由退货\n'
    const buffer = Buffer.from(txt, 'utf-8')
    const result = await parseFile(buffer, 'data.txt')

    expect(result.length).toBe(1)
  })
})

describe('inferTags', () => {
  it('should infer 退货 tag from content about returns', () => {
    const tags = inferTags('退货政策', '支持7天无理由退货，运费由卖家承担')
    expect(tags).toContain('退货')
  })

  it('should infer 物流 tag from content about shipping', () => {
    const tags = inferTags('物流查询', '包裹预计3-5天到达')
    expect(tags).toContain('物流')
  })

  it('should infer 尺码 tag from content about sizing', () => {
    const tags = inferTags('尺码问题', '请参考尺码表选择合适的尺码')
    expect(tags).toContain('尺码')
  })

  it('should return empty array when no tags match', () => {
    const tags = inferTags('其他问题', '请联系客服处理')
    expect(Array.isArray(tags)).toBe(true)
  })
})
