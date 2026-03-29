'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle, Loader2 } from 'lucide-react'
import type { BatchTicket } from './batch-ticket-row'

interface SpotCheckDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  samples: BatchTicket[]
  totalCount: number
  onConfirm: () => Promise<void>
  loading: boolean
}

export function SpotCheckDialog({
  open,
  onOpenChange,
  samples,
  totalCount,
  onConfirm,
  loading,
}: SpotCheckDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-full"
        showCloseButton={!loading}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-slate-800">
            批量预检 — 随机抽取 {samples.length} 条
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            请确认以下随机样本的 AI 回复质量，再批量通过全部 {totalCount} 条工单。
          </p>
        </DialogHeader>

        {samples.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">
            正在加载样本…
          </div>
        ) : (
          <ScrollArea className="max-h-[420px] -mx-4 px-4">
            <div className="space-y-3 py-1">
              {samples.map((ticket, idx) => (
                <div
                  key={ticket.id}
                  className="rounded-lg border border-slate-200 overflow-hidden"
                >
                  {/* Sample header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      样本 {idx + 1}
                    </span>
                    <span className="text-xs font-medium text-slate-600">
                      {ticket.customerName}
                    </span>
                    {ticket.confidence != null && (
                      <span
                        className={`ml-auto text-xs font-semibold ${
                          ticket.confidence >= 0.9
                            ? 'text-green-600'
                            : ticket.confidence >= 0.7
                            ? 'text-yellow-600'
                            : 'text-red-500'
                        }`}
                      >
                        {Math.round(ticket.confidence * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Content grid */}
                  <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100">
                    <div className="p-3">
                      <p className="text-[10px] text-slate-400 mb-1.5 font-medium">客户消息</p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {ticket.customerMessage}
                      </p>
                    </div>
                    <div className="p-3">
                      <p className="text-[10px] text-slate-400 mb-1.5 font-medium">AI 回复草稿</p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {ticket.aiReply || (
                          <span className="italic text-slate-300">暂无草稿</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs"
          >
            取消
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={loading || samples.length === 0}
            className="text-xs bg-green-600 hover:bg-green-700 text-white gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                处理中…
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                确认全部通过（{totalCount} 条）
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
