'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SSEEvent, NodeStatus } from '@/lib/types'

export interface NodeStateMap {
  [nodeId: string]: {
    status: NodeStatus
    timestamp?: string
  }
}

export function useWorkflowStream(instanceId: string | null) {
  const [nodeStates, setNodeStates] = useState<NodeStateMap>({})
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null)
  const esRef = useRef<EventSource | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Process a single SSE event
  const handleEvent = useCallback((data: SSEEvent) => {
    setLastEvent(data)

    if (data.type === 'node:status') {
      setNodeStates(prev => ({
        ...prev,
        [data.nodeId]: { status: data.status, timestamp: data.timestamp }
      }))
    }
  }, [])

  // Fetch current state from REST API as fallback / initial catch-up
  useEffect(() => {
    if (!instanceId) return

    const fetchState = async () => {
      try {
        const res = await fetch(`/api/workflows/${instanceId}`)
        if (!res.ok) return
        const { data } = await res.json()
        if (!data) return

        // Replay node states from DB
        const ns: NodeStateMap = {}
        for (const nodeState of (data.nodeStates || [])) {
          ns[nodeState.nodeId] = {
            status: nodeState.status,
            timestamp: nodeState.completedAt || nodeState.startedAt,
          }
        }
        setNodeStates(ns)

        // Replay draft events
        for (const draft of (data.drafts || [])) {
          const nodeId = data.nodeStates?.find((n: { id: string }) => n.id === draft.nodeStateId)?.nodeId || ''
          handleEvent({
            type: 'draft:created',
            draftId: draft.id,
            nodeId,
            title: draft.title,
            draftType: draft.draftType,
          })

          // If draft has real content (not placeholder), emit updated
          try {
            const content = typeof draft.content === 'string'
              ? JSON.parse(draft.content)
              : draft.content
            if (!content._placeholder) {
              handleEvent({ type: 'draft:updated', draftId: draft.id })
            }
          } catch {}
        }

        if (data.status === 'completed') {
          handleEvent({ type: 'workflow:completed', instanceId, stats: {} })
        } else if (data.status === 'failed') {
          handleEvent({ type: 'workflow:error', nodeId: 'engine', error: 'Workflow failed' })
        }
      } catch {}
    }

    // Poll every 3s to catch up with state changes
    fetchState()
    const poll = setInterval(fetchState, 3000)

    return () => clearInterval(poll)
  }, [instanceId, handleEvent])

  // SSE for real-time updates
  useEffect(() => {
    if (!instanceId) return

    const connect = () => {
      const es = new EventSource(`/api/workflows/${instanceId}/stream`)
      esRef.current = es

      es.onopen = () => setIsConnected(true)

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent
          handleEvent(data)

          if (data.type === 'workflow:completed' || data.type === 'workflow:error') {
            es.close()
            setIsConnected(false)
          }
        } catch {}
      }

      es.onerror = () => {
        setIsConnected(false)
        es.close()
        // Auto-reconnect after 5s
        reconnectRef.current = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      esRef.current?.close()
      setIsConnected(false)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [instanceId, handleEvent])

  return { nodeStates, isConnected, lastEvent }
}
