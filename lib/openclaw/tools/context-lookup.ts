import { prisma } from '@/lib/db/prisma'

export async function lookupOrder(orderNo: string) {
  return prisma.mockOrder.findFirst({ where: { orderNo } })
}

export async function lookupProduct(name: string) {
  return prisma.mockProduct.findFirst({
    where: { name: { contains: name } }
  })
}
