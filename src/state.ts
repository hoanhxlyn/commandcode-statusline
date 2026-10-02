import Conf from 'conf'

interface StateSchema {
  enabled: boolean
}

interface ConfigSchema {
  model?: string
}

const COMMANDCODE_DIR = `${Bun.env.HOME || ''}/.commandcode`

const stateStore = new Conf<StateSchema>({
  cwd: COMMANDCODE_DIR,
  configName: 'statusline.state',
  defaults: { enabled: true },
})

const configStore = new Conf<ConfigSchema>({
  cwd: COMMANDCODE_DIR,
  configName: 'config',
})

export class StateManager {
  modelId = ''
  branch = ''
  readonly problems = new Map<string, string>()

  get enabled(): boolean {
    return stateStore.get('enabled')
  }

  set enabled(value: boolean) {
    stateStore.set('enabled', value)
    this.problems.delete('state')
  }

  fail(where: string, reason: unknown): void {
    this.problems.set(
      where,
      reason instanceof Error ? reason.message : String(reason),
    )
  }

  readConfigModel(): string {
    try {
      const model = configStore.get('model')
      return typeof model === 'string' ? model : ''
    } catch (error) {
      this.fail('config', error)
      return ''
    }
  }
}
