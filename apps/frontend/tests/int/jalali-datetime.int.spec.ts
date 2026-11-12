import { describe, expect, it } from 'vitest'
import { tehranToUtcInput, utcInputToTehran } from '@/utilities/jalali-datetime'

describe('Jalali date and Tehran time of a UTC instant', () => {
  it('reads a UTC instant as the Tehran wall clock (+03:30)', () => {
    // 2026-11-11T08:00Z is 11:30 in Tehran, 1405/08/20.
    expect(utcInputToTehran('2026-11-11T08:00:00.000')).toEqual({
      date: { year: 1405, month: 8, day: 20 },
      hour: 11,
      minute: 30,
    })
  })

  it('moves to the next Jalali day when Tehran passes midnight', () => {
    expect(utcInputToTehran('2026-11-11T21:00:00.000')).toEqual({
      date: { year: 1405, month: 8, day: 21 },
      hour: 0,
      minute: 30,
    })
  })

  it('returns null for an empty or invalid value', () => {
    expect(utcInputToTehran('')).toBeNull()
    expect(utcInputToTehran('نامعتبر')).toBeNull()
  })

  it('stores a Tehran Jalali date and time as the UTC instant', () => {
    expect(tehranToUtcInput({ date: { year: 1405, month: 8, day: 20 }, hour: 11, minute: 30 })).toBe(
      '2026-11-11T08:00:00.000',
    )
    expect(tehranToUtcInput({ date: { year: 1405, month: 8, day: 21 }, hour: 0, minute: 30 })).toBe(
      '2026-11-11T21:00:00.000',
    )
  })

  it('keeps the seconds and milliseconds of the previous value', () => {
    expect(
      tehranToUtcInput({ date: { year: 1405, month: 8, day: 20 }, hour: 12, minute: 30 }, '2026-11-11T08:00:31.250'),
    ).toBe('2026-11-11T09:00:31.250')
  })

  it('round-trips every hour of a year to the minute', () => {
    for (let hours = 0; hours < 24 * 366; hours += 5) {
      const utc = new Date(Date.UTC(2030, 0, 1) + hours * 3_600_000 + 17 * 60_000).toISOString().replace(/Z$/, '')
      const tehran = utcInputToTehran(utc)!
      expect(tehranToUtcInput(tehran, utc)).toBe(utc)
    }
  })
})
