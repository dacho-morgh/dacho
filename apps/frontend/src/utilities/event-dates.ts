/** A Persian-calendar date range («۱۲ بهمن ۱۴۰۵ تا ۱۵ بهمن ۱۴۰۵»), as the event cards show it. */
export function formatEventDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return 'تاریخ ثبت نشده است'
  const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const first = formatter.format(new Date(start))
  if (!end) return first
  return `${first} تا ${formatter.format(new Date(end))}`
}
