export interface QuickReply {
  id: string
  label: string
  text: string
}

export const QUICK_REPLIES: QuickReply[] = [
  {
    id: 'greeting',
    label: '问候语',
    text: '您好，感谢您的咨询！请问有什么可以帮您的？',
  },
  {
    id: 'wait',
    label: '请稍等',
    text: '请您稍等片刻，我正在为您查询相关信息。',
  },
  {
    id: 'refund-policy',
    label: '退货政策',
    text: '我们支持7天无理由退货，请在订单详情页申请退货，退货运费由我们承担。',
  },
  {
    id: 'shipping-check',
    label: '物流查询',
    text: '您好，我已为您查询物流信息，包裹正在配送中，预计1-2天内送达。如有延迟请联系我们。',
  },
  {
    id: 'thanks',
    label: '感谢反馈',
    text: '感谢您的反馈，我们会持续改进服务。如有其他问题，随时联系我们。',
  },
  {
    id: 'escalate',
    label: '转人工',
    text: '非常抱歉给您带来不便，我已为您转接人工客服，请稍等片刻。',
  },
]
