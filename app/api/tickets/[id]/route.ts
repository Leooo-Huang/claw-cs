import { NextRequest, NextResponse } from 'next/server'
import { getTicketDetail } from '@/lib/customer-service/ticket-processor'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getTicketDetail(id)
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: detail })
}
