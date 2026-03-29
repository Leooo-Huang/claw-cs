import { NextRequest, NextResponse } from 'next/server'
import { listTickets } from '@/lib/customer-service/ticket-processor'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const result = await listTickets({
    status: sp.get('status') as any || undefined,
    channelType: sp.get('channelType') as any || undefined,
    search: sp.get('search') || undefined,
    page: Number(sp.get('page')) || 1,
    limit: Number(sp.get('limit')) || 20,
  })
  return NextResponse.json(result)
}
