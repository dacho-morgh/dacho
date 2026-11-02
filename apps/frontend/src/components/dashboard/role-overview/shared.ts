import type { DashboardOverviewDto, WorkQueueCountDto } from '@/utilities/dashboard-api'

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

export interface ChartSliceDto {
  key: string
  count: number
}

/** GET /stats/overview as the role boards read it: the core counts plus each role's chart series. */
export interface RoleOverviewDto extends DashboardOverviewDto {
  charts?: { key: string; slices: ChartSliceDto[] }[]
  /** Sections the server could not read. Their queues and charts are missing, not zero. */
  unavailable?: string[]
}

/** A chart's series by key, or undefined when the overview or that section could not be read. */
export function chartOf(
  overview: RoleOverviewDto | undefined,
  key: string,
): Record<string, number> | undefined {
  const chart = overview?.charts?.find((item) => item.key === key)
  if (!chart) return undefined
  return Object.fromEntries(chart.slices.map((slice) => [slice.key, slice.count]))
}

/** Whether a section the server reads on its own failed, so its numbers must not render as zero. */
export const sectionFailed = (overview: RoleOverviewDto | undefined, key: string) =>
  overview?.unavailable?.includes(key) ?? false
