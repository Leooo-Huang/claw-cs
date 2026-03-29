'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, XCircle, Pencil, ExternalLink } from 'lucide-react'
import { DiffView } from '@/components/scenarios/customer-service/diff-view'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LearningCandidate {
  id: string
  ticketId: string
  originalReply: string
  editedReply: string
  diffType: 'semantic' | 'cosmetic'
  extractedCondition: string
  extractedContent: string
  extractedTags: string[]
  confidence: number
  status: 'pending' | 'approved' | 'rejected' | 'ignored'
  createdAt: string
}

interface CandidateCardProps {
  candidate: LearningCandidate
  selected: boolean
  onSelect: (id: string, checked: boolean) => void
  onApprove: (id: string, editedData?: { condition: string; content: string }) => Promise<void>
  onIgnore: (id: string) => Promise<void>
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CandidateCard({
  candidate,
  selected,
  onSelect,
  onApprove,
  onIgnore,
}: CandidateCardProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [editCondition, setEditCondition] = useState(candidate.extractedCondition)
  const [editContent, setEditContent] = useState(candidate.extractedContent)
  const [acting, setActing] = useState(false)

  const pct = Math.round(candidate.confidence * 100)
  const confColor =
    pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-500' : 'text-red-500'

  const handleApprove = async () => {
    setActing(true)
    await onApprove(
      candidate.id,
      mode === 'edit'
        ? { condition: editCondition, content: editContent }
        : undefined
    )
    setActing(false)
  }

  const handleIgnore = async () => {
    setActing(true)
    await onIgnore(candidate.id)
    setActing(false)
  }

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={e => onSelect(candidate.id, e.target.checked)}
            className="rounded border-slate-300 accent-blue-600"
          />
          <a
            href={`/scenarios/customer-service?ticket=${candidate.ticketId}`}
            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
          >
            工单 #{candidate.ticketId.slice(-6)}
            <ExternalLink className="w-3 h-3" />
          </a>
          <span className="text-xs text-slate-400 ml-auto">
            {new Date(candidate.createdAt).toLocaleDateString('zh-CN')}
          </span>
          <span className={`text-xs font-semibold ${confColor}`}>{pct}%</span>
          <Badge
            variant="outline"
            className={`text-xs px-1.5 py-0 h-4 ${
              candidate.diffType === 'semantic'
                ? 'bg-orange-50 text-orange-600 border-orange-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            {candidate.diffType === 'semantic' ? '语义差异' : '细节差异'}
          </Badge>
        </div>

        {/* Diff view: original vs edited reply */}
        <div className="bg-slate-50 rounded-md p-3 border border-slate-100">
          <p className="text-xs text-slate-400 mb-1.5">回复变更对比</p>
          <DiffView original={candidate.originalReply} modified={candidate.editedReply} />
        </div>

        {/* Extracted rule preview */}
        <div className="bg-blue-50 border border-blue-100 rounded-md p-3">
          <p className="text-xs font-medium text-blue-700 mb-2">提取规则预览</p>
          {mode === 'view' ? (
            <div className="space-y-1 text-xs">
              <div className="flex gap-2">
                <span className="text-blue-500 w-10 shrink-0">条件</span>
                <span className="text-slate-700">{candidate.extractedCondition}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-blue-500 w-10 shrink-0">内容</span>
                <span className="text-slate-700">{candidate.extractedContent}</span>
              </div>
              <div className="flex gap-2 flex-wrap mt-1">
                {(candidate.extractedTags || []).map(tag => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs px-1.5 py-0 h-4 text-blue-600 border-blue-200 bg-white"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div>
                <label className="text-blue-500 block mb-0.5">条件</label>
                <Textarea
                  value={editCondition}
                  onChange={e => setEditCondition(e.target.value)}
                  rows={2}
                  className="text-xs py-1 resize-none"
                />
              </div>
              <div>
                <label className="text-blue-500 block mb-0.5">内容</label>
                <Textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={3}
                  className="text-xs py-1 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
            onClick={handleApprove}
            disabled={acting}
          >
            <CheckCircle className="w-3 h-3" />
            入库
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => setMode(m => m === 'edit' ? 'view' : 'edit')}
            disabled={acting}
          >
            <Pencil className="w-3 h-3" />
            {mode === 'edit' ? '取消编辑' : '编辑后入库'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-slate-400 hover:text-red-500 gap-1 ml-auto"
            onClick={handleIgnore}
            disabled={acting}
          >
            <XCircle className="w-3 h-3" />
            忽略
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
