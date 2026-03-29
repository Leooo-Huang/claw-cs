import { NextRequest, NextResponse } from 'next/server'
import { listDocuments, storeDocument } from '@/lib/customer-service/document-store'

export async function GET() {
  try {
    const docs = await listDocuments()
    return NextResponse.json({ data: docs })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '获取文档列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const sourceType = (formData.get('sourceType') as string) || 'other'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'txt'

    const doc = await storeDocument(file.name, ext, buffer, sourceType)
    return NextResponse.json({ data: doc })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '上传失败' },
      { status: 500 }
    )
  }
}
