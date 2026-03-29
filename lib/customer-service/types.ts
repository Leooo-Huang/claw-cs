// lib/customer-service/types.ts

// === 知识规则 ===
export type RuleSource = 'document' | 'conversation' | 'manual' | 'learning'
export type RuleStatus = 'active' | 'pending' | 'deprecated'

export interface KnowledgeRuleData {
  condition: string
  content: string
  tags: string[]
  category?: string
  source: RuleSource
  sourceRef?: string
  confidence: number
}

// === 学习候选 ===
export type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'ignored'

export interface LearningCandidateData {
  ticketId: string
  originalReply: string
  editedReply: string
  diffType: 'semantic' | 'cosmetic'
  extractedCondition: string
  extractedContent: string
  extractedTags: string[]
  confidence: number
}

// === 渠道 ===
export type ChannelType = 'taobao' | 'pinduoduo' | 'shopify' | 'douyin' | 'email' | 'mock'
export type ChannelStatus = 'connected' | 'error' | 'disconnected'

export interface ChannelConfig {
  // 邮箱
  imapServer?: string
  imapPort?: number
  username?: string
  password?: string
  // 电商平台
  accessToken?: string
  shopId?: string
  // 模拟
  mockScenario?: 'presale' | 'aftersale' | 'mixed'
  mockFrequency?: number
}

// === 工单 ===
export type TicketStatus = 'pending' | 'ai_drafting' | 'awaiting_review' | 'replied' | 'failed'

export interface TicketMessage {
  role: 'customer' | 'ai_draft' | 'agent'
  content: string
  timestamp: string
}

export interface AiDraftData {
  reply: string
  intent: string
  sentiment: string
  citedRuleIds: string[]
  reasoning: string
  confidence: number
}

// === SSE 事件 ===
export type CustomerServiceSSEEvent =
  | { type: 'ticket:created'; ticketId: string; channelType?: ChannelType; customerName?: string }
  | { type: 'ticket:ai_generating'; ticketId: string }
  | { type: 'ticket:draft_ready'; ticketId: string; draftData: AiDraftData }
  | { type: 'ticket:replied'; ticketId: string }
  | { type: 'knowledge:synced'; ruleCount: number }
  | { type: 'knowledge:chat_reply'; instanceId: string; result: unknown }
  | { type: 'learning:new_candidate'; candidateId: string; ticketId: string }
  | { type: 'learning:diff_classified'; instanceId: string; result: unknown }

// === API 请求/响应 ===
export interface TicketListQuery {
  status?: TicketStatus
  channelType?: ChannelType
  search?: string
  page?: number
  limit?: number
}

export interface RuleListQuery {
  source?: RuleSource
  status?: RuleStatus
  tags?: string[]
  confidenceMin?: number
  confidenceMax?: number
  search?: string
  page?: number
  limit?: number
}
