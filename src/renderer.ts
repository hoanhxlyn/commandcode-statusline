import type { ModApi } from '@commandcode/harness'
import pc from 'picocolors'
import type { ApiClient } from './api'
import { C } from './constants'
import type { StateManager } from './state'
import type { UsageWindow } from './types'
import { formatDuration, shortPath } from './utils'

export class Renderer {
  constructor(
    private readonly state: StateManager,
    private readonly api: ApiClient,
    private readonly cmd: ModApi,
  ) {}

  private moneyLeft(w: UsageWindow): number {
    return w.cap && w.cap > 0 ? w.cap - w.used : Infinity
  }

  private bestWindow(): UsageWindow | null {
    const windows = this.api.getWindows()
    const period = this.api.getPeriod()
    if (!windows.length) return null
    const blocked = windows.filter((w) => w.exceeded)
    if (blocked.length) {
      const opensAt = (w: UsageWindow) =>
        Math.min(w.resetAt ?? Infinity, period?.end ?? Infinity)
      return blocked.reduce((latest, c) =>
        opensAt(c) > opensAt(latest) ? c : latest,
      )
    }
    return windows.reduce<UsageWindow | null>(
      (best, c) =>
        !best || this.moneyLeft(c) < this.moneyLeft(best) ? c : best,
      null,
    )
  }

  private budgetText(): string {
    const w = this.bestWindow()
    const period = this.api.getPeriod()
    if (!w) return ''
    if (w.exceeded) {
      const reset = w.resetAt ?? period?.end
      const time = reset ? formatDuration(reset - Date.now()) : null
      return pc.red(`exceeded${time ? `, renews ${time}` : ''}`)
    }
    if (w.cap == null || w.cap <= 0) return ''
    const percent = Math.round(((w.cap - w.used) / w.cap) * 100)
    const time = w.resetAt ? formatDuration(w.resetAt - Date.now()) : null
    return C.budget(`\uf241 ${percent}%${time ? ` (${time})` : ''}`)
  }

  render(): void {
    if (!this.state.enabled || !this.cmd.ui.capabilities.status) {
      this.cmd.ui.setStatus(null)
      return
    }

    const parts: string[] = []

    parts.push(C.path(shortPath()))

    if (this.state.branch) {
      parts.push(`${C.white('on')} ${C.branch(`\ue0a0 ${this.state.branch}`)}`)
    }

    if (this.state.modelId) {
      parts.push(`${C.white('via')} ${C.model(this.state.modelId)}`)
    }

    const budget = this.budgetText()
    if (budget) {
      parts.push(budget)
    }

    if (this.state.problems.size) {
      parts.push(C.budget(`⚠ ${[...this.state.problems.keys()].join(',')}`))
    }

    this.cmd.ui.setStatus(parts.join(' '))
  }
}
