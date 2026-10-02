import type { ModApi } from '@commandcode/harness'
import { ApiClient } from './api'
import { REFRESH_INTERVAL_MS, RENDER_INTERVAL_MS } from './constants'
import { Renderer } from './renderer'
import { StateManager } from './state'
import type {
  ConfigSettingChangedEvent,
  ModelRequestStartEvent,
  TurnEndEvent,
} from './types'

export default function (cmd: ModApi): void {
  const state = new StateManager()
  const api = new ApiClient(state, cmd, () => renderer.render())
  const renderer = new Renderer(state, api, cmd)

  cmd.on('model_request_start', (event: ModelRequestStartEvent) => {
    const requested = typeof event?.model === 'string' ? event.model : ''
    if (!requested || requested === state.modelId) return
    state.modelId = requested
    renderer.render()
  })

  cmd.on('turn_end', (_event: TurnEndEvent) => {
    renderer.render()
  })

  cmd.on('config_setting_changed', (event: ConfigSettingChangedEvent) => {
    const setting = typeof event?.setting === 'string' ? event.setting : ''
    const value = typeof event?.value === 'string' ? event.value : ''
    if (/^model$/i.test(setting) && value) {
      state.modelId = value
      renderer.render()
    }
  })

  cmd.hooks({
    onSessionStart: () => {
      if (!state.modelId) state.modelId = state.readConfigModel()
      renderer.render()
      void api.refreshUsage()
      void api.refreshBranch()
    },
    onSessionEnd: () => cmd.ui.setStatus(null),
  })

  cmd.addCommand({
    name: 'andrew-statusline',
    description: 'on|off|refresh',
    argumentHint: '[on|off|refresh]',
    handler: ({ args }) => {
      const command = (typeof args === 'string' ? args : '')
        .trim()
        .toLowerCase()
      if (command === 'off') {
        state.enabled = false
        renderer.render()
        return { message: 'statusline off' }
      }
      if (command === 'on') {
        state.enabled = true
        renderer.render()
        return { message: 'statusline on' }
      }
      if (command === 'refresh') {
        void api.refreshUsage()
        void api.refreshBranch()
        return { message: 'refreshing...' }
      }
      return {
        message: `statusline ${state.enabled ? 'on' : 'off'} · /statusline on|off|refresh`,
      }
    },
  })

  if (cmd.ui.capabilities.status) {
    const renderTimer = setInterval(() => renderer.render(), RENDER_INTERVAL_MS)
    const refreshTimer = setInterval(() => {
      void api.refreshUsage()
      void api.refreshBranch()
    }, REFRESH_INTERVAL_MS)
    renderTimer.unref?.()
    refreshTimer.unref?.()
  }
}
