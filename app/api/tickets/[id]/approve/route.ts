import { NextRequest, NextResponse } from 'next/server'
import { approveTicket } from '@/lib/customer-service/ticket-processor'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const ticket = await approveTicket(id)
    return NextResponse.json({ data: ticket })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
