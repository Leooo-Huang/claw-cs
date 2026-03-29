import { NextRequest, NextResponse } from 'next/server'
import { testConnection } from '@/lib/customer-service/channel-manager'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await testConnection(id)
  return NextResponse.json({ data: result })
}
