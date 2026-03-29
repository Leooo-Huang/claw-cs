import { NextRequest, NextResponse } from 'next/server'
import { reviewCandidate } from '@/lib/customer-service/learning-loop'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { action, editedData } = await req.json()
  const result = await reviewCandidate(id, action, editedData)
  return NextResponse.json({ data: result })
}
