import { CONFIG_FILE, STATE_FILE } from './constants'

export class StateManager {
  enabled = true
  modelId = ''
  branch = ''
  readonly problems = new Map<string, string>()

  fail(where: string, reason: unknown): void {
    this.problems.set(
      where,
      reason instanceof Error ? reason.message : String(reason),
    )
  }

  saveState(): void {
    try {
      Bun.write(STATE_FILE, JSON.stringify({ enabled: this.enabled }, null, 2))
      this.problems.delete('state')
    } catch (error) {
      this.fail('state', error)
    }
  }

  async loadState(): Promise<void> {
    try {
      const file = Bun.file(STATE_FILE)
      const saved = JSON.parse(await file.text())
      if (typeof saved.enabled === 'boolean') this.enabled = saved.enabled
    } catch (error) {
      if (!String(error).includes('ENOENT')) this.fail('state', error)
    }
  }

  async readConfigModel(): Promise<string> {
    try {
      const file = Bun.file(CONFIG_FILE)
      const config = JSON.parse(await file.text())
      return typeof config.model === 'string' ? config.model : ''
    } catch (error) {
      this.fail('config', error)
      return ''
    }
  }
}
