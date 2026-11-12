const jalaliDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** A timestamp as a Jalali date with Persian digits (`۱۴۰۵/۰۸/۲۰`); today when empty. */
export const formatDateTime = (timestamp: string): string => {
  const date = timestamp ? new Date(timestamp) : new Date()
  return Number.isNaN(date.getTime()) ? '' : jalaliDate.format(date)
}
