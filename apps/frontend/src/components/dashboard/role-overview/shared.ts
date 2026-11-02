import type { WorkQueueCountDto } from '@/utilities/dashboard-api'

export const fa = (value: number) => value.toLocaleString('fa-IR')
export const UNAVAILABLE = '—'
export const READ_FAILED = 'دریافت اطلاعات انجام نشد'

const todayFormat = new Intl.DateTimeFormat('fa-IR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Tehran',
})

export function greeting(userName: string | null | undefined, now: Date): string {
  return `${userName ? `سلام ${userName}، ` : 'سلام، '}امروز ${todayFormat.format(now)} است.`
}

/** A queue's count, or undefined when the overview could not be read (never a made-up zero). */
export function queueCount(
  queues: readonly WorkQueueCountDto[] | undefined,
  key: string,
): number | undefined {
  if (!queues) return undefined
  return queues.find((queue) => queue.key === key)?.count ?? 0
}

export const countText = (value: number | undefined) =>
  value === undefined ? UNAVAILABLE : fa(value)
