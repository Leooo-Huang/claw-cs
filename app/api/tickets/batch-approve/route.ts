import { NextRequest, NextResponse } from 'next/server'
import { batchApprovePreview, batchApproveTickets } from '@/lib/customer-service/ticket-processor'

export async function POST(req: NextRequest) {
  const { ticketIds, preview } = await req.json()

  if (preview) {
    const sampled = await batchApprovePreview(ticketIds)
    return NextResponse.json({ data: sampled })
  }

  const result = await batchApproveTickets(ticketIds)
  return NextResponse.json({ data: result })
}
