'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type ChannelType = 'taobao' | 'pinduoduo' | 'shopify' | 'douyin' | 'email' | 'mock'

interface AddChannelSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

interface Platform {
  type: ChannelType
  icon: string
  label: string
  desc: string
}

const PLATFORMS: Platform[] = [
  { type: 'taobao', icon: '🛒', label: '淘宝', desc: '淘宝 / 天猫店铺消息' },
  { type: 'pinduoduo', icon: '🔶', label: '拼多多', desc: '拼多多店铺消息' },
  { type: 'shopify', icon: '🛍️', label: 'Shopify', desc: '跨境 Shopify 店铺' },
  { type: 'douyin', icon: '🎵', label: '抖店', desc: '抖音电商店铺消息' },
  { type: 'email', icon: '📧', label: '邮箱', desc: '通过 IMAP 接收邮件' },
  { type: 'mock', icon: '🧪', label: '模拟数据', desc: '用于开发测试的模拟渠道' },
]

type Step = 1 | 2 | 3 | 4

const STEP_LABELS = ['选择平台', '配置连接', '测试连接', '完成']

interface FormState {
  name: string
  // email
  imapServer: string
  imapPort: string
  username: string
  password: string
  // mock
  mockScenario: 'presale' | 'aftersale' | 'mixed'
  // others
  accessToken: string
}

const INITIAL_FORM: FormState = {
  name: '',
  imapServer: '',
  imapPort: '993',
  username: '',
  password: '',
  mockScenario: 'mixed',
  accessToken: '',
}

