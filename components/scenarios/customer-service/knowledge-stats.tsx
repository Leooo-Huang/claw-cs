'use client'

import { useEffect, useState } from 'react'

interface KnowledgeStats {
  total: number
  active: number
  pending: number
  deprecated: number
  weekNew: number
}

export function KnowledgeStats() {
  const [stats, setStats] = useState<KnowledgeStats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchStats() {
      try {
        const res = await fetch('/api/knowledge/stats')
        if (!res.ok) throw new Error('failed')
        const json = await res.json()
        if (!cancelled) setStats(json.data)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (error) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 min-w-[180px]">
      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">知识库统计</p>
      {stats === null ? (
        <div className="space-y-1.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3.5 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">活跃</span>
            <span className="font-semibold text-green-600">{stats.active}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">待审</span>
            <span className="font-semibold text-orange-500">{stats.pending}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">废弃</span>
            <span className="font-semibold text-slate-400">{stats.deprecated}</span>
          </div>
          <div className="flex justify-between gap-4 pt-1 border-t border-slate-100 mt-1">
            <span className="text-slate-400">本周新增</span>
            <span className="font-semibold text-blue-600">+{stats.weekNew}</span>
          </div>
        </div>
      )}
    </div>
  )
}
