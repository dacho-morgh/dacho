// Client-side data layer for the `/api/dashboard/*` proxy. Replaces the
// hardcoded mock data with typed reads of the backend domain. Pure mappers
// (labels + dates) live here so they are unit-testable; the fetch helpers are
// thin wrappers over the same-origin proxy (the browser forwards the session).

import type { RequestItem } from '@/components/dashboard/requests/types'
import type { LetterItem } from '@/components/dashboard/inbox-list-view'
import type { MailData } from '@/components/dashboard/mail-detail-view'

export type RequestStatus = 'draft' | 'in_review' | 'action_needed' | 'approved' | 'rejected'
export type LetterType = 'rejected' | 'approved' | 'needs_fix' | 'official' | 'notification'

export interface RequestDto {
  id: string
  trackingCode: string
  title: string
  serviceId: string
  serviceKey: string
  serviceName: string
  ownerId: string
  status: RequestStatus
  currentStepIndex: number
  assignedRole: string | null
  currentStep: string | null
  answers: Record<string, unknown>
  submissionDate: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
  allowedActions?: ('read' | 'submit' | 'assign' | 'uploadDocument' | 'deleteDocument')[]
}

export interface LetterDto {
  id: string
  type: LetterType
  title: string
  body: string
  senderId: string | null
  senderName: string | null
  senderRole: string | null
  recipientId: string
  requestId: string | null
  read: boolean
  sentAt: string
  attachments: unknown[]
  createdAt: string
  updatedAt: string
}

export interface ActivityDto {
  id: string
  ownerId: string
  requestId: string | null
  letterId: string | null
  type: string
  title: string
  description: string | null
  at: string
}

export interface RequestStats {
  total: number
  in_review: number
  approved: number
  action_needed: number
  rejected: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

export interface CompanyInfoDto {
  name: string
  establishmentDate: string
  status: string
  type: string
  registrationNumber: string
  economicCode: string
  nationalId: string
}

export interface ContactInfoDto {
  phone: string
  email: string
}

export interface ExecutiveDto {
  role: string
  name: string
}

export interface AddressDto {
  id: string
  title: string
  province: string
  city: string
  postalCode: string
  address: string
}

export interface ProfileDto {
  company: CompanyInfoDto
  contacts: ContactInfoDto
  executives: ExecutiveDto[]
  addresses: AddressDto[]
  companyId?: string | null
}

/** Safe projection for the current internal user's read-only personal profile. */
export interface DashboardOwnProfileDto {
  name: string
  position: string
  role: string
  contacts: ContactInfoDto
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'پیش‌نویس',
  in_review: 'درحال بررسی',
  action_needed: 'نیاز به اقدام',
  approved: 'تایید شده',
  rejected: 'رد شده',
}

export const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  rejected: 'رد درخواست',
  approved: 'تایید درخواست',
  needs_fix: 'نیاز به اصلاح',
  official: 'نامه رسمی',
  notification: 'اطلاع رسانی',
}

/** Machine key → display name, for denormalizing a request's `serviceKey`. */
export const SERVICE_KEY_LABELS: Record<string, string> = {
  financing: 'تأمین مالی و سرمایه‌گذاری',
  events: 'رویدادها و رقابت‌ها',
  exhibitions: 'خدمات نمایشگاهی',
  knowledge: 'خدمات دانش‌بنیانی',
  commercialization: 'تجاری‌سازی و ورود به بازار',
}

const persianDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Formats an ISO timestamp as a Jalali date (falls back to a raw slice). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return persianDate.format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

const persianWeekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'long' })
const persianTime = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' })

export function formatWeekday(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return persianWeekday.format(new Date(iso))
  } catch {
    return ''
  }
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return persianTime.format(new Date(iso))
  } catch {
    return ''
  }
}

export function serviceNameFor(serviceKey: string): string {
  return SERVICE_KEY_LABELS[serviceKey] ?? serviceKey
}

async function dashboardFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/dashboard${path}`, { cache: 'no-store', ...init })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `dashboard request failed: HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function getStats(): Promise<RequestStats> {
  return dashboardFetch<RequestStats>('/stats')
}

export function listRequests(params?: { status?: RequestStatus; page?: number; limit?: number }): Promise<Paginated<RequestDto>> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return dashboardFetch<Paginated<RequestDto>>(`/requests${suffix}`)
}

export interface RequestDetail {
  request: RequestDto
  timeline: ActivityDto[]
  workflow: { title: string; role: string; roleName: string; order: number }[]
}

export function getRequest(id: string): Promise<RequestDetail> {
  return dashboardFetch<RequestDetail>(`/requests/${encodeURIComponent(id)}`)
}

