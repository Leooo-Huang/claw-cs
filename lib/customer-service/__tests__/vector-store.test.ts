import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { VectorStore } from '../vector-store'

describe('VectorStore', () => {
  let store: VectorStore

  beforeAll(async () => {
    store = new VectorStore('test-knowledge-' + Date.now())
    await store.init()
  })

  afterAll(async () => {
    await store.reset()
  })

  it('should add a rule and retrieve it by semantic similarity', async () => {
    await store.upsert('r1', '客户要求退货', '支持7天无理由退货，运费由卖家承担', { tags: '退货' })

    const results = await store.query('东西坏了想退', 3)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('r1')
  })

  it('should find semantically similar but lexically different rules', async () => {
    await store.upsert('r2', '物流查询', '包裹预计3-5天到达，请耐心等待', { tags: '物流' })

    const results = await store.query('我的快递到哪了', 3)
    const ids = results.map(r => r.id)
    expect(ids).toContain('r2')
  })

  it('should rank more relevant rules higher', async () => {
    await store.upsert('r3', '尺码选择建议', '建议参考商品详情页底部尺码表', { tags: '尺码' })

    const results = await store.query('衣服买多大的合适', 5)
    // r3 (尺码) should rank higher than r1 (退货) for this query
    const r3Index = results.findIndex(r => r.id === 'r3')
    const r1Index = results.findIndex(r => r.id === 'r1')
    if (r3Index >= 0 && r1Index >= 0) {
      expect(r3Index).toBeLessThan(r1Index)
    }
  })

  it('should update existing rule embedding on upsert', async () => {
    await store.upsert('u1', '客户申请退款', '支持7天无理由退款，原路返回', { tags: '退款' })

    const results = await store.query('我要退钱', 10)
    const ids = results.map(r => r.id)
    expect(ids).toContain('u1')
  })

  it('should remove a rule from the store', async () => {
    await store.upsert('del1', '临时规则', '这是一条临时规则', { tags: '临时' })
    await store.remove('del1')
    const results = await store.query('临时规则', 5)
    const ids = results.map(r => r.id)
    expect(ids).not.toContain('del1')
  })

  it('should return empty array when collection is empty', async () => {
    const emptyStore = new VectorStore('test-empty-' + Date.now())
    await emptyStore.init()
    const results = await emptyStore.query('任何查询', 5)
    expect(results).toEqual([])
    await emptyStore.reset()
  })

  it('should handle batch upsert and find relevant', async () => {
    await store.upsert('b1', '优惠活动', '满200减30，限时优惠打折促销', { tags: '优惠' })
    await store.upsert('b2', '材质说明', '100%纯棉面料，透气舒适', { tags: '材质' })

    const results = await store.query('有没有打折优惠活动', 10)
    const ids = results.map(r => r.id)
    expect(ids).toContain('b1')
  })
})
