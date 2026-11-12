import { toGregorian, toJalali, type JalaliDate } from '@/utilities/jalali'

/**
 * Event times are stored as UTC instants (`YYYY-MM-DDTHH:mm:ss.SSS`, no `Z`) but people
 * enter and read them as a Jalali date and a wall-clock time in Tehran. These helpers
 * convert between the two; the runtime's own time zone never takes part.
 */

export type TehranDateTime = { date: JalaliDate; hour: number; minute: number }

const TEHRAN = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tehran',
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
})

/** The Tehran wall clock at an instant, as the same numbers read as if they were UTC. */
function tehranWallClock(instant: number): number {
  const parts = TEHRAN.formatToParts(new Date(instant))
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  return Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour'), pick('minute'))
}

const parseUtcInput = (value: string): number => Date.parse(`${value}Z`)

/** The Tehran Jalali date and time of a stored UTC value; null when it is empty or invalid. */
export function utcInputToTehran(value: string): TehranDateTime | null {
  const instant = parseUtcInput(value)
  if (!value || !Number.isFinite(instant)) return null
  const wall = new Date(tehranWallClock(instant))
  return {
    date: toJalali(wall.getUTCFullYear(), wall.getUTCMonth() + 1, wall.getUTCDate()),
    hour: wall.getUTCHours(),
    minute: wall.getUTCMinutes(),
  }
}

/**
 * The stored UTC value for a Tehran Jalali date and time. The seconds and milliseconds of
 * `previous` are kept, so changing the minute of a precise time never rounds it.
 */
export function tehranToUtcInput(
  { date, hour, minute }: TehranDateTime,
  previous = '',
): string {
  const gregorian = toGregorian(date.year, date.month, date.day)
  const wall = Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day, hour, minute)
  // Tehran is a fixed +03:30 today; one correction step also follows its earlier daylight saving.
  const guess = wall - 12_600_000
  const instant = guess - (tehranWallClock(guess) - wall)
  const before = parseUtcInput(previous)
  const subMinute = Number.isFinite(before) ? ((before % 60_000) + 60_000) % 60_000 : 0
  return new Date(instant + subMinute).toISOString().replace(/Z$/, '')
}
