import { NextRequest, NextResponse } from 'next/server'
import { pollMessages } from '@/lib/customer-service/channel-manager'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const count = await pollMessages(id)
  return NextResponse.json({ data: { messagesReceived: count } })
}
