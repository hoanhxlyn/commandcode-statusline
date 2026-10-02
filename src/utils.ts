import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'

dayjs.extend(duration)

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'now'
  const d = dayjs.duration(ms)
  const minutes = d.asMinutes()
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${Math.floor(minutes)}m`
  const hours = d.asHours()
  if (hours < 24) return `${Math.floor(hours)}h${d.minutes()}m`
  const days = d.asDays()
  return `${Math.floor(days)}d${d.hours()}h`
}

export function toEpochMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}

export function shortPath(): string {
  const cwd = process.cwd()
  const home = process.env.HOME || ''
  return cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd
}
