import { NextRequest, NextResponse } from 'next/server'
import { editAndSendTicket } from '@/lib/customer-service/ticket-processor'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { editedReply } = await req.json()
  const result = await editAndSendTicket(id, editedReply)
  return NextResponse.json({ data: result })
}
