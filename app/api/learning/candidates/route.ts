import { NextRequest, NextResponse } from 'next/server'
import { listCandidates, batchReviewCandidates } from '@/lib/customer-service/learning-loop'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const result = await listCandidates(
    sp.get('status') || undefined,
    Number(sp.get('page')) || 1,
    Number(sp.get('limit')) || 20,
  )
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { ids, action } = await req.json()
  const results = await batchReviewCandidates(ids, action)
  return NextResponse.json({ data: results })
}
