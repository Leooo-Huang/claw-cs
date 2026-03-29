'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import { notificationStore, type Notification } from '@/lib/notification'

const ICON_MAP = {
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
} as const

const COLOR_MAP = {
  success: {
    bg: 'bg-green-50 border-green-200',
    icon: 'text-green-500',
    text: 'text-green-800',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-500',
    text: 'text-blue-800',
  },
  warning: {
    bg: 'bg-orange-50 border-orange-200',
    icon: 'text-orange-500',
    text: 'text-orange-800',
  },
} as const

export function GlobalNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    // Initialize with current notifications
    setNotifications(notificationStore.getAll())
    const unsubscribe = notificationStore.subscribe(setNotifications)
    return unsubscribe
  }, [])

  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map(n => {
        const Icon = ICON_MAP[n.type]
        const colors = COLOR_MAP[n.type]
        return (
          <div
            key={n.id}
            className={`flex items-start gap-2 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-bottom-2 ${colors.bg}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${colors.icon}`} />
            <p className={`text-sm flex-1 ${colors.text}`}>{n.message}</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 text-slate-400 hover:text-slate-600 shrink-0"
              onClick={() => notificationStore.remove(n.id)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
