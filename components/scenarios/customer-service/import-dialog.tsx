'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, FileText, X } from 'lucide-react'
import { notify } from '@/lib/notification'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
}

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF 文档',
  xlsx: 'Excel 表格',
  xls: 'Excel 表格',
  csv: 'CSV 表格',
  txt: '纯文本',
  json: 'JSON 数据',
  md: 'Markdown 文档',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImportDialog({ open, onOpenChange, onImported }: ImportDialogProps) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [storeAsDocument, setStoreAsDocument] = useState(true)
  const [extractRules, setExtractRules] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setFile(null)
    setStoreAsDocument(true)
    setExtractRules(true)
    setError(null)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const handleFileSelect = useCallback((f: File) => {
    setFile(f)
    setError(null)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFileSelect(f)
    },
    [handleFileSelect]
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFileSelect(f)
    e.target.value = ''
  }

  const handleSubmit = () => {
    if (!file || (!storeAsDocument && !extractRules)) return

    const fileName = file.name

    // 1. 立即关闭弹窗 — 不阻塞用户
    const formData = new FormData()
    formData.append('file', file)
    formData.append('storeAsDocument', String(storeAsDocument))
    formData.append('extractRules', String(extractRules))

    handleClose()

    // 2. 全局通知：正在处理
    notify.info(`正在处理「${fileName}」...`)

    // 3. 后台异步发请求
    fetch('/api/knowledge/import', {
      method: 'POST',
      body: formData,
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error || '处理失败')
        }
        return res.json()
      })
      .then((json) => {
        const data = json.data || {}
        const parts: string[] = [`「${fileName}」处理完成`]
        if (data.document) {
          parts.push(`文档入库（${data.document.chunkCount} 段落）`)
        }
        if (data.candidateRules != null && data.candidateRules > 0) {
          parts.push(`提取 ${data.candidateRules} 条候选规则`)
        }
        notify.success(parts.join(' · '))
        onImported?.()
      })
      .catch((err) => {
        notify.warning(`「${fileName}」处理失败：${err instanceof Error ? err.message : '未知错误'}`)
      })
  }

  const ext = file?.name.split('.').pop()?.toLowerCase() || ''
  const fileTypeLabel = FILE_TYPE_LABELS[ext] || '文件'

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-100">
          <DialogTitle className="text-sm font-semibold">导入知识文件</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-5 py-4 gap-4">
          {/* Drop zone */}
          {!file && (
            <div
              className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-10 gap-3 cursor-pointer transition-colors ${
                dragging
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
              }`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-slate-300" />
              <div className="text-center">
                <p className="text-sm text-slate-600">
                  拖拽文件至此，或<span className="text-blue-600 cursor-pointer"> 点击选择</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  支持 .csv / .xlsx / .pdf / .txt / .json 格式
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".txt,.md,.json,.csv,.xlsx,.xls,.pdf"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}

          {/* File info */}
          {file && (
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-slate-700 truncate block">{file.name}</span>
                <span className="text-[10px] text-slate-400">{fileTypeLabel}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                onClick={reset}
                disabled={false}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Processing options */}
          {file && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 font-medium">处理方式</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={storeAsDocument}
                  onChange={e => setStoreAsDocument(e.target.checked)}
                  className="rounded border-slate-300 accent-blue-600 mt-0.5"
                />
                <div>
                  <span className="text-xs text-slate-700">存入文档库</span>
                  <p className="text-[10px] text-slate-400">文件内容将分段存储，AI 回复时自动检索参考</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={extractRules}
                  onChange={e => setExtractRules(e.target.checked)}
                  className="rounded border-slate-300 accent-blue-600 mt-0.5"
                />
                <div>
                  <span className="text-xs text-slate-700">提取话术规则</span>
                  <p className="text-[10px] text-slate-400">AI 自动提取标准回复模板，需人工审核后生效</p>
                </div>
              </label>
            </div>
          )}

          {/* Error (only shows if submit fails before close, shouldn't happen normally) */}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
          <Button size="sm" variant="ghost" onClick={handleClose} className="text-slate-500">
            取消
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={!file || (!storeAsDocument && !extractRules)}
            onClick={handleSubmit}
          >
            开始处理
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
