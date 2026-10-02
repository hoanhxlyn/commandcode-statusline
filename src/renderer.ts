import type { ModApi } from '@commandcode/harness'
import pc from 'picocolors'
import { filter, first, isTruthy, join, last, pipe, reduce, sortBy } from 'remeda'
import type { ApiClient } from './api'
import { C } from './constants'
import type { StateManager } from './state'
import type { UsageWindow } from './types'
import { formatDuration, shortPath, terminalWidth } from './utils'

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

    const blocked = pipe(
      windows,
      filter((w) => w.exceeded),
      first(),
    )
    if (blocked) {
      return (
        pipe(
          windows,
          filter((w) => w.exceeded),
          sortBy((w) =>
            Math.min(w.resetAt ?? Infinity, period?.end ?? Infinity),
          ),
          last(),
        ) ?? null
      )
    }

    return (
      pipe(
        windows,
        sortBy((w) => this.moneyLeft(w)),
        first(),
      ) ?? null
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

  private visibleLen(s: string): number {
    return s.replace(/\x1b\[[0-9;]*m/g, '').length
  }

  render(): void {
    if (!this.state.enabled || !this.cmd.ui.capabilities.status) {
      this.cmd.ui.setStatus(null)
      return
    }

    const cols = terminalWidth()
    const budget = this.budgetText()

    const candidates = [
      this.state.problems.size
        ? C.budget(`⚠ ${pipe([...this.state.problems.keys()], join(','))}`)
        : '',
      budget,
      C.path(shortPath()),
      this.state.branch
        ? `${C.white('on')} ${C.branch(`\ue0a0 ${this.state.branch}`)}`
        : '',
      this.state.modelId
        ? `${C.white('via')} ${C.model(this.state.modelId)}`
        : '',
    ]

    this.cmd.ui.setStatus(
      pipe(
        candidates,
        filter(isTruthy),
        reduce(
          (acc, part) => {
            const len = this.visibleLen(part)
            const add = acc.len > 0 ? 1 : 0
            if (acc.len + add + len > cols) return acc
            return { len: acc.len + add + len, parts: [...acc.parts, part] }
          },
          { len: 0, parts: [] as string[] },
        ),
        ({ parts }) => parts.join(' '),
      ),
    )
  }
}
