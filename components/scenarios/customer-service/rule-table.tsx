'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, Pencil, Trash2, Upload, Search, AlertTriangle } from 'lucide-react'
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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KnowledgeRule {
  id: string
  condition: string
  content: string
  source: 'document' | 'conversation' | 'manual' | 'learning'
  tags: string[]
  confidence: number
  usageCount: number
  status: 'active' | 'pending' | 'deprecated'
  conflictsWith?: string[]
}

interface RuleMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

interface RuleTableProps {
  onImportClick: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<string, string> = {
  document: '📄',
  conversation: '💬',
  manual: '✋',
  learning: '🤖',
}

const SOURCE_LABELS: Record<string, string> = {
  document: '文档',
  conversation: '对话',
  manual: '手动',
  learning: '学习',
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  pending: 'bg-orange-50 text-orange-700 border-orange-200',
  deprecated: 'bg-slate-100 text-slate-400 border-slate-200',
}

const STATUS_LABELS: Record<string, string> = {
  active: '活跃',
  pending: '待审',
  deprecated: '废弃',
}

// ── Confidence bar ─────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-1.5 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 font-mono w-7 text-right">{pct}%</span>
    </div>
  )
}

// ── Inline editable cell ────────────────────────────────────────────────────────

interface EditableCellProps {
  value: string
  onSave: (next: string) => Promise<void>
  truncate?: boolean
}