export function AddChannelSheet({ open, onOpenChange, onComplete }: AddChannelSheetProps) {
  const [step, setStep] = useState<Step>(1)
  const [selectedType, setSelectedType] = useState<ChannelType | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [createdChannelId, setCreatedChannelId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleClose = () => {
    // Reset state on close
    setStep(1)
    setSelectedType(null)
    setForm(INITIAL_FORM)
    setCreatedChannelId(null)
    setCreating(false)
    setCreateError(null)
    setTesting(false)
    setTestResult(null)
    onOpenChange(false)
  }

  const handleSelectPlatform = (type: ChannelType) => {
    setSelectedType(type)
    // Pre-fill name with platform label
    const platform = PLATFORMS.find(p => p.type === type)
    setForm(prev => ({ ...prev, name: platform?.label ?? '' }))
    setStep(2)
  }

  const buildConfig = () => {
    if (!selectedType) return {}
    if (selectedType === 'email') {
      return {
        imapServer: form.imapServer,
        imapPort: Number(form.imapPort) || 993,
        username: form.username,
        password: form.password,
      }
    }
    if (selectedType === 'mock') {
      return { mockScenario: form.mockScenario }
    }
    return { accessToken: form.accessToken }
  }

  const handleCreateAndTest = async () => {
    if (!selectedType) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          name: form.name || PLATFORMS.find(p => p.type === selectedType)?.label,
          config: buildConfig(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setCreatedChannelId(data.data.id)
      setStep(3)
      // Auto-run test after creation
      runTest(data.data.id)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '创建失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  const runTest = async (channelId: string) => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/channels/${channelId}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResult(data.data)
    } catch {
      setTestResult({ success: false, message: '请求失败，请检查网络连接' })
    } finally {
      setTesting(false)
    }
  }

  const handleRetryTest = () => {
    if (createdChannelId) runTest(createdChannelId)
  }

  const handleDone = () => {
    onComplete()
    handleClose()
  }

  const isStep2Valid = () => {
    if (!form.name.trim()) return false
    if (selectedType === 'email') {
      return !!(form.imapServer && form.username && form.password)
    }
    return true
  }

  const selectedPlatform = PLATFORMS.find(p => p.type === selectedType)

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>添加渠道</SheetTitle>
          <SheetDescription>
            {selectedPlatform
              ? `${selectedPlatform.icon} ${selectedPlatform.label} — 步骤 ${step}/4：${STEP_LABELS[step - 1]}`
              : `步骤 ${step}/4：${STEP_LABELS[step - 1]}`}
          </SheetDescription>
        </SheetHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-6">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium transition-colors ${
                i + 1 < step
                  ? 'bg-blue-600 text-white'
                  : i + 1 === step
                  ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-600'
                  : 'bg-slate-100 text-slate-400'
              }`}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px w-6 ${i + 1 < step ? 'bg-blue-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select platform */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {PLATFORMS.map(platform => (
              <button
                key={platform.type}
                type="button"
                className="relative flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center group"
                onClick={() => handleSelectPlatform(platform.type)}
              >
                {platform.type !== 'mock' && (
                  <Badge
                    variant="outline"
                    className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0 h-4 bg-slate-100 text-slate-400 border-slate-200"
                  >
                    即将上线
                  </Badge>
                )}
                <span className="text-3xl">{platform.icon}</span>
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{platform.label}</span>
                <span className="text-xs text-slate-400 leading-tight">{platform.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && selectedType && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="channel-name">渠道名称</Label>
              <Input
                id="channel-name"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={`例如：我的${selectedPlatform?.label}店`}
              />
            </div>

            {selectedType === 'email' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="imap-server">IMAP 服务器</Label>
                  <Input
                    id="imap-server"
                    value={form.imapServer}
                    onChange={e => setForm(prev => ({ ...prev, imapServer: e.target.value }))}
                    placeholder="例如：imap.qq.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="imap-port">端口</Label>
                  <Input
                    id="imap-port"
                    value={form.imapPort}
                    onChange={e => setForm(prev => ({ ...prev, imapPort: e.target.value }))}
                    placeholder="993"
                    type="number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-username">邮箱账号</Label>
                  <Input
                    id="email-username"
                    value={form.username}
                    onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="your@email.com"
                    type="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email-password">密码 / 授权码</Label>
                  <Input
                    id="email-password"
                    value={form.password}
                    onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="邮箱密码或应用授权码"
                    type="password"
                  />
                </div>
              </>
            )}

            {selectedType === 'mock' && (
              <div className="space-y-1.5">
                <Label htmlFor="mock-scenario">模拟场景</Label>
                <Select
                  value={form.mockScenario}
                  onValueChange={(v) => {
                    if (v === 'presale' || v === 'aftersale' || v === 'mixed') {
                      setForm(prev => ({ ...prev, mockScenario: v }))
                    }
                  }}
                >
                  <SelectTrigger id="mock-scenario">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presale">售前咨询</SelectItem>
                    <SelectItem value="aftersale">售后服务</SelectItem>
                    <SelectItem value="mixed">混合（售前+售后）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(selectedType === 'taobao' || selectedType === 'pinduoduo' || selectedType === 'shopify' || selectedType === 'douyin') && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 space-y-3">
                <p className="text-sm text-amber-700 font-medium">需要平台授权</p>
                <p className="text-xs text-amber-600">
                  该渠道需要通过 OAuth 授权才能接入。请在开放平台创建应用并获取 Access Token。
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="access-token" className="text-xs text-amber-700">Access Token（测试用）</Label>
                  <Input
                    id="access-token"
                    value={form.accessToken}
                    onChange={e => setForm(prev => ({ ...prev, accessToken: e.target.value }))}
                    placeholder="粘贴 Access Token"
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            {createError && (
              <div className="rounded-md px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-100">
                {createError}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Test */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-6 gap-4">
              {testing ? (
                <>
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                  <p className="text-sm text-slate-600">正在测试连接…</p>
                </>
              ) : testResult ? (
                <>
                  {testResult.success ? (
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  ) : (
                    <XCircle className="w-12 h-12 text-red-400" />
                  )}
                  <div className="text-center">
                    {testResult.success && selectedType !== 'mock' ? (
                      <>
                        <p className="text-sm font-medium text-green-700">渠道配置已保存</p>
                        <p className="text-xs text-slate-500 mt-1">真实消息接入功能即将上线</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-sm font-medium ${testResult.success ? 'text-green-700' : 'text-red-600'}`}>
                          {testResult.success ? '连接成功' : '连接失败'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{testResult.message}</p>
                      </>
                    )}
                  </div>
                  {!testResult.success && (
                    <Button size="sm" variant="outline" onClick={handleRetryTest} className="text-xs">
                      重新测试
                    </Button>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-green-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800">渠道配置完成！</p>
              <p className="text-sm text-slate-500 mt-1">
                {selectedPlatform?.label}渠道已就绪，可开始接收客户消息。
              </p>
            </div>
          </div>
        )}

        {/* Bottom navigation */}
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500"
            onClick={() => {
              if (step === 1) handleClose()
              else if (step === 2) setStep(1)
              // Steps 3 and 4 cannot go back (channel already created)
            }}
            disabled={step === 3 && testing}
          >
            {step <= 2 ? '← 返回' : step === 4 ? '' : ''}
          </Button>

          <div className="flex gap-2">
            {step === 1 && (
              <Button variant="outline" size="sm" onClick={handleClose}>取消</Button>
            )}
            {step === 2 && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleCreateAndTest}
                disabled={creating || !isStep2Valid()}
              >
                {creating && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                {creating ? '创建中...' : '创建并测试 →'}
              </Button>
            )}
            {step === 3 && !testing && testResult && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setStep(4)}
              >
                下一步 →
              </Button>
            )}
            {step === 4 && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleDone}
              >
                完成
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
