const PERSIAN = 'fa-IR-u-ca-persian'

/** One date as its Persian parts; `null` for a value that is not a date. */
function persianParts(value: string): { day: string; month: string; year: string } | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat(PERSIAN, { year: 'numeric', month: 'long', day: 'numeric' }).formatToParts(date)
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return { day: pick('day'), month: pick('month'), year: pick('year') }
}

/**
 * The held dates of an event as the request card shows them (Figma 49:7968): «۱۲–۱۵ بهمن ۱۴۰۵» inside one
 * month, the two full dates joined with «تا» otherwise, a single date when there is no end. Empty when the
 * start is unknown.
 */
export function formatEventDateRange(start: string | null | undefined, end?: string | null): string {
  const from = start ? persianParts(start) : null
  if (!from) return ''
  const to = end ? persianParts(end) : null
  if (!to || (to.day === from.day && to.month === from.month && to.year === from.year)) {
    return `${from.day} ${from.month} ${from.year}`
  }
  if (to.month === from.month && to.year === from.year) return `${from.day}–${to.day} ${from.month} ${from.year}`
  return `${from.day} ${from.month} ${from.year} تا ${to.day} ${to.month} ${to.year}`
}
