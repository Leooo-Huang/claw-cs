'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { User, ShoppingBag, ExternalLink } from 'lucide-react'

const CHANNEL_EMOJIS: Record<string, string> = {
  taobao: '🛒',
  pinduoduo: '🔶',
  shopify: '🛍️',
  douyin: '🎵',
  email: '📧',
  mock: '🧪',
}

const CHANNEL_LABELS: Record<string, string> = {
  taobao: '淘宝',
  pinduoduo: '拼多多',
  shopify: 'Shopify',
  douyin: '抖音',
  email: '邮件',
  mock: '测试渠道',
}

interface Ticket {
  id: string
  customerName: string
  channelType: string
  orderId: string | null
  channel?: { name: string; type: string }
}

interface CustomerContextProps {
  ticket: Ticket
}

export function CustomerContext({ ticket }: CustomerContextProps) {
  const channelType = ticket.channelType || ticket.channel?.type || 'mock'
  const emoji = CHANNEL_EMOJIS[channelType] || '📦'
  const channelLabel = CHANNEL_LABELS[channelType] || channelType

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Customer profile */}
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">{ticket.customerName}</p>
                <p className="text-xs text-slate-400">{emoji} {channelLabel}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">来源渠道</span>
                <Badge variant="outline" className="text-xs h-5 px-1.5">
                  {emoji} {channelLabel}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order info */}
        {ticket.orderId && (
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">关联订单</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">订单号</span>
                  <span className="text-xs text-slate-700 font-mono">{ticket.orderId}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick actions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">快捷操作</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start h-8 text-xs text-slate-600"
            onClick={() => {/* navigate to customer history */}}
          >
            <ExternalLink className="w-3 h-3 mr-2" />
            查看客户历史
          </Button>
        </div>
      </div>
    </ScrollArea>
  )
}
