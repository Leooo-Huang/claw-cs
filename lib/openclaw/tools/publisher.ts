export async function mockPublish(params: {
  channels: string[]
  content: Record<string, unknown>
}): Promise<{ success: boolean; publishedAt: string }> {
  await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000))
  return {
    success: true,
    publishedAt: new Date().toISOString(),
  }
}
