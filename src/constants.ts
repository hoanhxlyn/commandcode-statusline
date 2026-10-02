import pc from 'picocolors'

export const C = {
  path: pc.cyan,
  branch: pc.magenta,
  model: pc.green,
  budget: pc.yellow,
  white: pc.white,
} as const

export const MINUTE_MS = 60_000

export const RENDER_INTERVAL_MS = MINUTE_MS
export const REFRESH_INTERVAL_MS = 5 * MINUTE_MS
export const FETCH_TIMEOUT_MS = 8_000

const HOME = Bun.env.HOME || ''
export const STATE_FILE = `${HOME}/.commandcode/statusline.state.json`
export const CONFIG_FILE = `${HOME}/.commandcode/config.json`
export const AUTH_FILE = `${HOME}/.commandcode/auth.json`
