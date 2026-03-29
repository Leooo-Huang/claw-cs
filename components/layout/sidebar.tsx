'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CheckSquare, GitBranch, Search, Palette,
  MessageSquare, Package, Settings, Bot, Zap, ChevronDown
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

const ICON_MAP = {
  LayoutDashboard, CheckSquare, GitBranch, Search, Palette,
  MessageSquare, Package, Settings
}

type NavChild = {
  key: string
  label: string
  href: string
}

type NavItem =
  | { key: 'divider'; label: string }
  | { key: string; label: string; icon: string; href: string; badge?: boolean; bottom?: boolean; children?: NavChild[] }

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "LayoutDashboard", href: "/" },
  { key: "divider", label: "智能客服" },
  { key: "cs-tickets", label: "工单中心", icon: "MessageSquare", href: "/tickets" },
  { key: "cs-knowledge", label: "知识库", icon: "Search", href: "/knowledge" },
  { key: "cs-batch", label: "批量运营", icon: "CheckSquare", href: "/batch" },
  { key: "cs-channels", label: "渠道配置", icon: "Settings", href: "/channels" },
  { key: "settings", label: "设置", icon: "Settings", href: "/settings", bottom: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  useEffect(() => {
    // Auto-expand parent when a child route is active
    for (const item of NAV_ITEMS) {
      if (item.key === 'divider') continue
      if ('children' in item && item.children) {
        const hasActiveChild = item.children.some(child => pathname === child.href)
        if (hasActiveChild) {
          setExpandedKeys(prev => prev.includes(item.key) ? prev : [...prev, item.key])
        }
      }
    }
  }, [pathname])

  useEffect(() => {
    // Fetch pending draft count
    fetch('/api/drafts?status=pending&limit=1')
      .then(r => r.json())
      .then(data => setPendingCount(data.meta?.total || 0))
      .catch(() => {})

    // Refresh every 30s
    const interval = setInterval(() => {
      fetch('/api/drafts?status=pending&limit=1')
        .then(r => r.json())
        .then(data => setPendingCount(data.meta?.total || 0))
        .catch(() => {})
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const toggleExpanded = (key: string) => {
    setExpandedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const mainItems = NAV_ITEMS.filter(item => item.key === 'divider' || !('bottom' in item && item.bottom))
  const bottomItems = NAV_ITEMS.filter(item => item.key !== 'divider' && 'bottom' in item && item.bottom)

  return (
    <div className="fixed left-0 top-0 h-full w-60 bg-slate-900 text-slate-100 flex flex-col z-40">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold text-sm text-white">AI 工作台</div>
            <div className="text-xs text-slate-400">电商智能助手</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {mainItems.map((item) => {
          if (item.key === 'divider') {
            return (
              <div key="divider" className="pt-4 pb-1">
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2">
                  {item.label}
                </div>
              </div>
            )
          }

          if (!('href' in item) || !item.href) return null
          const href = item.href
          const Icon = ICON_MAP[(item.icon as keyof typeof ICON_MAP)]
          const hasChildren = 'children' in item && Array.isArray(item.children) && item.children.length > 0
          const isExpanded = expandedKeys.includes(item.key)

          if (hasChildren && item.children) {
            const children = item.children
            const hasActiveChild = children.some(child => pathname === child.href)
            const isActive = hasActiveChild

            return (
              <div key={item.key}>
                <button
                  onClick={() => toggleExpanded(item.key)}
                  className={cn(
                    "w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-all",
                    isActive
                      ? "text-white hover:bg-slate-800"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 shrink-0 transition-transform duration-200",
                      isExpanded ? "rotate-180" : ""
                    )}
                  />
                </button>
                {isExpanded && (
                  <div className="mt-1 space-y-0.5">
                    {children.map(child => {
                      const isChildActive = pathname === child.href
                      return (
                        <Link
                          key={child.key}
                          href={child.href}
                          className={cn(
                            "flex items-center gap-2 pl-7 pr-2 py-1.5 rounded-md text-xs transition-all",
                            isChildActive
                              ? "bg-blue-600 text-white"
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const isActive = pathname === href ||
            (href !== '/' && pathname.startsWith(href))

          return (
            <Link
              key={item.key}
              href={href}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-all",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              <span className="flex-1">{item.label}</span>
              {'badge' in item && item.badge && pendingCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 text-xs px-1">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom items */}
      <div className="px-3 py-4 border-t border-slate-700/50">
        {bottomItems.map((item) => {
          if (!('href' in item) || !item.href) return null
          const href = item.href
          const Icon = ICON_MAP[(item.icon as keyof typeof ICON_MAP)]
          const isActive = pathname === href

          return (
            <Link
              key={item.key}
              href={href}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-all",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* Version indicator */}
        <div className="mt-3 px-2 flex items-center gap-2">
          <Zap className="w-3 h-3 text-yellow-400" />
          <span className="text-xs text-slate-500">IntelliCave Demo</span>
        </div>
      </div>
    </div>
  )
}
