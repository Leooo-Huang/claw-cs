'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Radio } from 'lucide-react'
import { ChannelCard } from '@/components/scenarios/customer-service/channel-card'
import { AddChannelSheet } from '@/components/scenarios/customer-service/add-channel-sheet'

type ChannelType = 'taobao' | 'pinduoduo' | 'shopify' | 'douyin' | 'email' | 'mock'

interface Channel {
  id: string
  type: ChannelType
  name: string
  status: 'connected' | 'error' | 'disconnected'
  errorMsg?: string | null
  totalTickets?: number
  createdAt: string
}

interface ApiResponse {
  data: Channel[]
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

const PLATFORM_CARDS = [
  { type: 'taobao' as ChannelType, icon: '🛒', label: '淘宝', desc: '淘宝 / 天猫' },
  { type: 'pinduoduo' as ChannelType, icon: '🔶', label: '拼多多', desc: '拼多多店铺' },
  { type: 'shopify' as ChannelType, icon: '🛍️', label: 'Shopify', desc: '跨境独立站' },
  { type: 'douyin' as ChannelType, icon: '🎵', label: '抖店', desc: '抖音电商' },
  { type: 'email' as ChannelType, icon: '📧', label: '邮箱', desc: 'IMAP 邮件' },
  { type: 'mock' as ChannelType, icon: '🧪', label: '模拟数据', desc: '测试专用' },
]

export default function ChannelsPage() {
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data, isLoading, error, mutate } = useSWR<ApiResponse>('/api/channels', fetcher, {
    revalidateOnFocus: false,
  })

  const channels = data?.data ?? []
  const hasChannels = channels.length > 0

  return (
    <div className="flex flex-col h-full">
      <Header title="渠道配置" />

      <div className="flex-1 overflow-y-auto">
        {/* Top action bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">渠道管理</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isLoading ? '加载中…' : `${channels.length} 个渠道`}
            </p>
          </div>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setSheetOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            添加渠道
          </Button>
        </div>

        {/* Content area */}
        <div className="p-6">
          {/* Error state */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 mb-4">
              加载失败，请刷新页面重试
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !hasChannels && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                <Radio className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mb-1">连接你的第一个客服渠道</h3>
              <p className="text-sm text-slate-400 mb-8 max-w-xs">
                连接渠道后，客户消息将自动流入工单中心，由 AI 协助处理。
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg mb-8">
                {PLATFORM_CARDS.map(platform => (
                  <button
                    key={platform.type}
                    type="button"
                    className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                    onClick={() => setSheetOpen(true)}
                  >
                    <span className="text-3xl">{platform.icon}</span>
                    <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">
                      {platform.label}
                    </span>
                    <span className="text-xs text-slate-400">{platform.desc}</span>
                    {platform.type !== 'mock' && (
                      <span className="text-xs text-slate-400">即将上线</span>
                    )}
                  </button>
                ))}
              </div>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setSheetOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                添加渠道
              </Button>
            </div>
          )}

          {/* Channel grid */}
          {!isLoading && hasChannels && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channels.map((channel: Channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onUpdate={() => mutate()}
                />
              ))}

              {/* Add more card */}
              <button
                type="button"
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors h-[108px] group"
                onClick={() => setSheetOpen(true)}
              >
                <Plus className="w-6 h-6 text-slate-300 group-hover:text-blue-400" />
                <span className="text-xs text-slate-400 group-hover:text-blue-500">添加渠道</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <AddChannelSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onComplete={() => mutate()}
      />
    </div>
  )
}
