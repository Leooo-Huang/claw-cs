'use client'

import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, X } from 'lucide-react'

interface LearningToastProps {
  visible: boolean
  onLearn: () => void
  onSkip: () => void
}

export function LearningToast({ visible, onLearn, onSkip }: LearningToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(() => {
        onSkip()
      }, 8000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible, onSkip])

  if (!visible) return null

  const handleLearn = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onLearn()
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white border border-slate-200 shadow-lg rounded-xl px-4 py-3 min-w-[340px] max-w-md animate-in slide-in-from-bottom-2">
      <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
      <p className="text-sm text-slate-700 flex-1">
        检测到语义修改，已提交 AI 分析
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white"
          onClick={handleLearn}
        >
          知道了
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
          onClick={onSkip}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}
