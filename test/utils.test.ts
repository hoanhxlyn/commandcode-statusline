import { describe, expect, it } from 'bun:test'
import { formatDuration, shortPath, toEpochMs } from '../src/utils'

describe('formatDuration', () => {
  it('should return "now" for zero or negative', () => {
    expect(formatDuration(0)).toBe('now')
    expect(formatDuration(-1000)).toBe('now')
  })

  it('should format minutes', () => {
    expect(formatDuration(60_000)).toBe('1m')
    expect(formatDuration(30_000)).toBe('<1m')
    expect(formatDuration(59 * 60_000)).toBe('59m')
  })

  it('should format hours and minutes', () => {
    expect(formatDuration(60 * 60_000)).toBe('1h0m')
    expect(formatDuration(90 * 60_000)).toBe('1h30m')
    expect(formatDuration(23 * 60 * 60_000 + 59 * 60_000)).toBe('23h59m')
  })

  it('should format days and hours', () => {
    expect(formatDuration(24 * 60 * 60_000)).toBe('1d0h')
    expect(formatDuration(25 * 60 * 60_000)).toBe('1d1h')
    expect(formatDuration(48 * 60 * 60_000)).toBe('2d0h')
  })
})

describe('toEpochMs', () => {
  it('should return number if finite', () => {
    expect(toEpochMs(1234567890)).toBe(1234567890)
  })

  it('should parse date string', () => {
    const result = toEpochMs('2024-01-01T00:00:00Z')
    expect(result).toBe(Date.parse('2024-01-01T00:00:00Z'))
  })

  it('should return null for invalid input', () => {
    expect(toEpochMs(null)).toBeNull()
    expect(toEpochMs(undefined)).toBeNull()
    expect(toEpochMs('not-a-date')).toBeNull()
    expect(toEpochMs(NaN)).toBeNull()
    expect(toEpochMs(Infinity)).toBeNull()
  })
})

describe('shortPath', () => {
  it('should replace home directory with ~', () => {
    const home = process.env.HOME || ''
    const originalCwd = process.cwd()
    try {
      process.chdir(home)
      expect(shortPath()).toBe('~')
    } finally {
      process.chdir(originalCwd)
    }
  })
})
