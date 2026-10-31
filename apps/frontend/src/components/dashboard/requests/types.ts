export const REQUEST_STATUS_VALUES: RequestStatus[] = [
  'draft',
  'in_review',
  'action_needed',
  'approved',
  'rejected',
]

/** Only server-known statuses reach the queue query; anything else is ignored. */
export function parseRequestStatus(value?: string | string[]): RequestStatus | undefined {
  return typeof value === 'string' && (REQUEST_STATUS_VALUES as string[]).includes(value)
    ? (value as RequestStatus)
    : undefined
}

/** Invalid or repeated page parameters return to the first page. */
export function parseRequestPage(value?: string | string[]): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return 1
  const page = Number(value)
  return Number.isSafeInteger(page) && Number.isSafeInteger((page - 1) * 50) ? page : 1
}

export const REVIEW_STAGE_OPTIONS = [
  { value: 'chief_triage', label: 'بررسی اولیه' },
  { value: 'triaged', label: 'داوری' },
  { value: 'advanced', label: 'سرمایه‌گذاری' },
] as const

export type ReviewStageFilter = (typeof REVIEW_STAGE_OPTIONS)[number]['value']

export interface RequestQueueFilters {
  search?: string
  eventId?: string
  stage?: ReviewStageFilter
  queue?: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Malformed values are dropped, as the status is. Whether a queue is the actor's own is the API's decision. */
export function parseRequestFilters(query: {
  search?: string | string[]
  eventId?: string | string[]
  stage?: string | string[]
  queue?: string | string[]
}): RequestQueueFilters {
  const filters: RequestQueueFilters = {}
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : ''
  if (search) filters.search = search
  if (typeof query.eventId === 'string' && UUID.test(query.eventId)) filters.eventId = query.eventId
  const stage = REVIEW_STAGE_OPTIONS.find((option) => option.value === query.stage)
  if (stage) filters.stage = stage.value
  if (typeof query.queue === 'string' && /^[a-z_]{1,64}$/.test(query.queue)) filters.queue = query.queue
  return filters
}

function appendFilters(query: URLSearchParams, filters: RequestQueueFilters) {
  if (filters.search) query.set('search', filters.search)
  if (filters.eventId) query.set('eventId', filters.eventId)
  if (filters.stage) query.set('stage', filters.stage)
  if (filters.queue) query.set('queue', filters.queue)
}

/** The API query string of the filters, starting with `&`, or nothing without any. */
export function requestFiltersQuery(filters: RequestQueueFilters): string {
  const query = new URLSearchParams()
  appendFilters(query, filters)
  return query.size ? `&${query}` : ''
}

export function requestQueueHref(
  basePath: string,
  status?: RequestStatus,
  page = 1,
  filters: RequestQueueFilters = {},
): string {
  const query = new URLSearchParams()
  if (status) query.set('status', status)
  if (page > 1) query.set('page', String(page))
  appendFilters(query, filters)
  return query.size ? `${basePath}?${query}` : basePath
}

export type RequestStatus = 'in_review' | 'action_needed' | 'rejected' | 'draft' | 'approved'

export type RequestAllowedAction =
  | 'read'
  | 'submit'
  | 'assign'
  | 'uploadDocument'
  | 'deleteDocument'

export interface RequestItem {
  id: string
  trackingCode: string
  title: string
  status: RequestStatus
  statusLabel: string
  currentStep: string
  allowedActions: RequestAllowedAction[]
  dueDate: string
  createdDate: string
}

export type RecentRequestStatus = 'draft' | 'in_review' | 'action_needed' | 'approved' | 'rejected'

export type RecentRequestServiceType =
  | 'financing'
  | 'events'
  | 'exhibitions'
  | 'knowledge'
  | 'commercialization'

export interface RecentRequestItem {
  id: string
  trackingCode: string
  title: string
  serviceName: string
  serviceType: RecentRequestServiceType
  currentStep: string
  assignedRole: string
  status: RecentRequestStatus
  submissionDate: string
  updatedAt: string
}
