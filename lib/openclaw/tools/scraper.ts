export async function mockScrape(url: string): Promise<{
  title: string
  price: number
  imageStyle: string
  salesVolume: number
}> {
  await new Promise(r => setTimeout(r, 500))
  return {
    title: `竞品来自 ${new URL(url).hostname}`,
    price: Math.floor(150 + Math.random() * 300),
    imageStyle: ['户外自然光', '白底平铺', '模特上身'][Math.floor(Math.random() * 3)],
    salesVolume: Math.floor(1000 + Math.random() * 10000),
  }
}
