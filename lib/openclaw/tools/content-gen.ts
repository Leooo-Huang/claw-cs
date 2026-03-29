import { getMockAssets, AssetCategory } from '@/lib/ai/mock-assets'

export function getGeneratedImages(category: string, count = 3): string[] {
  return getMockAssets(category as AssetCategory, 'poster', count)
}

export function getModelShots(category: string, count = 2): string[] {
  return getMockAssets(category as AssetCategory, 'model-shot', count)
}
