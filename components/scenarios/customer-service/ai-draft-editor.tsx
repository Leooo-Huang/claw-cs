'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle, ChevronDown, ChevronRight, Edit2, XCircle, Brain, Search, MessageSquare, FileText, BookOpen } from 'lucide-react'
import { QUICK_REPLIES } from '@/lib/customer-service/quick-replies'

interface CitedRule {
  id: string
  condition: string
  content: string
  tags: string[]
}

interface SearchMetaChunk {
  id: string
  content: string
  filename: string
  chunkIndex: number
  score: number
}

interface SearchMetaRule {
  id: string
  condition: string
  content: string
  confidence: number
  score: number
}

interface SearchMeta {
  searchTimeMs: number
  chunks: SearchMetaChunk[]
  rules: SearchMetaRule[]
}

interface Ticket {
  id: string
  aiReply: string | null
  aiReasoning: string | null
  aiConfidence?: number | null
  aiSearchMeta?: string | null
  intent?: string | null
  sentiment?: string | null
  citedRules: CitedRule[]
}

interface AiDraftEditorProps {
  ticket: Ticket
  onApprove: () => Promise<void>
  onEditSend: (editedReply: string) => Promise<void>
  onReject: () => Promise<void>
}

function parseSearchMeta(raw: string | null | undefined): SearchMeta | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as SearchMeta
  } catch { /* ignore */ }
  return null
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${color}`}>{pct}%</span>
}

export function AiDraftEditor({ ticket, onApprove, onEditSend, onReject }: AiDraftEditorProps) {
  const [editedText, setEditedText] = useState(ticket.aiReply ?? '')
  const [thinkingOpen, setThinkingOpen] = useState(false)
  const [approving, setApproving] = useState(false)
  const [sending, setSending] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  // Sync textarea when ticket changes
  useEffect(() => {
    setEditedText(ticket.aiReply ?? '')
  }, [ticket.id, ticket.aiReply])

  const isModified = editedText.trim() !== (ticket.aiReply ?? '').trim()
  const searchMeta = parseSearchMeta(ticket.aiSearchMeta)

  const handleApprove = async () => {
    setApproving(true)
    try { await onApprove() } finally { setApproving(false) }
  }

  const handleEditSend = async () => {
    setSending(true)
    try { await onEditSend(editedText) } finally { setSending(false) }
  }

  const handleReject = async () => {
    setRejecting(true)
    try { await onReject() } finally { setRejecting(false) }
  }

  if (!ticket.aiReply) {
    return (
      <div className="bg-blue-50 border border-blue-100 border-l-4 border-l-blue-400 rounded-lg p-4">
        <p className="text-sm text-blue-600">AI 正在生成回复草稿...</p>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border border-blue-100 border-l-4 border-l-orange-400 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">AI 回复草稿</span>
        <Badge variant="outline" className="text-orange-600 border-orange-200 text-xs">待审批</Badge>
      </div>

      {/* Quick replies */}
      <Select
        value=""
        onValueChange={(id) => {
          const reply = QUICK_REPLIES.find(r => r.id === id)
          if (reply) {
            setEditedText(prev => prev ? `${prev}\n${reply.text}` : reply.text)
          }
        }}
      >
        <SelectTrigger className="h-7 w-[160px] text-xs">
          <SelectValue placeholder="插入快捷话术..." />
        </SelectTrigger>
        <SelectContent>
          {QUICK_REPLIES.map(r => (
            <SelectItem key={r.id} value={r.id} className="text-xs">
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Editable reply */}
      <Textarea
        value={editedText}
        onChange={e => setEditedText(e.target.value)}
        className="text-sm text-slate-700 bg-white border-slate-200 resize-none min-h-[100px]"
        placeholder="AI 回复内容..."
      />

      {/* AI Thinking Process */}
      <Collapsible open={thinkingOpen} onOpenChange={setThinkingOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors w-full text-left bg-transparent border-0 p-0 cursor-pointer">
          <Brain className="w-3 h-3" />
          <span>AI 思考过程</span>
          {thinkingOpen ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-3">

            {/* Step 1: Intent Understanding */}
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-medium text-slate-700">1. 理解意图</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                {ticket.intent && (
                  <span>意图：<Badge variant="outline" className="text-xs ml-0.5">{ticket.intent}</Badge></span>
                )}
                {ticket.sentiment && (
                  <span>情感：<Badge variant="outline" className="text-xs ml-0.5">{ticket.sentiment}</Badge></span>
                )}
                {!ticket.intent && !ticket.sentiment && (
                  <span className="text-slate-400">暂无意图/情感分析</span>
                )}
              </div>
            </div>

            {/* Step 2: Knowledge Retrieval */}
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Search className="w-3 h-3 text-green-500" />
                <span className="text-xs font-medium text-slate-700">2. 知识检索</span>
                {searchMeta && (
                  <span className="text-[10px] text-slate-400 ml-auto">
                    耗时 {searchMeta.searchTimeMs}ms
                  </span>
                )}
              </div>

              {searchMeta ? (
                <div className="space-y-2">
                  {/* Document chunks */}
                  {searchMeta.chunks.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <FileText className="w-2.5 h-2.5 text-slate-400" />
                        <span className="text-[10px] text-slate-500 font-medium">
                          文档命中 {searchMeta.chunks.length} 条
                        </span>
                      </div>
                      <div className="space-y-1">
                        {searchMeta.chunks.map(chunk => (
                          <div key={chunk.id} className="bg-slate-50 rounded p-2 border border-slate-100">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] text-slate-400">{chunk.filename}</span>
                              <span className="text-[10px] text-slate-300">#{chunk.chunkIndex + 1}</span>
                              <ScoreBadge score={chunk.score} />
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-2">{chunk.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rule matches */}
                  {searchMeta.rules.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <BookOpen className="w-2.5 h-2.5 text-slate-400" />
                        <span className="text-[10px] text-slate-500 font-medium">
                          话术命中 {searchMeta.rules.length} 条
                        </span>
                      </div>
                      <div className="space-y-1">
                        {searchMeta.rules.map(rule => (
                          <div key={rule.id} className="bg-slate-50 rounded p-2 border border-slate-100">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] text-slate-500 font-medium">{rule.condition}</span>
                              <ScoreBadge score={rule.score} />
                              <span className="text-[10px] text-slate-400 ml-auto">
                                置信度 {Math.round(rule.confidence * 100)}%
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-2">{rule.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchMeta.chunks.length === 0 && searchMeta.rules.length === 0 && (
                    <p className="text-[11px] text-slate-400">未检索到相关知识</p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">无检索数据</p>
              )}
            </div>

            {/* Step 3: Generate Reply */}
            <div className="bg-white rounded-lg p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Brain className="w-3 h-3 text-purple-500" />
                <span className="text-xs font-medium text-slate-700">3. 生成回复</span>
                {ticket.aiConfidence != null && (
                  <span className="text-[10px] text-slate-400 ml-auto">
                    置信度 {Math.round(ticket.aiConfidence * 100)}%
                  </span>
                )}
              </div>
              {ticket.aiReasoning ? (
                <p className="text-[11px] text-slate-600 whitespace-pre-wrap">{ticket.aiReasoning}</p>
              ) : (
                <p className="text-[11px] text-slate-400">无推理过程记录</p>
              )}
            </div>

          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
          disabled={approving || isModified}
          onClick={handleApprove}
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          {approving ? '处理中...' : '批准并发送'}
        </Button>

        <Button
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 text-white h-8 text-xs"
          disabled={!isModified || sending}
          onClick={handleEditSend}
        >
          <Edit2 className="w-3 h-3 mr-1" />
          {sending ? '发送中...' : '修改并发送'}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs text-slate-600"
          disabled={rejecting}
          onClick={handleReject}
        >
          <XCircle className="w-3 h-3 mr-1" />
          {rejecting ? '处理中...' : '拒绝重新生成'}
        </Button>
      </div>

      {isModified && (
        <p className="text-[10px] text-orange-500">已修改 -- 请点击「修改并发送」以使用修改后的版本</p>
      )}
    </div>
  )
}
