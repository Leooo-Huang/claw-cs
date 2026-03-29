import { NextRequest, NextResponse } from 'next/server'
import { rejectTicket } from '@/lib/customer-service/ticket-processor'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await rejectTicket(id)
  return NextResponse.json({ data: result })
}
