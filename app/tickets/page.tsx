'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, Plus, Radio } from 'lucide-react'
import Link from 'next/link'
import { TicketList } from '@/components/scenarios/customer-service/ticket-list'
import { TicketDetail } from '@/components/scenarios/customer-service/ticket-detail'
import { CustomerContext } from '@/components/scenarios/customer-service/customer-context'
import { LearningToast } from '@/components/scenarios/customer-service/learning-toast'
import { notify } from '@/lib/notification'

interface Channel {
  id: string
  name: string
  type: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function CustomerServicePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [learningToastVisible, setLearningToastVisible] = useState(false)
  const [pollingChannelId, setPollingChannelId] = useState<string | null>(null)
  const [pollMessage, setPollMessage] = useState<string | null>(null)

  const { data: channelData, isLoading: channelsLoading } = useSWR('/api/channels', fetcher, {
    revalidateOnFocus: false,
  })

  const { data: ticketData } = useSWR(
    '/api/tickets?limit=1',
    fetcher,
    { revalidateOnFocus: false }
  )

  const channels: Channel[] = channelData?.data || []
  const hasTickets = (ticketData?.meta?.total ?? 0) > 0

  const handleLearningDetected = useCallback(() => {
    setLearningToastVisible(true)
  }, [])

  const handleLearn = useCallback(() => {
    // Backend already created the candidate; just close the toast
    setLearningToastVisible(false)
  }, [])

  const handleSkip = useCallback(() => {
    setLearningToastVisible(false)
  }, [])

  // Poll for learning candidate status changes
  const lastCandidateCount = useRef<number | null>(null)

  useEffect(() => {
    if (channels.length === 0) return

    const pollCandidates = async () => {
      try {
        const res = await fetch('/api/learning/candidates?status=pending')
        if (!res.ok) return
        const json = await res.json()
        const count = json.meta?.total ?? json.data?.length ?? 0

        if (lastCandidateCount.current !== null && count < lastCandidateCount.current) {
          // Count decreased = some candidates were processed (classified as cosmetic/ignored)
          const processed = lastCandidateCount.current - count
          notify.success(`AI 已完成 ${processed} 条修改的分析`)
        }
        lastCandidateCount.current = count
      } catch {
        // Silently ignore polling errors
      }
    }

    // Initial fetch
    pollCandidates()
    const interval = setInterval(pollCandidates, 10000)
    return () => clearInterval(interval)
  }, [channels.length])

  const handlePollMessages = async (channelId: string) => {
    setPollingChannelId(channelId)
    setPollMessage(null)
    try {
      const res = await fetch(`/api/channels/${channelId}/poll`, { method: 'POST' })
      const result = await res.json()
      const count = result.data?.messagesReceived ?? 0
      setPollMessage(count > 0 ? `收到 ${count} 条新消息` : '暂无新消息')
    } catch {
      setPollMessage('拉取失败，请重试')
    } finally {
      setPollingChannelId(null)
    }
  }

  // Loading state
  if (channelsLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="工单中心" />
        <div className="flex-1 flex items-center justify-center">
          <div className="space-y-3 w-64">
            <Skeleton className="h-4 w-48 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  // First-time guide: no channels connected
  if (channels.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <Header title="工单中心" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm px-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-2">连接第一个渠道</h2>
            <p className="text-sm text-slate-500 mb-6">
              连接您的销售渠道（淘宝、拼多多、Shopify 等），系统将自动接收客户消息并生成 AI 回复草稿。
            </p>
            <Link href="/scenarios/customer-service/channels">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                连接渠道
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Channels exist but no tickets yet
  if (!hasTickets && ticketData !== undefined) {
    const mockChannel = channels.find(ch => ch.type === 'mock') || channels[0]

    return (
      <div className="flex flex-col h-full">
        <Header title="工单中心" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm px-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-slate-300" />
            </div>
            <h2 className="text-base font-semibold text-slate-700 mb-2">暂无待处理工单</h2>
            <p className="text-sm text-slate-400 mb-6">
              渠道已连接，等待客户消息到达。您也可以拉取一批模拟消息来测试系统。
            </p>
            {pollMessage && (
              <p className="text-sm text-slate-500 mb-3">{pollMessage}</p>
            )}
            <Button
              variant="outline"
              onClick={() => handlePollMessages(mockChannel.id)}
              disabled={pollingChannelId === mockChannel.id}
            >
              <Radio className="w-4 h-4 mr-2" />
              {pollingChannelId === mockChannel.id ? '拉取中...' : '拉取模拟消息'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Normal 3-column layout
  return (
    <div className="flex flex-col h-full">
      <Header title="工单中心" />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: ticket list */}
        <TicketList selectedId={selectedId} onSelect={setSelectedId} />

        {/* Center: conversation / detail */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">选择一条工单查看详情</p>
              </div>
            </div>
          ) : (
            <TicketDetail
              key={selectedId}
              ticketId={selectedId}
              onLearningDetected={handleLearningDetected}
            />
          )}
        </div>

        {/* Right: context panel */}
        {selectedId && (
          <ContextPanelWrapper ticketId={selectedId} />
        )}
      </div>

      {/* Learning toast */}
      <LearningToast
        visible={learningToastVisible}
        onLearn={handleLearn}
        onSkip={handleSkip}
      />
    </div>
  )
}

// Thin wrapper that fetches ticket data for the context panel
function ContextPanelWrapper({ ticketId }: { ticketId: string }) {
  const fetcher = (url: string) => fetch(url).then(r => r.json())
  const { data } = useSWR(`/api/tickets/${ticketId}`, fetcher, { revalidateOnFocus: false })
  const ticket = data?.data

  if (!ticket) return <div className="w-72 border-l border-slate-200 bg-white" />

  return (
    <div className="w-72 border-l border-slate-200 bg-white">
      <CustomerContext ticket={ticket} />
    </div>
  )
}
