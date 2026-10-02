import { describe, expect, it, mock } from 'bun:test'
import type { ModApi } from '@commandcode/harness'
import { ApiClient } from '../api'
import { Renderer } from '../renderer'
import { StateManager } from '../state'

function createMockApi() {
  return {
    lastStatus: null as string | null,
    exec: mock(async () => ({ stdout: '', stderr: '', code: 0 })),
    ui: {
      capabilities: { status: true },
      setStatus: mock((_status: string | null) => {}),
    },
    on: mock(() => {}),
    hooks: mock(() => {}),
    addCommand: mock(() => {}),
  } as unknown as ModApi & { lastStatus: string | null }
}

describe('Renderer', () => {
  it('should render path', () => {
    const state = new StateManager()
    const cmd = createMockApi()
    const api = new ApiClient(state, cmd, () => {})
    const renderer = new Renderer(state, api, cmd)
    renderer.render()
    expect(cmd.ui.setStatus).toHaveBeenCalled()
  })

  it('should not render when disabled', () => {
    const state = new StateManager()
    state.enabled = false
    const cmd = createMockApi()
    const api = new ApiClient(state, cmd, () => {})
    const renderer = new Renderer(state, api, cmd)
    renderer.render()
    expect(cmd.ui.setStatus).toHaveBeenCalledWith(null)
  })

  it('should include branch when set', () => {
    const state = new StateManager()
    state.enabled = true
    state.branch = 'main'
    const cmd = createMockApi()
    const api = new ApiClient(state, cmd, () => {})
    const renderer = new Renderer(state, api, cmd)
    renderer.render()
    expect(cmd.ui.setStatus).toHaveBeenCalledWith(
      expect.stringContaining('main'),
    )
    state.branch = ''
  })

  it('should include model when set', () => {
    const state = new StateManager()
    state.enabled = true
    state.modelId = 'test-model'
    const cmd = createMockApi()
    const api = new ApiClient(state, cmd, () => {})
    const renderer = new Renderer(state, api, cmd)
    renderer.render()
    expect(cmd.ui.setStatus).toHaveBeenCalledWith(
      expect.stringContaining('test-model'),
    )
    state.modelId = ''
  })

  it('should include problems when set', () => {
    const state = new StateManager()
    state.enabled = true
    state.fail('test', 'error')
    const cmd = createMockApi()
    const api = new ApiClient(state, cmd, () => {})
    const renderer = new Renderer(state, api, cmd)
    renderer.render()
    expect(cmd.ui.setStatus).toHaveBeenCalledWith(
      expect.stringContaining('test'),
    )
    state.problems.delete('test')
  })
})
