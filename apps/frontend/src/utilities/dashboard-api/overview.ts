import { type ActivityDto, type RequestStats, type Paginated, dashboardFetch } from './core'

export function getStats(): Promise<RequestStats> {
  return dashboardFetch<RequestStats>('/stats')
}

export function listActivities(params?: {
  page?: number
  limit?: number
}): Promise<Paginated<ActivityDto>> {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return dashboardFetch<Paginated<ActivityDto>>(`/activities${suffix}`)
}
