import { describe, expect, it, mock } from 'bun:test'
import type { ModApi } from '@commandcode/harness'
import { ApiClient } from '../api'
import { StateManager } from '../state'

function createMockApi() {
  return {
    exec: mock(async () => ({ stdout: '', stderr: '', code: 0 })),
    ui: {
      capabilities: { status: true },
      setStatus: mock(() => {}),
    },
    on: mock(() => {}),
    hooks: mock(() => {}),
    addCommand: mock(() => {}),
  } as unknown as ModApi
}

describe('ApiClient', () => {
  it('should return empty string when no API key', async () => {
    const state = new StateManager()
    const cmd = createMockApi()
    const api = new ApiClient(state, cmd, () => {})
    const key = await api.readApiKey()
    expect(typeof key).toBe('string')
  })

  it('should return null period initially', () => {
    const state = new StateManager()
    const cmd = createMockApi()
    const api = new ApiClient(state, cmd, () => {})
    expect(api.getPeriod()).toBeNull()
  })

  it('should return empty windows initially', () => {
    const state = new StateManager()
    const cmd = createMockApi()
    const api = new ApiClient(state, cmd, () => {})
    expect(api.getWindows()).toEqual([])
  })

  it('should refresh branch', async () => {
    const state = new StateManager()
    const cmd = createMockApi()
    const api = new ApiClient(state, cmd, () => {})
    await api.refreshBranch()
    expect(typeof state.branch).toBe('string')
  })

  it('should call onRefresh after refreshBranch', async () => {
    const state = new StateManager()
    const cmd = createMockApi()
    const onRefresh = mock(() => {})
    const api = new ApiClient(state, cmd, onRefresh)
    await api.refreshBranch()
    expect(onRefresh).toHaveBeenCalled()
  })
})
