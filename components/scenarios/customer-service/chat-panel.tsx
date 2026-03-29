'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, CheckCircle, Pencil, Loader2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RuleCandidate {
  condition: string
  content: string
  tags: string[]
}

type MessageRole = 'user' | 'ai'

interface RulePreviewAction {
  type: 'rule_preview'
  candidate: RuleCandidate
  confirmed?: boolean
}

interface Message {
  id: string
  role: MessageRole
  text: string
  action?: RulePreviewAction
  timestamp: Date
  isError?: boolean
  retryText?: string
}

// ── Rule preview card ──────────────────────────────────────────────────────────

interface RulePreviewCardProps {
  candidate: RuleCandidate
  confirmed: boolean
  onConfirm: (editedData?: RuleCandidate) => Promise<void>
}

function RulePreviewCard({ candidate, confirmed, onConfirm }: RulePreviewCardProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [editCondition, setEditCondition] = useState(candidate.condition)
  const [editContent, setEditContent] = useState(candidate.content)
  const [saving, setSaving] = useState(false)

  if (confirmed) {
    return (
      <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <CheckCircle className="w-4 h-4 text-green-600" />
        已入库 ✓
      </div>
    )
  }

  const handleConfirm = async (useEdit: boolean) => {
    setSaving(true)
    await onConfirm(
      useEdit
        ? { condition: editCondition, content: editContent, tags: candidate.tags }
        : undefined
    )
    setSaving(false)
  }

  return (
    <div className="mt-2 border border-blue-200 rounded-lg bg-blue-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-blue-700">规则预览</p>

      {mode === 'view' ? (
        <div className="space-y-1 text-xs">
          <div className="flex gap-2">
            <span className="text-blue-500 w-10 shrink-0">条件</span>
            <span className="text-slate-700">{candidate.condition}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-blue-500 w-10 shrink-0">内容</span>
            <span className="text-slate-700">{candidate.content}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(candidate.tags || []).map(tag => (
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
        <div className="space-y-1.5 text-xs">
          <div>
            <span className="text-blue-500">条件</span>
            <textarea
              value={editCondition}
              onChange={e => setEditCondition(e.target.value)}
              rows={2}
              className="w-full mt-0.5 text-xs rounded border border-blue-200 bg-white p-1.5 resize-none outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <span className="text-blue-500">内容</span>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={3}
              className="w-full mt-0.5 text-xs rounded border border-blue-200 bg-white p-1.5 resize-none outline-none focus:border-blue-400"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="h-6 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          disabled={saving}
          onClick={() => handleConfirm(mode === 'edit')}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          确认入库
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs gap-1"
          disabled={saving}
          onClick={() => setMode(m => m === 'edit' ? 'view' : 'edit')}
        >
          <Pencil className="w-3 h-3" />
          {mode === 'edit' ? '取消' : '编辑后入库'}
        </Button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'hint',
      role: 'ai',
      text: '你好！请用自然语言描述新规则，例如：「如果客户问退货，就告诉他7天无理由退货，需要保持包装完好」',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/knowledge/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const json = await res.json()
      const data = json.data

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'ai',
        text: data.reply || 'AI 已处理您的请求',
        action:
          data.type === 'rule_preview' && data.candidate
            ? { type: 'rule_preview', candidate: data.candidate, confirmed: false }
            : undefined,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'ai',
          text: '请求失败，请检查网络后重试。',
          timestamp: new Date(),
          isError: true,
          retryText: text,
        },
      ])
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleRetry = (msgId: string) => {
    const msg = messages.find(m => m.id === msgId)
    if (!msg?.retryText) return
    // Remove the error message
    setMessages(prev => prev.filter(m => m.id !== msgId))
    // Re-set input and send
    setInput(msg.retryText)
    // We need to trigger send after state update, use setTimeout
    setTimeout(() => {
      const textarea = textareaRef.current
      if (textarea) {
        // Dispatch Enter key to trigger send
        textarea.focus()
      }
    }, 0)
  }

  const handleConfirmRule = async (
    msgId: string,
    editedData?: RuleCandidate
  ) => {
    const msg = messages.find(m => m.id === msgId)
    if (!msg?.action) return

    const ruleData = editedData || msg.action.candidate
    await fetch('/api/knowledge/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', ruleData }),
    })

    setMessages(prev =>
      prev.map(m =>
        m.id === msgId && m.action
          ? { ...m, action: { ...m.action, confirmed: true } }
          : m
      )
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Hint bar */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600">
        用自然语言教 AI 新规则 — 支持「如果…就…」、「当…时…」等格式
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 pb-2">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white text-xs ${
                  msg.role === 'user' ? 'bg-blue-500' : 'bg-slate-600'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-3.5 h-3.5" />
                ) : (
                  <Bot className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Bubble */}
              <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : msg.action?.confirmed
                        ? 'bg-green-50 border border-green-200 text-slate-700 rounded-tl-sm shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Retry button for error messages */}
                {msg.isError && msg.retryText && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1.5 h-6 text-xs"
                    onClick={() => handleRetry(msg.id)}
                  >
                    重试
                  </Button>
                )}

                {/* Rule preview card (AI only) */}
                {msg.action?.type === 'rule_preview' && (
                  <RulePreviewCard
                    candidate={msg.action.candidate}
                    confirmed={msg.action.confirmed ?? false}
                    onConfirm={editedData => handleConfirmRule(msg.id, editedData)}
                  />
                )}

                <span className="text-xs text-slate-300 mt-1 px-1">
                  {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl rounded-tl-sm px-3 py-2 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-slate-200 p-3 flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="描述一条规则，按 Enter 发送..."
          rows={2}
          className="flex-1 text-sm resize-none"
          disabled={sending}
        />
        <Button
          size="sm"
          className="h-9 px-3 bg-blue-600 hover:bg-blue-700"
          onClick={sendMessage}
          disabled={sending || !input.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
