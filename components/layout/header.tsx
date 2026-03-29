'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export function Header({ title }: { title?: string }) {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    fetch('/api/drafts?status=pending&limit=1')
      .then(r => r.json())
      .then(data => setPendingCount(data.meta?.total || 0))
      .catch(() => {})
  }, [])

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="font-semibold text-slate-800 text-base">
        {title}
      </div>
      <div className="flex items-center gap-3">
        <Link href="/approval">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5 text-slate-600" />
            {pendingCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-4 text-xs px-1"
              >
                {pendingCount > 9 ? '9+' : pendingCount}
              </Badge>
            )}
          </Button>
        </Link>
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">运</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
