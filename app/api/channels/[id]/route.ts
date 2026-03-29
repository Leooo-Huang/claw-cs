import { NextRequest, NextResponse } from 'next/server'
import { updateChannel, deleteChannel } from '@/lib/customer-service/channel-manager'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const channel = await updateChannel(id, body)
  return NextResponse.json({ data: channel })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const channel = await deleteChannel(id)
  return NextResponse.json({ data: channel })
}
