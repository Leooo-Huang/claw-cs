'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle, XCircle, Loader2, Edit2 } from 'lucide-react'
import { RuleTable } from '@/components/scenarios/customer-service/rule-table'
import { CandidateCard, type LearningCandidate } from '@/components/scenarios/customer-service/candidate-card'
import { ChatPanel } from '@/components/scenarios/customer-service/chat-panel'
import { ImportDialog } from '@/components/scenarios/customer-service/import-dialog'
import { KnowledgeStats } from '@/components/scenarios/customer-service/knowledge-stats'
import { DocumentList } from '@/components/scenarios/customer-service/document-list'

// ── Pending Rules section ────────────────────────────────────────────────────

interface PendingRule {
  id: string
  condition: string
  content: string
  tags: string[]
  confidence: number
  source: string
  sourceRef: string | null
}

function PendingRules({ onCountChange, onApproved }: { onCountChange: (n: number) => void; onApproved: () => void }) {
  const [rules, setRules] = useState<PendingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCondition, setEditCondition] = useState('')
  const [editContent, setEditContent] = useState('')

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge/rules?status=pending&limit=50')
      if (!res.ok) return
      const json = await res.json()
      const data = json.data || []
      setRules(data)
      onCountChange(json.meta?.total || data.length)
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => { fetch_() }, [fetch_])

  const handleApprove = async (id: string, editedData?: { condition: string; content: string }) => {
    const updateData: Record<string, unknown> = { status: 'active' }
    if (editedData) {
      updateData.condition = editedData.condition
      updateData.content = editedData.content
    }
    await fetch(`/api/knowledge/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    })
    setRules(prev => prev.filter(r => r.id !== id))
    onCountChange(Math.max(0, rules.length - 1))
    onApproved()
    setEditingId(null)
  }

  const handleIgnore = async (id: string) => {
    await fetch(`/api/knowledge/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'deprecated' }),
    })
    setRules(prev => prev.filter(r => r.id !== id))
    onCountChange(Math.max(0, rules.length - 1))
  }

  const handleBatchApprove = async () => {
    for (const r of rules) {
      await fetch(`/api/knowledge/rules/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })
    }
    setRules([])
    onCountChange(0)
    onApproved()
  }

  const startEdit = (r: PendingRule) => {
    setEditingId(r.id)
    setEditCondition(r.condition)
    setEditContent(r.content)
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (rules.length === 0) return null

  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">待审规则</span>
          <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">{rules.length}</Badge>
        </div>
        <Button
          size="sm"
          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
          onClick={handleBatchApprove}
        >
          <CheckCircle className="w-3 h-3" />
          全部入库
        </Button>
      </div>

      <div className="space-y-2">
        {rules.map(r => (
          <div
            key={r.id}
            className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2"
          >
            {editingId === r.id ? (
              <div className="space-y-2">
                <input
                  className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                  value={editCondition}
                  onChange={e => setEditCondition(e.target.value)}
                  placeholder="条件"
                />
                <textarea
                  className="w-full text-xs border border-slate-200 rounded px-2 py-1 min-h-[60px] resize-none"
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  placeholder="内容"
                />
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-6 text-[10px] bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleApprove(r.id, { condition: editCondition, content: editContent })}
                  >
                    保存并入库
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={() => setEditingId(null)}
                  >
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 w-6 shrink-0">条件</span>
                  <span className="text-xs text-slate-700 font-medium">{r.condition}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-400 w-6 shrink-0">内容</span>
                  <span className="text-xs text-slate-600 line-clamp-2">{r.content}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.sourceRef && (
                    <span className="text-[10px] text-slate-400">来源: {r.sourceRef}</span>
                  )}
                  <div className="ml-auto flex gap-1">
                    <Button
                      size="sm"
                      className="h-6 text-[10px] bg-green-600 hover:bg-green-700 text-white gap-0.5 px-2"
                      onClick={() => handleApprove(r.id)}
                    >
                      <CheckCircle className="w-2.5 h-2.5" />
                      入库
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] gap-0.5 px-2"
                      onClick={() => startEdit(r)}
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-slate-400 hover:text-red-500 gap-0.5 px-2"
                      onClick={() => handleIgnore(r.id)}
                    >
                      <XCircle className="w-2.5 h-2.5" />
                      忽略
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Review Queue tab (learning candidates) ────────────────────────────────────

function ReviewQueue({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [candidates, setCandidates] = useState<LearningCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchActing, setBatchActing] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchCandidates = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams({ status: 'pending', page: String(p), limit: '10' })
      const res = await fetch(`/api/learning/candidates?${sp}`)
      if (!res.ok) throw new Error('加载失败')
      const json = await res.json()
      setCandidates(json.data || [])
      setTotalPages(json.meta?.totalPages || 1)
      onCountChange(json.meta?.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [onCountChange])

  useEffect(() => {
    fetchCandidates(page)
  }, [fetchCandidates, page])

  const handleSelect = (id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const allSelected = candidates.length > 0 && selected.size === candidates.length

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(candidates.map(c => c.id)))
    }
  }

  const handleApprove = async (id: string, editedData?: { condition: string; content: string }) => {
    await fetch(`/api/learning/candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', editedData }),
    })
    setCandidates(prev => prev.filter(c => c.id !== id))
    setSelected(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    onCountChange(Math.max(0, candidates.length - 1))
  }

  const handleIgnore = async (id: string) => {
    await fetch(`/api/learning/candidates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ignore' }),
    })
    setCandidates(prev => prev.filter(c => c.id !== id))
    setSelected(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    onCountChange(Math.max(0, candidates.length - 1))
  }

  const handleBatchAction = async (action: 'approve' | 'ignore') => {
    if (selected.size === 0) return
    setBatchActing(true)
    try {
      await fetch('/api/learning/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      })
      setCandidates(prev => prev.filter(c => !selected.has(c.id)))
      onCountChange(Math.max(0, candidates.length - selected.size))
      setSelected(new Set())
    } finally {
      setBatchActing(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Batch action bar */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="rounded border-slate-300 accent-blue-600"
          disabled={candidates.length === 0}
        />
        <span className="text-xs text-slate-500">
          {selected.size > 0 ? `已选 ${selected.size} 条` : '全选'}
        </span>
        {selected.size > 0 && (
          <>
            <Button
              size="sm"
              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
              onClick={() => handleBatchAction('approve')}
              disabled={batchActing}
            >
              {batchActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              批量入库
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 text-slate-500"
              onClick={() => handleBatchAction('ignore')}
              disabled={batchActing}
            >
              {batchActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              批量忽略
            </Button>
          </>
        )}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 text-center py-8">
          {error}
          <Button size="sm" variant="ghost" className="ml-2 text-xs" onClick={() => fetchCandidates(page)}>
            重试
          </Button>
        </div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          暂无待审规则
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map(c => (
            <CandidateCard
              key={c.id}
              candidate={c}
              selected={selected.has(c.id)}
              onSelect={handleSelect}
              onApprove={handleApprove}
              onIgnore={handleIgnore}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            上一页
          </Button>
          <span className="text-xs text-slate-400 self-center">{page} / {totalPages}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [importOpen, setImportOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingRuleCount, setPendingRuleCount] = useState(0)
  const [rulesKey, setRulesKey] = useState(0)
  const [docsKey, setDocsKey] = useState(0)

  // Refresh after import
  const handleImported = () => {
    setRulesKey(k => k + 1)
    setDocsKey(k => k + 1)
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="知识工作台" />

      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="documents" className="flex flex-col h-full">
          {/* Tab bar */}
          <div className="border-b border-slate-200 px-6 pt-4">
            <TabsList className="h-9">
              <TabsTrigger value="documents" className="text-sm px-4">
                文档库
              </TabsTrigger>
              <TabsTrigger value="rules" className="text-sm px-4 gap-1.5">
                话术规则
                {pendingRuleCount > 0 && (
                  <Badge className="h-4 min-w-[16px] text-xs px-1 py-0 bg-orange-500 text-white border-0">
                    {pendingRuleCount > 99 ? '99+' : pendingRuleCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="review" className="text-sm px-4 gap-1.5">
                待审区
                {pendingCount > 0 && (
                  <Badge className="h-4 min-w-[16px] text-xs px-1 py-0 bg-orange-500 text-white border-0">
                    {pendingCount > 99 ? '99+' : pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-sm px-4">
                对话增强
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Document Library */}
          <TabsContent value="documents" className="flex-1 overflow-y-auto p-6 mt-0">
            <DocumentList key={docsKey} onImportClick={() => setImportOpen(true)} />
          </TabsContent>

          {/* Tab 2: Rules + Pending Rules */}
          <TabsContent value="rules" className="flex-1 overflow-y-auto p-6 mt-0">
            <PendingRules
              onCountChange={setPendingRuleCount}
              onApproved={() => setRulesKey(k => k + 1)}
            />
            <RuleTable key={rulesKey} onImportClick={() => setImportOpen(true)} />
          </TabsContent>

          {/* Tab 3: Review Queue (learning candidates) */}
          <TabsContent value="review" className="flex-1 overflow-y-auto p-6 mt-0">
            <ReviewQueue onCountChange={setPendingCount} />
          </TabsContent>

          {/* Tab 4: Chat Enhancement */}
          <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
            <ChatPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleImported}
      />

      {/* Floating stats */}
      <KnowledgeStats />
    </div>
  )
}
