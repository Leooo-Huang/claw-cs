import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [today, week, month] = await Promise.all([
    prisma.ticket.count({ where: { channelId: id, createdAt: { gte: todayStart } } }),
    prisma.ticket.count({ where: { channelId: id, createdAt: { gte: weekStart } } }),
    prisma.ticket.count({ where: { channelId: id, createdAt: { gte: monthStart } } }),
  ])

  return NextResponse.json({ data: { today, week, month } })
}