export function listLetters(params?: { read?: boolean; page?: number; limit?: number }): Promise<Paginated<LetterDto>> {
  const qs = new URLSearchParams()
  if (params?.read !== undefined) qs.set('read', String(params.read))
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return dashboardFetch<Paginated<LetterDto>>(`/letters${suffix}`)
}

export function getLetter(id: string): Promise<{ letter: LetterDto }> {
  return dashboardFetch<{ letter: LetterDto }>(`/letters/${id}`)
}

export function listActivities(params?: { page?: number; limit?: number }): Promise<Paginated<ActivityDto>> {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return dashboardFetch<Paginated<ActivityDto>>(`/activities${suffix}`)
}

export function createRequest(input: { serviceId: string; title: string; answers?: Record<string, unknown> }): Promise<{ request: RequestDto }> {
  return dashboardFetch<{ request: RequestDto }>('/requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function submitRequest(id: string): Promise<{ request: RequestDto }> {
  return dashboardFetch<{ request: RequestDto }>(`/requests/${id}/submit`, { method: 'POST' })
}

export function fetchProfile(): Promise<ProfileDto | undefined> {
  return dashboardFetch<ProfileDto>('/profile')
}

export function updateProfile(data: {
  company?: Partial<CompanyInfoDto>
  contacts?: Partial<ContactInfoDto>
  executives?: ExecutiveDto[]
}): Promise<ProfileDto | undefined> {
  return dashboardFetch<ProfileDto>('/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function addAddress(address: Omit<AddressDto, 'id'>): Promise<{ address: AddressDto } | undefined> {
  return dashboardFetch<{ address: AddressDto }>('/profile/addresses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(address),
  })
}

export function updateAddress(id: string, address: Partial<Omit<AddressDto, 'id'>>): Promise<{ address: AddressDto } | undefined> {
  return dashboardFetch<{ address: AddressDto }>(`/profile/addresses/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(address),
  })
}

export function deleteAddress(id: string): Promise<{ success: boolean } | undefined> {
  return dashboardFetch<{ success: boolean }>(`/profile/addresses/${id}`, {
    method: 'DELETE',
  })
}

/* ── Display mappers (backend DTO → component prop shapes) ─────────────── */

export function canUploadDocuments(request: Pick<RequestDto, 'allowedActions'>): boolean {
  return request.allowedActions?.includes('uploadDocument') === true
}

export function canDeleteDocuments(request: Pick<RequestDto, 'allowedActions'>): boolean {
  return request.allowedActions?.includes('deleteDocument') === true
}

export function mapRequestItem(dto: RequestDto): RequestItem {
  return {
    id: dto.id,
    trackingCode: dto.trackingCode,
    title: dto.title,
    status: dto.status as RequestItem['status'],
    statusLabel: REQUEST_STATUS_LABELS[dto.status],
    currentStep: dto.currentStep ?? '',
    allowedActions: dto.allowedActions ?? [],
    dueDate: formatDate(dto.dueDate),
    createdDate: formatDate(dto.createdAt),
  }
}

export function mapLetterItem(dto: LetterDto): LetterItem {
  return {
    id: dto.id,
    title: dto.title,
    status: dto.type,
    statusLabel: LETTER_TYPE_LABELS[dto.type],
    senderName: dto.senderName ?? 'کارخانه نوآوری',
    senderRole: dto.senderRole ?? '',
    sentDate: formatDate(dto.sentAt),
    read: dto.read,
  }
}

export function mapMailData(dto: LetterDto): MailData {
  return {
    id: dto.id,
    title: dto.title,
    category: LETTER_TYPE_LABELS[dto.type],
    senderName: dto.senderName ?? 'کارخانه نوآوری',
    senderRole: dto.senderRole ?? '',
    datePersian: formatDate(dto.sentAt),
    dayOfWeek: formatWeekday(dto.sentAt),
    timeStr: formatTime(dto.sentAt),
    body: dto.body,
    attachments: [],
  }
}

export function deleteLetter(id: string): Promise<{ success: boolean }> {
  return dashboardFetch<{ success: boolean }>(`/letters/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export interface SupportTicketDto {
  requesterName?: string
  id: string
  requesterId: string
  subject: string
  message: string
  status: 'open' | 'answered' | 'closed'
  response: string | null
  respondedBy?: string | null
  messages?: SupportMessageDto[]
  createdAt: string
  updatedAt: string
}

export interface SupportMessageDto {
  id: string
  authorId: string
  authorRole: 'applicant' | 'staff'
  body: string
  createdAt: string
}

export function createSupportTicket(input: { subject: string; message: string }): Promise<{ ticket: SupportTicketDto }> {
  return dashboardFetch<{ ticket: SupportTicketDto }>('/support', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
  })
}

export function listSupportTickets(): Promise<Paginated<SupportTicketDto>> {
  return dashboardFetch<Paginated<SupportTicketDto>>('/support?limit=100')
}
