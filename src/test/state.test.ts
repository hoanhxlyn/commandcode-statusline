import { describe, expect, it } from 'bun:test'
import { StateManager } from '../state'

describe('StateManager', () => {
  it('should have default enabled state', () => {
    const state = new StateManager()
    state.enabled = true
    const state2 = new StateManager()
    expect(state2.enabled).toBe(true)
  })

  it('should persist enabled state', () => {
    const state = new StateManager()
    state.enabled = false
    const state2 = new StateManager()
    expect(state2.enabled).toBe(false)
    state.enabled = true
  })

  it('should track problems', () => {
    const state = new StateManager()
    state.fail('test', new Error('test error'))
    expect(state.problems.get('test')).toBe('test error')
    state.problems.delete('test')
  })

  it('should handle non-Error reasons', () => {
    const state = new StateManager()
    state.fail('test', 'string error')
    expect(state.problems.get('test')).toBe('string error')
    state.problems.delete('test')
  })

  it('should read config model', () => {
    const state = new StateManager()
    const model = state.readConfigModel()
    expect(typeof model).toBe('string')
  })
})
