import { describe, expect, it, mock } from 'bun:test'
import type { ModApi } from '@commandcode/harness'
import statusline from '../mod'

function createMockApi() {
  const api = {
    lastStatus: null as string | null,
    exec: mock(async (_opts: { command: string; args?: string[] }) => ({
      stdout: '',
      stderr: '',
      code: 0,
    })),
    ui: {
      capabilities: { status: true },
      setStatus: mock((status: string | null) => {
        api.lastStatus = status
      }),
    },
    on: mock((_event: string, _handler: (event: unknown) => void) => {}),
    hooks: mock(
      (_lifecycle: {
        onSessionStart?: () => void
        onSessionEnd?: () => void
      }) => {},
    ),
    addCommand: mock(
      (_command: {
        name: string
        description: string
        argumentHint?: string
        handler: (ctx: {
          args: string | string[]
        }) => { message: string } | undefined
      }) => {},
    ),
  }
  return api as unknown as ModApi & typeof api
}

describe('statusline', () => {
  it('should register event listeners', () => {
    const api = createMockApi()
    statusline(api)
    expect(api.on).toHaveBeenCalledWith(
      'model_request_start',
      expect.any(Function),
    )
    expect(api.on).toHaveBeenCalledWith('turn_end', expect.any(Function))
    expect(api.on).toHaveBeenCalledWith(
      'config_setting_changed',
      expect.any(Function),
    )
  })

  it('should register lifecycle hooks', () => {
    const api = createMockApi()
    statusline(api)
    expect(api.hooks).toHaveBeenCalledWith({
      onSessionStart: expect.any(Function),
      onSessionEnd: expect.any(Function),
    })
  })

  it('should register statusline command', () => {
    const api = createMockApi()
    statusline(api)
    expect(api.addCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'andrew-statusline',
        description: 'on|off|refresh',
        argumentHint: '[on|off|refresh]',
      }),
    )
  })

  it('should render on session start', () => {
    const api = createMockApi()
    statusline(api)
    const hooks = api.hooks.mock.calls[0] as [{ onSessionStart?: () => void }]
    hooks[0].onSessionStart?.()
    expect(api.ui.setStatus).toHaveBeenCalled()
    expect(api.lastStatus).toContain('~/')
  })

  it('should clear status on session end', () => {
    const api = createMockApi()
    statusline(api)
    const hooks = api.hooks.mock.calls[0] as [{ onSessionEnd?: () => void }]
    hooks[0].onSessionEnd?.()
    expect(api.ui.setStatus).toHaveBeenCalledWith(null)
  })

  it('should handle on/off commands', () => {
    const api = createMockApi()
    statusline(api)
    const calls = api.addCommand.mock.calls[0] as [
      {
        handler: (ctx: {
          args: string | string[]
        }) => { message: string } | undefined
      },
    ]
    const offResult = calls[0].handler({ args: 'off' })
    expect(offResult?.message).toBe('statusline off')
    const onResult = calls[0].handler({ args: 'on' })
    expect(onResult?.message).toBe('statusline on')
  })

  it('should handle refresh command', () => {
    const api = createMockApi()
    statusline(api)
    const calls = api.addCommand.mock.calls[0] as [
      {
        handler: (ctx: {
          args: string | string[]
        }) => { message: string } | undefined
      },
    ]
    const result = calls[0].handler({ args: 'refresh' })
    expect(result?.message).toBe('refreshing...')
  })
})
