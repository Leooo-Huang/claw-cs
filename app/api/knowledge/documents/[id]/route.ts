import { NextRequest, NextResponse } from 'next/server'
import { getDocumentChunks, deleteDocument } from '@/lib/customer-service/document-store'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const doc = await prisma.knowledgeDocument.findUnique({ where: { id } })
    if (!doc || doc.status === 'deleted') {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 })
    }

    const chunks = await getDocumentChunks(id)
    return NextResponse.json({ data: { ...doc, chunks } })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '获取文档详情失败' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await deleteDocument(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '删除失败' },
      { status: 500 }
    )
  }
}
