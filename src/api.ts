import { readFile } from 'node:fs/promises'
import type { ModApi } from '@commandcode/harness'
import { createApiClient } from './config'
import { AUTH_FILE } from './constants'
import type { StateManager } from './state'
import type { BillingPeriod, UsageWindow } from './types'
import { toEpochMs } from './utils'

interface WhoamiResponse {
  orgId?: string
  user?: { orgId?: string }
  org?: { id?: string }
  data?: { orgId?: string }
}

interface SubscriptionResponse {
  data?: {
    currentPeriodStart?: string | number
    currentPeriodEnd?: string | number
  }
  currentPeriodStart?: string | number
  currentPeriodEnd?: string | number
}

interface WindowLimit {
  used?: number
  cap?: number
  resetAt?: string | number
  exceeded?: boolean
}

interface WindowLimits {
  fiveHour?: WindowLimit
  weekly?: WindowLimit
}

interface MonthlyCredits {
  used?: number
  cap?: number
  resetAt?: string | number
}

interface CreditsData {
  windowLimits?: WindowLimits
  monthlyCredits?: MonthlyCredits | number
}

interface CreditsResponse {
  credits?: CreditsData
  data?: CreditsData
  windowLimits?: WindowLimits
}

interface UsageSummaryResponse {
  totalCost?: number
  data?: { totalCost?: number }
  summary?: { totalCost?: number }
}

export class ApiClient {
  private period: BillingPeriod | null = null
  private windows: UsageWindow[] = []

  constructor(
    private readonly state: StateManager,
    private readonly cmd: ModApi,
    private readonly onRefresh: () => void,
  ) {}

  async readApiKey(): Promise<string> {
    if (process.env.COMMAND_CODE_API_KEY)
      return process.env.COMMAND_CODE_API_KEY
    try {
      const auth = JSON.parse(await readFile(AUTH_FILE, 'utf-8'))
      return typeof auth.apiKey === 'string' ? auth.apiKey : ''
    } catch (error) {
      this.state.fail('auth', error)
      return ''
    }
  }

  getPeriod(): BillingPeriod | null {
    return this.period
  }

  getWindows(): UsageWindow[] {
    return this.windows
  }

  async refreshUsage(): Promise<void> {
    const apiKey = await this.readApiKey()
    if (!apiKey) {
      this.state.fail('auth', 'no apiKey')
      this.onRefresh()
      return
    }
    this.state.problems.delete('auth')

    const client = createApiClient(apiKey)

    let orgId = ''
    try {
      const { data: whoami } = await client.get<WhoamiResponse>('/alpha/whoami')
      orgId =
        whoami.orgId ??
        whoami.user?.orgId ??
        whoami.org?.id ??
        whoami.data?.orgId ??
        ''
    } catch {}
    const orgQuery = orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''

    try {
      const { data: subscription } = await client.get<SubscriptionResponse>(
        `/alpha/billing/subscriptions${orgQuery}`,
      )
      const billing = subscription.data ?? subscription
      const start = toEpochMs(billing.currentPeriodStart)
      const end = toEpochMs(billing.currentPeriodEnd)
      this.period =
        start != null && end != null && end > start ? { start, end } : null
      this.state.problems.delete('period')
    } catch (error) {
      this.state.fail('period', error)
    }

    const next: UsageWindow[] = []
    try {
      const { data: raw } = await client.get<CreditsResponse>(
        `/alpha/billing/credits${orgQuery}`,
      )
      const credits: CreditsData = raw.credits ?? raw.data ?? raw
      const windowLimits = credits.windowLimits ?? raw.windowLimits
      for (const [label, field] of [
        ['5h', 'fiveHour'],
        ['1w', 'weekly'],
      ] as const) {
        const limit = windowLimits?.[field]
        if (!limit || typeof limit.used !== 'number') continue
        next.push({
          label,
          used: limit.used,
          cap: typeof limit.cap === 'number' ? limit.cap : null,
          resetAt: toEpochMs(limit.resetAt),
          exceeded: limit.exceeded === true,
        })
      }

      const monthly = credits.monthlyCredits ?? raw.credits?.monthlyCredits
      if (monthly != null) {
        let used = NaN
        let cap: number | null = null
        let remaining: number | null = null
        let resetAt: number | null = null
        if (typeof monthly === 'object') {
          used = Number(monthly.used)
          cap = typeof monthly.cap === 'number' ? monthly.cap : null
          resetAt = toEpochMs(monthly.resetAt)
        } else {
          remaining = Number(monthly)
        }
        if (!Number.isFinite(used)) {
          try {
            const { data: summary } = await client.get<UsageSummaryResponse>(
              `/alpha/usage/summary${orgQuery}`,
            )
            used = Number(
              summary.totalCost ??
                summary.data?.totalCost ??
                summary.summary?.totalCost,
            )
            this.state.problems.delete('summary')
          } catch (error) {
            this.state.fail('summary', error)
          }
        }
        if (remaining != null && Number.isFinite(used)) cap = used + remaining
        if (!resetAt) resetAt = this.period?.end ?? null
        const exceeded =
          remaining != null ? remaining <= 0 : cap != null && used >= cap
        if (Number.isFinite(used))
          next.push({ label: '1m', used, cap, resetAt, exceeded })
      }
    } catch (error) {
      this.state.fail('credits', error)
      this.onRefresh()
      return
    }
    this.state.problems.delete('credits')
    this.windows = next
    this.onRefresh()
  }

  async refreshBranch(): Promise<void> {
    try {
      const named = await this.cmd.exec({
        command: 'git',
        args: ['branch', '--show-current'],
      })
      this.state.branch = named.stdout.trim()
      if (!this.state.branch) {
        const detached = await this.cmd.exec({
          command: 'git',
          args: ['rev-parse', '--short', 'HEAD'],
        })
        this.state.branch =
          detached.code === 0 ? `@${detached.stdout.trim()}` : ''
      }
    } catch {
      this.state.branch = ''
    }
    this.onRefresh()
  }
}
