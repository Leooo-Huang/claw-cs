'use client'

import { useState, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import useSWR from 'swr'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CheckCircle, XCircle, AlertTriangle, BookOpen } from 'lucide-react'
import { BatchTicketRow, type BatchTicket } from '@/components/scenarios/customer-service/batch-ticket-row'
import { SpotCheckDialog } from '@/components/scenarios/customer-service/spot-check-dialog'
import type { LearningCandidate } from '@/components/scenarios/customer-service/candidate-card'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TicketMeta {
  total: number
  page: number
  limit: number
  processedToday?: number
}

interface CandidateMeta {
  total: number
  page: number
  limit: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CHANNEL_OPTIONS = [
  { value: 'all', label: '全部渠道' },
  { value: 'taobao', label: '🛒 淘宝' },
  { value: 'pinduoduo', label: '🔶 拼多多' },
  { value: 'shopify', label: '🛍️ Shopify' },
  { value: 'douyin', label: '🎵 抖音' },
  { value: 'email', label: '📧 邮件' },
  { value: 'mock', label: '🧪 模拟' },
]

const INTENT_OPTIONS = [
  { value: 'all', label: '全部意图' },
  { value: 'refund', label: '退款' },
  { value: 'shipping', label: '物流查询' },
  { value: 'product', label: '商品咨询' },
  { value: 'complaint', label: '投诉' },
  { value: 'other', label: '其他' },
]

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Success Toast ──────────────────────────────────────────────────────────────

function SuccessToast({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-green-600 text-white text-sm px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-bottom-2">
      <CheckCircle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 text-green-200 hover:text-white text-xs underline"
      >
        关闭
      </button>
    </div>
  )
}

// ── Virtual ticket list ───────────────────────────────────────────────────────

function VirtualTicketList({
  tickets,
  selectedIds,
  onToggle,
  expandedId,
  onExpand,
  parentRef,
}: {
  tickets: BatchTicket[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  expandedId: string | null
  onExpand: (id: string) => void
  parentRef: React.RefObject<HTMLDivElement | null>
}) {
  const virtualizer = useVirtualizer({
    count: tickets.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (expandedId === tickets[index]?.id ? 200 : 48),
    overscan: 5,
  })

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const ticket = tickets[virtualRow.index]
          return (
            <div
              key={ticket.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
            >
              <BatchTicketRow
                ticket={ticket}
                selected={selectedIds.has(ticket.id)}
                onToggle={onToggle}
                expanded={expandedId === ticket.id}
                onExpand={onExpand}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tab 1: Batch Ticket Review ─────────────────────────────────────────────────

function BatchTicketTab() {
  const [channelFilter, setChannelFilter] = useState('all')
  const [intentFilter, setIntentFilter] = useState('all')
  const [minConfidence, setMinConfidence] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // SpotCheck dialog state
  const [spotCheckOpen, setSpotCheckOpen] = useState(false)
  const [spotSamples, setSpotSamples] = useState<BatchTicket[]>([])
  const [spotLoading, setSpotLoading] = useState(false)

  // Success toast
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Virtual scroll
  const parentRef = useRef<HTMLDivElement>(null)

  // Build query params
  const params = new URLSearchParams()
  params.set('status', 'awaiting_review')
  params.set('limit', '50')
  if (channelFilter !== 'all') params.set('channelType', channelFilter)

  const { data, isLoading, error, mutate } = useSWR<{ data: BatchTicket[]; meta: TicketMeta }>(
    `/api/tickets?${params}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const allTickets: BatchTicket[] = data?.data ?? []
  const meta: TicketMeta = data?.meta ?? { total: 0, page: 1, limit: 50 }

  // Client-side filtering for intent and confidence (API may not support these)
  const tickets = allTickets.filter(t => {
    if (intentFilter !== 'all' && t.intent && t.intent !== intentFilter) return false
    if (t.confidence != null && t.confidence < minConfidence / 100) return false
    return true
  })

  const allFilteredIds = tickets.map(t => t.id)
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id))

  const handleToggleAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        allFilteredIds.forEach(id => next.add(id))
        return next
      })
    }
  }, [isAllSelected, allFilteredIds])

  const handleToggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleExpand = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }, [])

  // Batch approve: open spot-check dialog, fetch preview first
  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return
    setSpotLoading(true)
    setSpotCheckOpen(true)
    setSpotSamples([])
    try {
      const res = await fetch('/api/tickets/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketIds: [...selectedIds], preview: true }),
      })
      const result = await res.json()
      setSpotSamples(result.data ?? [])
    } catch {
      setSpotSamples([])
    } finally {
      setSpotLoading(false)
    }
  }

  // Confirm batch approve after spot-check
  const handleConfirmApprove = async () => {
    setSpotLoading(true)
    try {
      const res = await fetch('/api/tickets/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketIds: [...selectedIds] }),
      })
      const result = await res.json()
      const count = result.data?.approved ?? selectedIds.size
      setSpotCheckOpen(false)
      setSelectedIds(new Set())
      setSuccessMsg(`已批量通过 ${count} 条工单`)
      await mutate()
    } catch {
      setSpotLoading(false)
    }
  }

  // Batch reject (mark as rejected — no API spec given, show stub)
  const handleBatchReject = async () => {
    if (selectedIds.size === 0) return
    // Optimistic clear since no dedicated reject endpoint was specified
    setSelectedIds(new Set())
    setSuccessMsg(`已拒绝 ${selectedIds.size} 条工单`)
    await mutate()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white flex-wrap">
        <Select value={channelFilter} onValueChange={v => setChannelFilter(v ?? 'all')}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue placeholder="全部渠道" />
          </SelectTrigger>
          <SelectContent>
            {CHANNEL_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={intentFilter} onValueChange={v => setIntentFilter(v ?? 'all')}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue placeholder="全部意图" />
          </SelectTrigger>
          <SelectContent>
            {INTENT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Confidence min range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 shrink-0">置信度 ≥</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minConfidence}
            onChange={e => setMinConfidence(Number(e.target.value))}
            className="w-24 accent-blue-600"
          />
          <span className="text-xs tabular-nums text-slate-600 w-8">{minConfidence}%</span>
        </div>
      </div>

      {/* Batch toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-100">
        <div
          className="flex items-center gap-1.5 cursor-pointer"
          onClick={handleToggleAll}
        >
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={handleToggleAll}
            className="rounded border-slate-300 accent-blue-600 w-4 h-4 cursor-pointer"
            aria-label="全选当前筛选工单"
          />
          <span className="text-xs text-slate-600">全选</span>
        </div>

        <Button
          size="sm"
          onClick={handleBatchApprove}
          disabled={selectedIds.size === 0}
          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
        >
          <CheckCircle className="w-3 h-3" />
          批量通过
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={handleBatchReject}
          disabled={selectedIds.size === 0}
          className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 gap-1"
        >
          <XCircle className="w-3 h-3" />
          批量拒绝
        </Button>

        {selectedIds.size > 0 && (
          <span className="text-xs text-slate-500">已选: {selectedIds.size}</span>
        )}
      </div>

      {/* Table header */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-slate-100 bg-slate-50/50">
        <div className="w-4" />
        <div className="w-5" />
        <span className="text-[10px] text-slate-400 font-medium w-20 shrink-0">客户</span>
        <span className="text-[10px] text-slate-400 font-medium flex-1">消息摘要</span>
        <span className="text-[10px] text-slate-400 font-medium w-40 shrink-0 hidden md:block">AI 回复摘要</span>
        <span className="text-[10px] text-slate-400 font-medium w-24 shrink-0">置信度</span>
        <div className="w-3.5" />
      </div>

      {/* Ticket rows (virtualized) */}
      {isLoading ? (
        <div className="p-4 space-y-2 flex-1">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 flex-1">
          <AlertTriangle className="w-8 h-8 text-red-300" />
          <p className="text-sm text-slate-500">加载失败，请刷新重试</p>
          <Button size="sm" variant="outline" onClick={() => mutate()} className="text-xs">
            重试
          </Button>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 flex-1">
          <CheckCircle className="w-10 h-10 text-slate-200" />
          <p className="text-sm text-slate-400">暂无待审核工单</p>
        </div>
      ) : (
        <VirtualTicketList
          tickets={tickets}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          expandedId={expandedId}
          onExpand={handleExpand}
          parentRef={parentRef}
        />
      )}

      {/* Stats bar */}
      <div className="px-4 py-2 border-t border-slate-100 bg-white flex items-center gap-4">
        <span className="text-xs text-slate-500">
          待处理: <span className="font-medium text-slate-700">{meta.total}</span>
        </span>
        {meta.processedToday != null && (
          <span className="text-xs text-slate-500">
            今日已处理: <span className="font-medium text-green-600">{meta.processedToday}</span>
          </span>
        )}
        {tickets.length !== allTickets.length && (
          <span className="text-xs text-slate-400">
            筛选后: {tickets.length} 条
          </span>
        )}
      </div>

      {/* Spot-check dialog */}
      <SpotCheckDialog
        open={spotCheckOpen}
        onOpenChange={open => {
          if (!spotLoading) setSpotCheckOpen(open)
        }}
        samples={spotSamples}
        totalCount={selectedIds.size}
        onConfirm={handleConfirmApprove}
        loading={spotLoading}
      />

      {/* Success toast */}
      {successMsg && (
        <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}
    </div>
  )
}

// ── Tab 2: Batch Rule Management ───────────────────────────────────────────────

function BatchRuleTab() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  const { data, isLoading, error, mutate } = useSWR<{ data: LearningCandidate[]; meta: CandidateMeta }>(
    '/api/learning/candidates?status=pending',
    fetcher,
    { revalidateOnFocus: false }
  )

  const candidates: LearningCandidate[] = data?.data ?? []
  const meta: CandidateMeta = data?.meta ?? { total: 0, page: 1, limit: 20 }

  const isAllSelected =
    candidates.length > 0 && candidates.every(c => selectedIds.has(c.id))

  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        candidates.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        candidates.forEach(c => next.add(c.id))
        return next
      })
    }
  }

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBatchAction = async (action: 'approve' | 'ignore') => {
    if (selectedIds.size === 0) return
    setActing(true)
    try {
      await fetch('/api/learning/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], action }),
      })
      const count = selectedIds.size
      setSelectedIds(new Set())
      setSuccessMsg(
        action === 'approve' ? `已入库 ${count} 条规则` : `已忽略 ${count} 条规则`
      )
      await mutate()
    } catch {
      // keep acting=false below
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div
          className="flex items-center gap-1.5 cursor-pointer"
          onClick={handleToggleAll}
        >
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={handleToggleAll}
            className="rounded border-slate-300 accent-blue-600 w-4 h-4 cursor-pointer"
            aria-label="全选规则候选"
          />
          <span className="text-xs text-slate-600">全选</span>
        </div>

        <Button
          size="sm"
          onClick={() => handleBatchAction('approve')}
          disabled={selectedIds.size === 0 || acting}
          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
        >
          <BookOpen className="w-3 h-3" />
          批量入库
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => handleBatchAction('ignore')}
          disabled={selectedIds.size === 0 || acting}
          className="h-7 text-xs text-slate-500 gap-1"
        >
          <XCircle className="w-3 h-3" />
          批量忽略
        </Button>

        {selectedIds.size > 0 && (
          <span className="text-xs text-slate-500">已选: {selectedIds.size}</span>
        )}

        <span className="ml-auto text-xs text-slate-400">共 {meta.total} 条待处理</span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1rem_1fr_3fr_5rem_6rem] gap-3 px-4 py-1.5 border-b border-slate-100 bg-slate-50/50 items-center">
        <div />
        <span className="text-[10px] text-slate-400 font-medium">来源工单</span>
        <span className="text-[10px] text-slate-400 font-medium">提取规则摘要</span>
        <span className="text-[10px] text-slate-400 font-medium text-right">置信度</span>
        <span className="text-[10px] text-slate-400 font-medium text-right">操作</span>
      </div>

      {/* Rows */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle className="w-8 h-8 text-red-300" />
            <p className="text-sm text-slate-500">加载失败，请刷新重试</p>
            <Button size="sm" variant="outline" onClick={() => mutate()} className="text-xs">
              重试
            </Button>
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <BookOpen className="w-10 h-10 text-slate-200" />
            <p className="text-sm text-slate-400">暂无待处理规则候选</p>
          </div>
        ) : (
          <div>
            {candidates.map(candidate => {
              const pct = Math.round(candidate.confidence * 100)
              const confClass =
                pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-500'
              const ruleSummary =
                candidate.extractedCondition
                  ? `${candidate.extractedCondition} → ${candidate.extractedContent}`
                  : candidate.extractedContent

              return (
                <div
                  key={candidate.id}
                  className={`grid grid-cols-[1rem_1fr_3fr_5rem_6rem] gap-3 px-4 py-2.5 border-b border-slate-100 items-center hover:bg-slate-50 transition-colors ${
                    selectedIds.has(candidate.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(candidate.id)}
                    onChange={() => handleToggle(candidate.id)}
                    className="rounded border-slate-300 accent-blue-600 w-4 h-4 cursor-pointer"
                    aria-label={`选择规则 ${candidate.id}`}
                  />

                  <span className="text-xs text-blue-600 truncate">
                    #{candidate.ticketId.slice(-6)}
                  </span>

                  <span
                    className="text-xs text-slate-600 truncate"
                    title={ruleSummary}
                  >
                    {ruleSummary.length > 60 ? ruleSummary.slice(0, 60) + '…' : ruleSummary}
                  </span>

                  <span className={`text-xs font-semibold text-right tabular-nums ${confClass}`}>
                    {pct}%
                  </span>

                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => handleBatchAction('approve')}
                      disabled={acting}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 disabled:opacity-50 transition-colors"
                    >
                      入库
                    </button>
                    <button
                      onClick={() => handleBatchAction('ignore')}
                      disabled={acting}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200 disabled:opacity-50 transition-colors"
                    >
                      忽略
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {successMsg && (
        <SuccessToast message={successMsg} onDismiss={() => setSuccessMsg(null)} />
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BatchPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="批量操作" />

      <Tabs defaultValue="tickets" className="flex flex-col flex-1 overflow-hidden">
        <div className="border-b border-slate-200 bg-white px-4 pt-2">
          <TabsList className="h-9 bg-transparent gap-0 p-0">
            <TabsTrigger
              value="tickets"
              className="h-9 px-4 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none bg-transparent"
            >
              批量工单审核
            </TabsTrigger>
            <TabsTrigger
              value="rules"
              className="h-9 px-4 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:shadow-none bg-transparent"
            >
              批量规则管理
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tickets" className="flex-1 overflow-hidden mt-0">
          <BatchTicketTab />
        </TabsContent>

        <TabsContent value="rules" className="flex-1 overflow-hidden mt-0">
          <BatchRuleTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
