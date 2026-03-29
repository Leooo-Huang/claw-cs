import { NextResponse } from 'next/server'
import { syncKnowledgeToMemory } from '@/lib/customer-service/memory-sync'
import { initializeVectorStore } from '@/lib/customer-service/vector-init'
import { getVectorStore } from '@/lib/customer-service/vector-store'

export async function POST() {
  // Initialize vector store if empty
  const vs = getVectorStore()
  await vs.init()
  let vectorInitCount = 0
  if (vs.size === 0) {
    vectorInitCount = await initializeVectorStore()
  }

  const count = await syncKnowledgeToMemory()
  return NextResponse.json({
    data: {
      syncedRules: count,
      vectorStoreInitialized: vectorInitCount > 0,
      vectorStoreSize: vs.size,
    },
  })
}
