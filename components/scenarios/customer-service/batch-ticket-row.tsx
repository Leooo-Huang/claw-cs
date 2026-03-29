'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

const CHANNEL_EMOJIS: Record<string, string> = {
  taobao: '🛒',
  pinduoduo: '🔶',
  shopify: '🛍️',
  douyin: '🎵',
  email: '📧',
  mock: '🧪',
}

export interface BatchTicket {
  id: string
  customerName: string
  customerMessage: string
  aiReply?: string
  channelType: string
  confidence?: number
  intent?: string
  createdAt: string
  status: string
}

interface BatchTicketRowProps {
  ticket: BatchTicket
  selected: boolean
  onToggle: (id: string) => void
  expanded: boolean
  onExpand: (id: string) => void
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const colorClass =
    pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-500'
  const textClass =
    pct >= 90 ? 'text-green-600' : pct >= 70 ? 'text-yellow-600' : 'text-red-500'

  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-medium tabular-nums shrink-0 ${textClass}`}>
        {pct}%
      </span>
    </div>
  )
}

export function BatchTicketRow({
  ticket,
  selected,
  onToggle,
  expanded,
  onExpand,
}: BatchTicketRowProps) {
  const channelEmoji = CHANNEL_EMOJIS[ticket.channelType] || '📦'
  const confidence = ticket.confidence ?? 0
  const msgPreview =
    ticket.customerMessage.length > 40
      ? ticket.customerMessage.slice(0, 40) + '…'
      : ticket.customerMessage
  const replyPreview = ticket.aiReply
    ? ticket.aiReply.length > 50
      ? ticket.aiReply.slice(0, 50) + '…'
      : ticket.aiReply
    : '—'

  return (
    <div className="border-b border-slate-100 last:border-0">
      {/* Compact row */}
      <div
        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none ${
          selected ? 'bg-blue-50' : 'hover:bg-slate-50'
        }`}
        onClick={() => onExpand(ticket.id)}
      >
        {/* Checkbox — stop propagation so clicking checkbox doesn't toggle expand */}
        <div
          onClick={e => {
            e.stopPropagation()
            onToggle(ticket.id)
          }}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(ticket.id)}
            className="rounded border-slate-300 accent-blue-600 w-4 h-4 cursor-pointer"
            aria-label={`选择工单 ${ticket.customerName}`}
          />
        </div>

        {/* Channel emoji */}
        <span className="text-base shrink-0 w-5 text-center">{channelEmoji}</span>

        {/* Customer name */}
        <span className="text-xs font-medium text-slate-700 w-20 shrink-0 truncate">
          {ticket.customerName}
        </span>

        {/* Message preview */}
        <span className="text-xs text-slate-500 flex-1 min-w-0 truncate" title={ticket.customerMessage}>
          {msgPreview}
        </span>

        {/* AI reply preview */}
        <span
          className="text-xs text-slate-400 w-40 shrink-0 truncate hidden md:block"
          title={ticket.aiReply}
        >
          {replyPreview}
        </span>

        {/* Confidence bar */}
        <div className="w-24 shrink-0">
          <ConfidenceBar value={confidence} />
        </div>

        {/* Expand chevron */}
        <span className="text-slate-300 shrink-0">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">
              客户消息
            </p>
            <div className="bg-white rounded-md border border-slate-200 p-2.5 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
              {ticket.customerMessage}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">
              AI 回复草稿
            </p>
            <div className="bg-white rounded-md border border-blue-100 p-2.5 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
              {ticket.aiReply || <span className="text-slate-400 italic">暂无草稿</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
