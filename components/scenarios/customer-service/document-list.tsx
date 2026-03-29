'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
import { Upload, ChevronDown, ChevronRight, Trash2, FileText, CheckCircle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Document {
  id: string
  filename: string
  fileType: string
  fileSize: number
  chunkCount: number
  sourceType: string
  uploadedAt: string
}

interface Chunk {
  id: string
  content: string
  chunkIndex: number
}

interface DocumentListProps {
  onImportClick: () => void
}

// ── File type icons ───────────────────────────────────────────────────────────

const FILE_ICONS: Record<string, string> = {
  pdf: '\uD83D\uDCC4',
  xlsx: '\uD83D\uDCCA',
  xls: '\uD83D\uDCCA',
  csv: '\uD83D\uDCCA',
  txt: '\uD83D\uDCDD',
  json: '\uD83D\uDCAC',
  md: '\uD83D\uDCDD',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} 天前`
  return d.toLocaleDateString('zh-CN')
}

// ── Document Card ─────────────────────────────────────────────────────────────

function DocumentCard({ doc, onDeleted }: { doc: Document; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [loadingChunks, setLoadingChunks] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const icon = FILE_ICONS[doc.fileType] || '\uD83D\uDCC4'

  const loadChunks = async () => {
    if (chunks.length > 0) return
    setLoadingChunks(true)
    try {
      const res = await fetch(`/api/knowledge/documents/${doc.id}`)
      if (!res.ok) return
      const json = await res.json()
      setChunks(json.data?.chunks || [])
    } finally {
      setLoadingChunks(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen) loadChunks()
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await fetch(`/api/knowledge/documents/${doc.id}`, { method: 'DELETE' })
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{doc.filename}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-slate-400">{formatDate(doc.uploadedAt)}</span>
            <span className="text-[10px] text-slate-400">{formatFileSize(doc.fileSize)}</span>
            <span className="text-[10px] text-slate-500">{doc.chunkCount} 段落</span>
            <span className="text-[10px] text-green-600 flex items-center gap-0.5">
              <CheckCircle className="w-2.5 h-2.5" />
              已向量化
            </span>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
              disabled={deleting}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                删除文档「{doc.filename}」将同时移除所有段落和向量数据，此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Expandable chunks */}
      <Collapsible open={open} onOpenChange={handleOpenChange}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors w-full text-left border-t border-slate-100 px-4 py-2 bg-transparent cursor-pointer">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span>查看段落内容</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-2">
            {loadingChunks ? (
              <div className="space-y-1.5">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            ) : chunks.length === 0 ? (
              <p className="text-xs text-slate-400">暂无段落</p>
            ) : (
              chunks.map(chunk => (
                <div key={chunk.id} className="bg-slate-50 rounded p-2 border border-slate-100">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] text-slate-400 bg-slate-200 rounded px-1">
                      #{chunk.chunkIndex + 1}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-4">
                    {chunk.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ── Document List ─────────────────────────────────────────────────────────────

export function DocumentList({ onImportClick }: DocumentListProps) {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/knowledge/documents')
      if (!res.ok) throw new Error('加载失败')
      const json = await res.json()
      setDocs(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">文档库</h2>
        <Button
          size="sm"
          className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          onClick={onImportClick}
        >
          <Upload className="w-3.5 h-3.5" />
          上传文档
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 text-center py-8">
          {error}
          <Button size="sm" variant="ghost" className="ml-2 text-xs" onClick={fetchDocs}>
            重试
          </Button>
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="text-sm">暂无文档</p>
          <p className="text-xs mt-1">上传 PDF、Excel、TXT 等文件，AI 将自动分段向量化</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => (
            <DocumentCard key={doc.id} doc={doc} onDeleted={fetchDocs} />
          ))}
        </div>
      )}
    </div>
  )
}
