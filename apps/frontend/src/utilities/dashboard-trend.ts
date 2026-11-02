/** One row of GET /stats/trend: Tehran calendar day (YYYY-MM-DD) and its counts. */
export interface TrendDayDto {
  day: string
  submitted: number
  approved: number
}

export interface MonthlyTrendPoint {
  /** Persian year * 12 + month index, so months sort and subtract as plain numbers. */
  key: number
  label: string
  submitted: number
  approved: number
}

export const PERSIAN_MONTHS = [
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

const persianParts = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
  year: 'numeric',
  month: 'numeric',
  timeZone: 'Asia/Tehran',
})

function persianMonthKey(date: Date): number {
  const parts = persianParts.formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  return year * 12 + (month - 1)
}

/** Midday UTC keeps a Tehran calendar day on the same Jalali date at either offset. */
function dayToDate(day: string): Date {
  return new Date(`${day}T12:00:00Z`)
}

/**
 * Buckets per-day counts into the last `months` Jalali months, oldest first. Months with
 * no submissions stay in the series as zeros so the chart axis never skips one.
 */
export function monthlyTrend(
  days: readonly TrendDayDto[],
  now: Date = new Date(),
  months = 6,
): MonthlyTrendPoint[] {
  const current = persianMonthKey(now)
  const points: MonthlyTrendPoint[] = Array.from({ length: months }, (_, index) => {
    const key = current - (months - 1 - index)
    return { key, label: PERSIAN_MONTHS[((key % 12) + 12) % 12], submitted: 0, approved: 0 }
  })
  for (const day of days) {
    const point = points.find((candidate) => candidate.key === persianMonthKey(dayToDate(day.day)))
    if (!point) continue
    point.submitted += day.submitted
    point.approved += day.approved
  }
  return points
}

/** Whole-number percentage change from `previous` to `current`; undefined when there is no base. */
export function percentChange(current: number, previous: number): number | undefined {
  if (previous <= 0) return undefined
  return Math.round(((current - previous) / previous) * 100)
}
