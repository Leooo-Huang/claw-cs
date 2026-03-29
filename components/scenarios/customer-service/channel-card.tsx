'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type ChannelType = 'taobao' | 'pinduoduo' | 'shopify' | 'douyin' | 'email' | 'mock'
type ChannelStatus = 'connected' | 'error' | 'disconnected'

interface Channel {
  id: string
  type: ChannelType
  name: string
  status: ChannelStatus
  errorMsg?: string | null
  totalTickets?: number
  todayTickets?: number
  weekTickets?: number
  config?: Record<string, string>
  createdAt: string
}

interface ChannelCardProps {
  channel: Channel
  onUpdate: () => void
}

const CHANNEL_ICONS: Record<ChannelType, string> = {
  taobao: '🛒',
  pinduoduo: '🔶',
  shopify: '🛍️',
  douyin: '🎵',
  email: '📧',
  mock: '🧪',
}

const CHANNEL_LABELS: Record<ChannelType, string> = {
  taobao: '淘宝',
  pinduoduo: '拼多多',
  shopify: 'Shopify',
  douyin: '抖店',
  email: '邮箱',
  mock: '模拟数据',
}

const STATUS_CONFIG: Record<ChannelStatus, { dot: string; label: string; badge: string }> = {
  connected: { dot: 'bg-green-500', label: '已连接', badge: 'bg-green-50 text-green-700 border-green-200' },
  error: { dot: 'bg-red-500', label: '连接错误', badge: 'bg-red-50 text-red-700 border-red-200' },
  disconnected: { dot: 'bg-slate-300', label: '未连接', badge: 'bg-slate-50 text-slate-500 border-slate-200' },
}

/**
 * Mask sensitive config values, showing only first 3 and last 2 characters.
 */
function maskSensitive(key: string, value: string): string {
  const sensitiveKeys = ['password', 'token', 'accesstoken', 'secret', 'key']
  if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
    if (value.length <= 5) return '***'
    return value.slice(0, 3) + '***' + value.slice(-2)
  }
  return value
}

export function ChannelCard({ channel, onUpdate }: ChannelCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [polling, setPolling] = useState(false)
  const [pollResult, setPollResult] = useState<{ messagesReceived: number } | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  const statusCfg = STATUS_CONFIG[channel.status]

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/channels/${channel.id}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResult(data.data)
      onUpdate()
    } catch {
      setTestResult({ success: false, message: '请求失败，请检查网络' })
    } finally {
      setTesting(false)
    }
  }

  const handlePoll = async () => {
    setPolling(true)
    setPollResult(null)
    try {
      const res = await fetch(`/api/channels/${channel.id}/poll`, { method: 'POST' })
      const data = await res.json()
      setPollResult(data.data)
      onUpdate()
    } catch {
      setPollResult({ messagesReceived: 0 })
    } finally {
      setPolling(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await fetch(`/api/channels/${channel.id}`, { method: 'DELETE' })
      onUpdate()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card className="rounded-lg border border-slate-200 shadow-sm">
      <CardContent className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-xl shrink-0">
              {CHANNEL_ICONS[channel.type]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{channel.name}</p>
              <p className="text-xs text-slate-400">{CHANNEL_LABELS[channel.type]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {channel.type !== 'mock' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-slate-100 text-slate-400 border-slate-200">
                demo
              </Badge>
            )}
            <Badge variant="outline" className={`text-xs ${statusCfg.badge}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${statusCfg.dot}`} />
              {channel.type !== 'mock' && channel.status === 'connected' ? '已配置 · 即将上线' : statusCfg.label}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2.5"
              onClick={() => setExpanded(v => !v)}
            >
              管理
              {expanded ? (
                <ChevronUp className="w-3 h-3 ml-1" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-1" />
              )}
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
          <span>今日消息：<span className="font-medium text-slate-600">{channel.totalTickets ?? 0}</span> 条</span>
          {channel.errorMsg && (
            <span className="text-red-500 truncate max-w-[160px]" title={channel.errorMsg}>
              错误：{channel.errorMsg}
            </span>
          )}
        </div>

        {/* Expanded management panel */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            {/* Channel meta + connection info (masked) */}
            <div className="text-xs text-slate-500 space-y-1">
              <div className="flex gap-2">
                <span className="text-slate-400 w-16 shrink-0">渠道ID</span>
                <span className="font-mono text-slate-600 truncate">{channel.id}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400 w-16 shrink-0">类型</span>
                <span className="text-slate-600">{CHANNEL_LABELS[channel.type]}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-400 w-16 shrink-0">创建时间</span>
                <span className="text-slate-600">{new Date(channel.createdAt).toLocaleDateString('zh-CN')}</span>
              </div>
              {channel.config && Object.entries(channel.config).map(([key, val]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-slate-400 w-16 shrink-0">{key}</span>
                  <span className="font-mono text-slate-600">
                    {maskSensitive(key, val)}
                  </span>
                </div>
              ))}
            </div>

            {/* Message statistics */}
            <div className="flex items-center gap-4 text-xs">
              <div className="bg-blue-50 rounded px-2 py-1 border border-blue-100">
                <span className="text-blue-500">今日</span>{' '}
                <span className="font-medium text-blue-700">{channel.todayTickets ?? channel.totalTickets ?? 0}</span> 条
              </div>
              <div className="bg-slate-50 rounded px-2 py-1 border border-slate-100">
                <span className="text-slate-400">本周</span>{' '}
                <span className="font-medium text-slate-600">{channel.weekTickets ?? 0}</span> 条
              </div>
              <div className="bg-slate-50 rounded px-2 py-1 border border-slate-100">
                <span className="text-slate-400">累计</span>{' '}
                <span className="font-medium text-slate-600">{channel.totalTickets ?? 0}</span> 条
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handleTest}
                disabled={testing}
              >
                {testing && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {testing ? '测试中...' : '测试连接'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handlePoll}
                disabled={polling}
              >
                {polling && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                {polling ? '拉取中...' : '拉取消息'}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                    disabled={disconnecting}
                  >
                    {disconnecting ? '断开中...' : '断开连接'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认断开连接</AlertDialogTitle>
                    <AlertDialogDescription>
                      断开后将停止从「{channel.name}」接收消息。已有的工单数据不会丢失。确定要断开吗？
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDisconnect}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      确认断开
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`rounded-md px-3 py-2 text-xs ${
                testResult.success
                  ? 'bg-green-50 text-green-700 border border-green-100'
                  : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
                {testResult.success ? '✓ ' : '✗ '}{testResult.message}
              </div>
            )}

            {/* Poll result */}
            {pollResult && (
              <div className="rounded-md px-3 py-2 text-xs bg-blue-50 text-blue-700 border border-blue-100">
                已拉取 {pollResult.messagesReceived} 条新消息
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
