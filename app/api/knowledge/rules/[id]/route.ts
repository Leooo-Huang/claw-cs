import { NextRequest, NextResponse } from 'next/server'
import { updateRule, deprecateRule } from '@/lib/customer-service/knowledge-store'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const rule = await updateRule(id, body)
  return NextResponse.json({ data: rule })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rule = await deprecateRule(id)
  return NextResponse.json({ data: rule })
}
