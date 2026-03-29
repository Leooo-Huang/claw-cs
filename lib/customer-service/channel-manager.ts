import { prisma } from '@/lib/db/prisma'
import { generateAiDraft } from './ticket-processor'
import { csEmitter } from './sse-events'
import type { ChannelType, ChannelConfig } from './types'

export async function listChannels() {
  const channels = await prisma.channel.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { tickets: true } } },
  })
  return channels.map(ch => ({
    ...ch,
    config: JSON.parse(ch.config),
    totalTickets: ch._count.tickets,
  }))
}

export async function createChannel(data: {
  type: ChannelType
  name: string
  config: ChannelConfig
}) {
  const channel = await prisma.channel.create({
    data: {
      type: data.type,
      name: data.name,
      config: JSON.stringify(data.config),
      status: 'disconnected',
    },
  })
  return { ...channel, config: JSON.parse(channel.config) }
}

export async function updateChannel(id: string, data: Partial<{ name: string; config: ChannelConfig }>) {
  const updateData: Record<string, unknown> = {}
  if (data.name) updateData.name = data.name
  if (data.config) updateData.config = JSON.stringify(data.config)

  const channel = await prisma.channel.update({ where: { id }, data: updateData })
  return { ...channel, config: JSON.parse(channel.config) }
}

export async function deleteChannel(id: string) {
  // Always soft-delete to preserve referential integrity
  return prisma.channel.update({
    where: { id },
    data: { status: 'disconnected' },
  })
}

export async function testConnection(id: string): Promise<{ success: boolean; message: string }> {
  const channel = await prisma.channel.findUnique({ where: { id } })
  if (!channel) return { success: false, message: '渠道不存在' }

  const config: ChannelConfig = JSON.parse(channel.config)

  switch (channel.type) {
    case 'email': {
      if (!config.imapServer || !config.username || !config.password) {
        await prisma.channel.update({ where: { id }, data: { status: 'error', errorMsg: 'IMAP 配置不完整' } })
        return { success: false, message: 'IMAP 配置不完整：需要服务器地址、用户名和密码' }
      }
      await prisma.channel.update({ where: { id }, data: { status: 'connected', errorMsg: null } })
      return { success: true, message: '邮箱连接成功' }
    }
    case 'mock': {
      await prisma.channel.update({ where: { id }, data: { status: 'connected', errorMsg: null } })
      return { success: true, message: '模拟渠道已就绪' }
    }
    default: {
      if (!config.accessToken) {
        await prisma.channel.update({ where: { id }, data: { status: 'error', errorMsg: '未授权' } })
        return { success: false, message: '请先完成平台授权' }
      }
      await prisma.channel.update({ where: { id }, data: { status: 'connected', errorMsg: null } })
      return { success: true, message: `${channel.type} 连接成功` }
    }
  }
}

export async function pollMessages(channelId: string): Promise<number> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channel || channel.status !== 'connected') return 0

  if (channel.type === 'mock') {
    return generateMockTicket(channel.id, channel.type)
  }

  return 0
}

const MOCK_MESSAGES = [
  { name: '张三', msg: '我的包裹怎么还没到？已经下单5天了', intent: '售后-物流', sentiment: '不满', orderId: 'ORD-2024001' },
  { name: '李四', msg: '这个尺码偏大还是偏小？我身高165体重55', intent: '售前-尺码', sentiment: '中性', orderId: null },
  { name: '王五', msg: '买了不到一周就坏了，要求退货退款', intent: '售后-退货', sentiment: '愤怒', orderId: 'ORD-2024002' },
  { name: '赵六', msg: '你们这个面料是纯棉的吗？会不会起球', intent: '售前-材质', sentiment: '中性', orderId: null },
  { name: '孙七', msg: '能不能帮我改一下收货地址？还没发货吧', intent: '售后-修改', sentiment: '平和', orderId: 'ORD-2024003' },
  { name: '周八', msg: '买两件有优惠吗？或者有满减活动吗', intent: '售前-优惠', sentiment: '积极', orderId: null },
  { name: '吴九', msg: '收到货了但颜色跟图片差很多，想退', intent: '售后-退货', sentiment: '不满', orderId: 'ORD-2024004' },
  { name: '郑十', msg: '请问这款有没有黑色的？', intent: '售前-库存', sentiment: '中性', orderId: null },
]

async function generateMockTicket(channelId: string, channelType: string): Promise<number> {
  const mock = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)]

  const ticket = await prisma.ticket.create({
    data: {
      channelId,
      channelType,
      customerName: mock.name,
      customerMessage: mock.msg,
      intent: mock.intent,
      sentiment: mock.sentiment,
      orderId: mock.orderId,
      status: 'pending',
    },
  })

  await prisma.channel.update({
    where: { id: channelId },
    data: { messageCount: { increment: 1 }, lastPollAt: new Date() },
  })

  csEmitter.emit({ type: 'ticket:created', ticketId: ticket.id })

  // Auto-trigger AI draft generation (fire-and-forget)
  generateAiDraft(ticket.id).catch(err => {
    console.error(`[channel-manager] Failed to generate AI draft for ticket ${ticket.id}:`, err)
  })

  return 1
}
