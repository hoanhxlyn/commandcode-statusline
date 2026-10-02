export interface UsageWindow {
  label: string
  used: number
  cap: number | null
  resetAt: number | null
  exceeded: boolean
}

export interface BillingPeriod {
  start: number
  end: number
}

export interface ModelRequestStartEvent {
  model?: unknown
}

export interface TurnEndEvent {
  usage?: {
    inputTokens?: unknown
    outputTokens?: unknown
    cacheReadTokens?: unknown
    cacheWriteTokens?: unknown
  }
}

export interface ConfigSettingChangedEvent {
  setting?: unknown
  value?: unknown
}
