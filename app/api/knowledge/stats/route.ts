import { NextResponse } from 'next/server'
import { getKnowledgeStats } from '@/lib/customer-service/knowledge-store'

export async function GET() {
  const stats = await getKnowledgeStats()
  return NextResponse.json({ data: stats })
}
