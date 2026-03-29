'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { MessageSquare, Search, Radio } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

const CHANNEL_EMOJIS: Record<string, string> = {
  taobao: '🛒',
  pinduoduo: '🔶',
  shopify: '🛍️',
  douyin: '🎵',
  email: '📧',
  mock: '🧪',
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-orange-400',
  ai_drafting: 'bg-blue-400',
  awaiting_review: 'bg-orange-400',
  replied: 'bg-green-400',
  failed: 'bg-red-400',
}

interface Ticket {
  id: string
  customerName: string
  customerMessage: string
  status: string
  channelType: string
  createdAt: string
  channel?: { name: string; type: string }
}

interface Channel {
  id: string
  name: string
  type: string
}

interface TicketListProps {
  selectedId: string | null
  onSelect: (id: string) => void
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function TicketList({ selectedId, onSelect }: TicketListProps) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [polling, setPolling] = useState(false)

  const params = new URLSearchParams()
  if (statusFilter !== 'all') params.set('status', statusFilter)
  if (channelFilter !== 'all') params.set('channelType', channelFilter)
  if (search) params.set('search', search)

  const { data: ticketData, isLoading: ticketsLoading, mutate: mutateTickets } = useSWR(
    `/api/tickets?${params}`,
    fetcher,
    { refreshInterval: 10000 }
  )

  const { data: channelData } = useSWR('/api/channels', fetcher)

  const handlePoll = async () => {
    const mockChannel = (channelData?.data || []).find((ch: Channel) => ch.type === 'mock')
    if (!mockChannel) return
    setPolling(true)
    try {
      await fetch(`/api/channels/${mockChannel.id}/poll`, { method: 'POST' })
      await mutateTickets()
    } finally {
      setPolling(false)
    }
  }

  const tickets: Ticket[] = ticketData?.data || []
  const channels: Channel[] = channelData?.data || []
  const meta = ticketData?.meta || {}

  const pendingCount = tickets.filter(t => t.status === 'awaiting_review' || t.status === 'pending').length

  return (
    <div className="w-80 border-r border-slate-200 flex flex-col bg-white">
      {/* Filters header */}
      <div className="p-3 border-b border-slate-100 space-y-2">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-7 w-full">
            <TabsTrigger value="all" className="flex-1 text-xs">全部</TabsTrigger>
            <TabsTrigger value="awaiting_review" className="flex-1 text-xs relative">
              待回复
              {pendingCount > 0 && statusFilter !== 'awaiting_review' && (
                <span className="ml-1 bg-orange-500 text-white text-[10px] rounded-full w-4 h-4 inline-flex items-center justify-center leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="replied" className="flex-1 text-xs">已回复</TabsTrigger>
          </TabsList>
        </Tabs>

        {channels.length > 0 && (
          <Select value={channelFilter} onValueChange={v => setChannelFilter(v ?? 'all')}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="所有渠道" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有渠道</SelectItem>
              {channels.map(ch => (
                <SelectItem key={ch.id} value={ch.type}>
                  {CHANNEL_EMOJIS[ch.type] || '📦'} {ch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索工单..."
            className="h-7 pl-6 text-xs"
          />
        </div>
      </div>

      {/* Ticket list */}
      <ScrollArea className="flex-1">
        {ticketsLoading ? (
          <div className="p-3 space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageSquare className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">暂无工单</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {tickets.map(ticket => {
              const isSelected = selectedId === ticket.id
              const isPending = ticket.status === 'awaiting_review' || ticket.status === 'pending'
              const channelType = ticket.channelType || ticket.channel?.type || 'mock'
              const emoji = CHANNEL_EMOJIS[channelType] || '📦'
              const dotColor = STATUS_DOT[ticket.status] || 'bg-slate-300'

              return (
                <div
                  key={ticket.id}
                  onClick={() => onSelect(ticket.id)}
                  className={`relative p-3 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border border-blue-100'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  {/* Unread left bar */}
                  {isPending && !isSelected && (
                    <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-blue-500 rounded-full" />
                  )}

                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0 text-base">
                      {emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-slate-700 truncate">
                          {ticket.customerName}
                        </span>
                        <div className={`w-2 h-2 rounded-full shrink-0 ml-1 ${dotColor}`} />
                      </div>
                      <p className="text-xs text-slate-400 truncate">{ticket.customerMessage}</p>
                      <p className="text-[10px] text-slate-300 mt-1">
                        {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: zhCN })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between">
        {meta.total > 0 && (
          <span className="text-[10px] text-slate-400">共 {meta.total} 条工单</span>
        )}
        {channels.some((ch: Channel) => ch.type === 'mock') && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] text-slate-400 hover:text-blue-600 gap-1 ml-auto"
            onClick={handlePoll}
            disabled={polling}
          >
            <Radio className="w-3 h-3" />
            {polling ? '拉取中...' : '拉取消息'}
          </Button>
        )}
      </div>
    </div>
  )
}
