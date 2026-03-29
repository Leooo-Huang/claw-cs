'use client'

import { useMemo } from 'react'
import DiffMatchPatch from 'diff-match-patch'

interface DiffViewProps {
  original: string
  modified: string
}

/**
 * Render an inline diff between original and modified text.
 * Uses diff-match-patch for character-level diff.
 * Deleted text: red background + strikethrough
 * Added text: green background + underline
 */
export function DiffView({ original, modified }: DiffViewProps) {
  const diffs = useMemo(() => {
    const dmp = new DiffMatchPatch()
    return dmp.diff_main(original, modified)
  }, [original, modified])

  // Run cleanup for readability
  useMemo(() => {
    const dmp = new DiffMatchPatch()
    dmp.diff_cleanupSemantic(diffs)
  }, [diffs])

  if (original === modified) {
    return <span className="text-xs text-slate-600">{original}</span>
  }

  return (
    <span className="text-xs leading-relaxed">
      {diffs.map(([op, text], i) => {
        if (op === DiffMatchPatch.DIFF_DELETE) {
          return (
            <del
              key={i}
              className="bg-red-100 text-red-700 line-through rounded px-0.5"
            >
              {text}
            </del>
          )
        }
        if (op === DiffMatchPatch.DIFF_INSERT) {
          return (
            <ins
              key={i}
              className="bg-green-100 text-green-700 underline decoration-green-400 rounded px-0.5 no-underline underline-offset-2"
              style={{ textDecoration: 'underline' }}
            >
              {text}
            </ins>
          )
        }
        return <span key={i} className="text-slate-600">{text}</span>
      })}
    </span>
  )
}