function EditableCell({ value, onSave, truncate }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
    // Focus after render
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const cancel = () => {
    setEditing(false)
    setDraft(value)
  }

  const save = async () => {
    if (draft.trim() === value) {
      cancel()
      return
    }
    setSaving(true)
    await onSave(draft.trim())
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') cancel()
        }}
        onBlur={cancel}
        disabled={saving}
        className="h-7 text-xs py-0"
      />
    )
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={startEdit}
      onKeyDown={e => { if (e.key === 'Enter') startEdit() }}
      title="点击编辑"
      className={`cursor-pointer hover:text-blue-600 transition-colors ${
        truncate ? 'block max-w-[220px] truncate' : ''
      }`}
    >
      {value}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function RuleTable({ onImportClick }: RuleTableProps) {
  const [rules, setRules] = useState<KnowledgeRule[]>([])
  const [meta, setMeta] = useState<RuleMeta>({ total: 0, page: 1, limit: 20, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [source, setSource] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  const fetchRules = useCallback(async (params: {
    source: string
    status: string
    search: string
    page: number
  }) => {
    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      if (params.source !== 'all') sp.set('source', params.source)
      if (params.status !== 'all') sp.set('status', params.status)
      if (params.search) sp.set('search', params.search)
      sp.set('page', String(params.page))
      sp.set('limit', '20')
      const res = await fetch(`/api/knowledge/rules?${sp}`)
      if (!res.ok) throw new Error('请求失败')
      const json = await res.json()
      setRules(json.data || [])
      setMeta(json.meta || { total: 0, page: 1, limit: 20, totalPages: 1 })
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch whenever filters or page change
  useEffect(() => {
    fetchRules({ source, status, search, page })
  }, [fetchRules, source, status, search, page])

  const handleUpdateField = useCallback(
    async (id: string, field: 'condition' | 'content', value: string) => {
      await fetch(`/api/knowledge/rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      setRules(prev =>
        prev.map(r => (r.id === id ? { ...r, [field]: value } : r))
      )
    },
    []
  )

  const handleDeprecate = useCallback(async (id: string) => {
    await fetch(`/api/knowledge/rules/${id}`, {
      method: 'DELETE',
    })
    setRules(prev =>
      prev.map(r => (r.id === id ? { ...r, status: 'deprecated' as const } : r))
    )
  }, [])

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={source} onValueChange={v => { setSource(v ?? 'all'); setPage(1) }}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            <SelectItem value="document">📄 文档</SelectItem>
            <SelectItem value="conversation">💬 对话</SelectItem>
            <SelectItem value="manual">✋ 手动</SelectItem>
            <SelectItem value="learning">🤖 学习</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={v => { setStatus(v ?? 'all'); setPage(1) }}>
          <SelectTrigger className="h-8 w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">活跃</SelectItem>
            <SelectItem value="pending">待审</SelectItem>
            <SelectItem value="deprecated">废弃</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 flex-1 min-w-[160px] max-w-[280px]">
          <Input
            placeholder="搜索条件或内容..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={handleSearch}
          >
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            onClick={onImportClick}
          >
            <Upload className="w-3.5 h-3.5" />
            导入文件
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-xs text-slate-500 font-medium w-[160px]">条件</TableHead>
              <TableHead className="text-xs text-slate-500 font-medium">内容</TableHead>
              <TableHead className="text-xs text-slate-500 font-medium w-[60px]">来源</TableHead>
              <TableHead className="text-xs text-slate-500 font-medium w-[120px]">标签</TableHead>
              <TableHead className="text-xs text-slate-500 font-medium w-[110px]">置信度</TableHead>
              <TableHead className="text-xs text-slate-500 font-medium w-[60px]">引用</TableHead>
              <TableHead className="text-xs text-slate-500 font-medium w-[80px]">状态</TableHead>
              <TableHead className="text-xs text-slate-500 font-medium w-[80px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(8)].map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-sm text-red-500">
                  {error}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2 text-xs"
                    onClick={() => fetchRules({ source, status, search, page })}
                  >
                    重试
                  </Button>
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-sm text-slate-400">
                  暂无规则数据
                </TableCell>
              </TableRow>
            ) : (
              rules.map(rule => {
                const hasConflict = rule.conflictsWith && rule.conflictsWith.length > 0
                return (
                <TableRow
                  key={rule.id}
                  className={`${rule.status === 'deprecated' ? 'opacity-50' : ''} ${hasConflict ? 'bg-orange-50 border-l-2 border-orange-400' : ''}`}
                >
                  <TableCell className="text-xs py-2 font-medium text-slate-700">
                    <div className="flex items-center gap-1">
                      {hasConflict && (
                        <span title={`与 ${rule.conflictsWith!.length} 条规则冲突`}>
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        </span>
                      )}
                    <EditableCell
                      value={rule.condition}
                      onSave={v => handleUpdateField(rule.id, 'condition', v)}
                    />
                    </div>
                  </TableCell>
                  <TableCell className="text-xs py-2 text-slate-600">
                    <EditableCell
                      value={rule.content}
                      onSave={v => handleUpdateField(rule.id, 'content', v)}
                      truncate
                    />
                  </TableCell>
                  <TableCell className="text-xs py-2 text-center">
                    <span title={SOURCE_LABELS[rule.source]}>
                      {SOURCE_ICONS[rule.source] || '?'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    <div className="flex flex-wrap gap-0.5">
                      {(rule.tags || []).slice(0, 3).map(tag => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs px-1.5 py-0 h-4 text-slate-500 border-slate-200"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {rule.tags?.length > 3 && (
                        <span className="text-xs text-slate-400">+{rule.tags.length - 3}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    <ConfidenceBar value={rule.confidence} />
                  </TableCell>
                  <TableCell className="text-xs py-2 text-center font-mono text-slate-500">
                    {rule.usageCount ?? 0}
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    <Badge
                      variant="outline"
                      className={`text-xs px-1.5 py-0 h-4 ${STATUS_STYLE[rule.status]}`}
                    >
                      {STATUS_LABELS[rule.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs py-2">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600"
                        title="编辑"
                        onClick={() => {
                          // Inline edit is triggered by clicking the cell directly
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      {rule.status !== 'deprecated' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                              title="废弃"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认废弃规则</AlertDialogTitle>
                              <AlertDialogDescription>
                                废弃后该规则将不再被 AI 使用。确定要废弃规则「{rule.condition}」吗？
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeprecate(rule.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                确认废弃
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>共 {meta.total} 条规则</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="px-2">
              {page} / {meta.totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={page >= meta.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
