import { toEnglishDigits, toPersianDigits } from '@/utilities/digits'

/**
 * Minimal Jalali (Shamsi) calendar arithmetic: conversion to and from the
 * Gregorian calendar, month lengths and the formatting the forms store.
 * The conversion follows the 33-year-cycle algorithm of jalaali-js (valid for
 * Jalali years -61 to 3177). Calendar days are plain integers; no `Date` is
 * built from a Jalali string, so the runtime's time zone never shifts a day.
 */

export type JalaliDate = { year: number; month: number; day: number }

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const

/** Saturday-first, as the Iranian week starts. */
export const JALALI_WEEKDAYS = [
  { short: 'ش', full: 'شنبه' },
  { short: 'ی', full: 'یکشنبه' },
  { short: 'د', full: 'دوشنبه' },
  { short: 'س', full: 'سه‌شنبه' },
  { short: 'چ', full: 'چهارشنبه' },
  { short: 'پ', full: 'پنجشنبه' },
  { short: 'ج', full: 'جمعه' },
] as const

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
] as const

const div = (a: number, b: number) => Math.trunc(a / b)
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const last = BREAKS.length - 1
  if (jy < BREAKS[0] || jy >= BREAKS[last]!) throw new RangeError(`Invalid Jalali year ${jy}`)
  const gy = jy + 621
  let leapJ = -14
  let jp: number = BREAKS[0]
  let jump = 0
  for (let index = 1; index <= last; index += 1) {
    const jm = BREAKS[index]!
    jump = jm - jp
    if (jy < jm) break
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  let n = jy - jp
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return { leap, gy, march }
}

function gregorianToDayNumber(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

function dayNumberToGregorian(dayNumber: number): { year: number; month: number; day: number } {
  let j = 4 * dayNumber + 139361631
  j += div(div(4 * dayNumber + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const day = div(mod(i, 153), 5) + 1
  const month = mod(div(i, 153), 12) + 1
  const year = div(j, 1461) - 100100 + div(8 - month, 6)
  return { year, month, day }
}

function jalaliToDayNumber(year: number, month: number, day: number): number {
  const { gy, march } = jalCal(year)
  return (
    gregorianToDayNumber(gy, 3, march) + (month - 1) * 31 - div(month, 7) * (month - 7) + day - 1
  )
}

function dayNumberToJalali(dayNumber: number): JalaliDate {
  const gy = dayNumberToGregorian(dayNumber).year
  let year = gy - 621
  const r = jalCal(year)
  const firstOfFarvardin = gregorianToDayNumber(gy, 3, r.march)
  let k = dayNumber - firstOfFarvardin
  if (k >= 0) {
    if (k <= 185) return { year, month: 1 + div(k, 31), day: mod(k, 31) + 1 }
    k -= 186
  } else {
    year -= 1
    k += 179
    if (r.leap === 1) k += 1
  }
  return { year, month: 7 + div(k, 30), day: mod(k, 30) + 1 }
}

export function toJalali(gregorianYear: number, gregorianMonth: number, gregorianDay: number) {
  return dayNumberToJalali(gregorianToDayNumber(gregorianYear, gregorianMonth, gregorianDay))
}

export function toGregorian(year: number, month: number, day: number) {
  return dayNumberToGregorian(jalaliToDayNumber(year, month, day))
}

export function isJalaliLeapYear(year: number): boolean {
  return jalCal(year).leap === 0
}

export function jalaliMonthLength(year: number, month: number): number {
  if (month <= 6) return 31
  if (month <= 11) return 30
  return isJalaliLeapYear(year) ? 30 : 29
}

export function isValidJalaliDate({ year, month, day }: JalaliDate): boolean {
  if (![year, month, day].every(Number.isInteger)) return false
  if (year < 1 || year > 3000 || month < 1 || month > 12 || day < 1) return false
  return day <= jalaliMonthLength(year, month)
}

/** 0 for Saturday through 6 for Friday. */
export function jalaliWeekdayIndex(year: number, month: number, day: number): number {
  return (jalaliToDayNumber(year, month, day) + 2) % 7
}

export function compareJalali(left: JalaliDate, right: JalaliDate): number {
  return left.year - right.year || left.month - right.month || left.day - right.day
}

/** The Jalali calendar day it currently is in Tehran, whatever the runtime's time zone. */
export function todayJalali(now: Date = new Date()): JalaliDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return toJalali(pick('year'), pick('month'), pick('day'))
}

/** The stored form: `YYYY/MM/DD` with ASCII digits. */
export function formatJalali({ year, month, day }: JalaliDate): string {
  return `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

/** The display form: the same date with Persian digits. */
export function formatJalaliDisplay(date: JalaliDate): string {
  return toPersianDigits(formatJalali(date))
}

/** Parses `YYYY/MM/DD` (also `-` or `.`, any digit script); null unless a real Jalali date. */
export function parseJalali(value: string): JalaliDate | null {
  const match = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(toEnglishDigits(value.trim()))
  if (!match) return null
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  return isValidJalaliDate(date) ? date : null
}

/** Completed years from a Jalali date to `now` (Tehran's today); null when it lies in the future. */
export function jalaliAgeInYears(from: JalaliDate, now: JalaliDate = todayJalali()): number | null {
  if (compareJalali(from, now) > 0) return null
  const birthdayPassed = now.month > from.month || (now.month === from.month && now.day >= from.day)
  return now.year - from.year - (birthdayPassed ? 0 : 1)
}
