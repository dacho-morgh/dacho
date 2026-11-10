import { describe, expect, it } from 'vitest'
import {
  formatJalali,
  formatJalaliDisplay,
  isValidJalaliDate,
  jalaliMonthLength,
  jalaliWeekdayIndex,
  parseJalali,
  toGregorian,
  toJalali,
  todayJalali,
} from '@/utilities/jalali'

const icu = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

describe('Jalali calendar utilities (#278, shared with #261)', () => {
  it('agrees with ICU for every third day from 1900 to 2100, in both directions and by weekday', () => {
    const mismatches: string[] = []
    for (let time = Date.UTC(1900, 0, 1); time < Date.UTC(2100, 0, 1); time += 3 * 86_400_000) {
      const date = new Date(time + 43_200_000)
      const parts = icu.formatToParts(date)
      const part = (type: string) => Number(parts.find((candidate) => candidate.type === type)?.value)
      const gregorian = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()] as const
      const jalali = toJalali(...gregorian)
      const back = toGregorian(jalali.year, jalali.month, jalali.day)
      // 0 is Saturday; Date#getUTCDay has Sunday as 0.
      const weekday = (date.getUTCDay() + 1) % 7
      if (
        jalali.year !== part('year') ||
        jalali.month !== part('month') ||
        jalali.day !== part('day') ||
        [back.year, back.month, back.day].join() !== gregorian.join() ||
        jalaliWeekdayIndex(jalali.year, jalali.month, jalali.day) !== weekday
      ) {
        mismatches.push(date.toISOString())
      }
    }
    expect(mismatches).toEqual([])
  })

  it('knows leap years and month lengths', () => {
    expect(jalaliMonthLength(1403, 12)).toBe(30)
    expect(jalaliMonthLength(1404, 12)).toBe(29)
    expect(jalaliMonthLength(1404, 6)).toBe(31)
    expect(jalaliMonthLength(1404, 7)).toBe(30)
  })

  it('validates, formats and parses stored dates in any digit script', () => {
    expect(isValidJalaliDate({ year: 1404, month: 12, day: 30 })).toBe(false)
    expect(isValidJalaliDate({ year: 1403, month: 12, day: 30 })).toBe(true)
    expect(formatJalali({ year: 1388, month: 8, day: 5 })).toBe('1388/08/05')
    expect(formatJalaliDisplay({ year: 1388, month: 8, day: 5 })).toBe('۱۳۸۸/۰۸/۰۵')
    expect(parseJalali('۱۳۸۸/۸/۵')).toEqual({ year: 1388, month: 8, day: 5 })
    expect(parseJalali('1398-01-01')).toEqual({ year: 1398, month: 1, day: 1 })
    expect(parseJalali('1404/13/01')).toBeNull()
    expect(parseJalali('2020-01-01')).toEqual({ year: 2020, month: 1, day: 1 })
    expect(parseJalali('1375')).toBeNull()
  })

  it('reads today in Tehran, not in the runtime zone', () => {
    // 20:30 UTC on 20 March 2026 is already 00:00 on 21 March in Tehran (UTC+3:30),
    // which is 1 Farvardin 1405.
    expect(todayJalali(new Date(Date.UTC(2026, 2, 20, 20, 30)))).toEqual({
      year: 1405,
      month: 1,
      day: 1,
    })
    expect(todayJalali(new Date(Date.UTC(2026, 2, 20, 20, 29)))).toEqual({
      year: 1404,
      month: 12,
      day: 29,
    })
  })
})
