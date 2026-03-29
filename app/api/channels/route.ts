import { NextRequest, NextResponse } from 'next/server'
import { listChannels, createChannel } from '@/lib/customer-service/channel-manager'

export async function GET() {
  const channels = await listChannels()
  return NextResponse.json({ data: channels })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const channel = await createChannel(body)
  return NextResponse.json({ data: channel })
}
