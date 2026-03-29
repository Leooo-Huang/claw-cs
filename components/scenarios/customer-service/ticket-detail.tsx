'use client'

import useSWR, { useSWRConfig } from 'swr'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, User, Search, Brain, FileText, CheckCircle, Loader2 } from 'lucide-react'
import { AiDraftEditor } from './ai-draft-editor'
import { notify } from '@/lib/notification'
import { useState, useEffect } from 'react'

/**
 * AI 生成过程分步展示 — 真实反映后端状态
 * pending = 等待处理 → ai_drafting = 正在生成
 */
function AiGeneratingSteps({ status }: { status: string }) {
  const [step, setStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    // 计时器：每秒更新
    const timer = setInterval(() => setElapsed(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (status === 'pending') {
      setStep(0)
      const t1 = setTimeout(() => setStep(1), 1500)
      return () => clearTimeout(t1)
    }
    if (status === 'ai_drafting') {
      setStep(2)
      const t2 = setTimeout(() => setStep(3), 2000)
      return () => clearTimeout(t2)
    }
  }, [status])

  const isTimeout = elapsed > 120 // 2 分钟超时

  const steps = [
    { label: '理解客户意图...', icon: Brain, done: step > 0 },
    { label: '检索知识库（文档 + 话术）...', icon: Search, done: step > 1 },
    { label: 'AI 生成回复草稿...', icon: FileText, done: step > 2 },
    { label: '完成', icon: CheckCircle, done: step > 3 },
  ]

  return (
    <div className="bg-blue-50 border border-blue-100 border-l-4 border-l-blue-400 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-blue-700">AI 正在处理工单</p>
        <span className="text-[10px] text-slate-400 tabular-nums">{elapsed}s</span>
      </div>
      {isTimeout && (
        <p className="text-xs text-amber-600 mb-2">处理时间较长，正在等待 AI 回复（后台会自动超时 fallback）...</p>
      )}
      {steps.map((s, i) => {
        const Icon = s.icon
        const isActive = i === step
        const isDone = s.done

        if (i > step + 1) return null // 不显示还没到的步骤

        return (
          <div key={i} className="flex items-center gap-2">
            {isDone ? (
              <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
            ) : isActive ? (
              <Loader2 className="w-3.5 h-3.5 text-blue-500 shrink-0 animate-spin" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
            )}
            <span className={`text-xs ${isDone ? 'text-green-600' : isActive ? 'text-blue-600 font-medium' : 'text-slate-400'}`}>
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const CHANNEL_EMOJIS: Record<string, string> = {
  taobao: '🛒',
  pinduoduo: '🔶',
  shopify: '🛍️',
  douyin: '🎵',
  email: '📧',
  mock: '🧪',
}

const SENTIMENT_BADGE: Record<string, { label: string; className: string }> = {
  '不满': { label: '不满', className: 'bg-red-100 text-red-700 border-red-200' },
  '愤怒': { label: '愤怒', className: 'bg-red-100 text-red-700 border-red-200' },
  '中性': { label: '中性', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  '平和': { label: '平和', className: 'bg-blue-100 text-blue-600 border-blue-200' },
  '积极': { label: '积极', className: 'bg-green-100 text-green-700 border-green-200' },
}

interface TicketDetailData {
  id: string
  customerName: string
  customerMessage: string
  channelType: string
  orderId: string | null
  status: string
  intent: string | null
  sentiment: string | null
  aiReply: string | null
  aiReasoning: string | null
  aiConfidence: number | null
  aiSearchMeta: string | null
  citedRuleIds: string[]
  citedRules: Array<{ id: string; condition: string; content: string; tags: string[] }>
  channel?: { name: string; type: string }
}

interface TicketDetailProps {
  ticketId: string
  onLearningDetected: (candidateId: string) => void
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function TicketDetail({ ticketId, onLearningDetected }: TicketDetailProps) {
  const { mutate: globalMutate } = useSWRConfig()

  const { data, error, isLoading, mutate } = useSWR(
    `/api/tickets/${ticketId}`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 0 }
  )

  const ticket: TicketDetailData | undefined = data?.data
  const isGenerating = ticket?.status === 'pending' || ticket?.status === 'ai_drafting'

  // Auto-poll every 3s while AI is generating — update main SWR when status changes
  useSWR(
    isGenerating ? `/api/tickets/${ticketId}?poll=1` : null,
    (url: string) => fetch(url.replace('?poll=1', '')).then(r => r.json()),
    {
      refreshInterval: 3000,
      onSuccess: (newData) => {
        const newStatus = newData?.data?.status
        if (newStatus && newStatus !== 'pending' && newStatus !== 'ai_drafting') {
          // AI finished (awaiting_review or fallback) — update main SWR
          mutate(newData, false)
        }
      },
    }
  )

  const handleApprove = async () => {
    await fetch(`/api/tickets/${ticketId}/approve`, { method: 'POST' })
    await mutate()
    // Invalidate ticket list
    globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/tickets?'), undefined, { revalidate: true })
  }

  const handleEditSend = async (editedReply: string) => {
    const res = await fetch(`/api/tickets/${ticketId}/edit-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editedReply }),
    })
    const result = await res.json()
    await mutate()
    globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/tickets?'), undefined, { revalidate: true })

    if (result.data?.learning?.isSemanticChange) {
      onLearningDetected(result.data.learning.candidateId)
      // 延迟通知（给后台 AI 分类时间）
      setTimeout(() => {
        notify.info('AI 正在分析修改内容，完成后将通知您')
      }, 3000)
    }
  }

  const handleReject = async () => {
    await fetch(`/api/tickets/${ticketId}/reject`, { method: 'POST' })
    await mutate()
    globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/tickets?'), undefined, { revalidate: true })
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-slate-400">加载工单详情失败</p>
        <Button size="sm" variant="outline" onClick={() => mutate()}>重试</Button>
      </div>
    )
  }

  const channelType = ticket.channelType || ticket.channel?.type || 'mock'
  const channelEmoji = CHANNEL_EMOJIS[channelType] || '📦'
  const sentimentInfo = ticket.sentiment ? SENTIMENT_BADGE[ticket.sentiment] : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
        <span className="text-sm font-medium text-slate-700">{ticket.customerName}</span>
        {ticket.intent && (
          <Badge variant="outline" className="text-xs">
            {ticket.intent}
          </Badge>
        )}
        {sentimentInfo && (
          <Badge variant="outline" className={`text-xs ${sentimentInfo.className}`}>
            {sentimentInfo.label}
          </Badge>
        )}
        <span className="ml-auto text-base" title={channelType}>{channelEmoji}</span>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Customer message bubble */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <div className="max-w-[80%]">
            <p className="text-xs text-slate-400 mb-1">{ticket.customerName}</p>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <p className="text-sm text-slate-700">{ticket.customerMessage}</p>
            </div>
          </div>
        </div>

        {/* AI draft or replied state */}
        {ticket.status === 'replied' ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <p className="text-sm text-green-700">回复已发送给客户</p>
          </div>
        ) : ticket.status === 'failed' ? (
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700">处理失败，请重试</p>
          </div>
        ) : ticket.status === 'awaiting_review' ? (
          <AiDraftEditor
            ticket={ticket}
            onApprove={handleApprove}
            onEditSend={handleEditSend}
            onReject={handleReject}
          />
        ) : (ticket.status === 'pending' || ticket.status === 'ai_drafting') ? (
          <AiGeneratingSteps status={ticket.status} />
        ) : null}
      </div>
    </div>
  )
}
