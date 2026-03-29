import { sendToOpenClaw } from '../client'
import { generateCustomerReply } from '@/lib/ai/claude'

export async function executeCustomerService(params: {
  customerMessage: string
  customerName: string
  orderInfo?: { orderNo?: string; status?: string; product?: string }
  instanceId: string
  nodeId: string
}) {
  const { customerMessage, customerName, orderInfo, instanceId, nodeId } = params

  const result = await sendToOpenClaw('customer-service', { customerMessage, customerName, orderInfo }, instanceId, nodeId)
  if (result.queued) return { queued: true }

  return {
    queued: false,
    result: await generateCustomerReply(customerMessage, customerName, orderInfo)
  }
}
