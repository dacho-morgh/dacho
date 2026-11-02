import { OPERATIONAL_ROLE_LABELS, type OperationalRole } from '@cms-core/access/roles'
import type { MailData } from '@/components/dashboard/mail-detail-view'
import { type LetterDto, type Paginated, LETTER_TYPE_LABELS, formatDate, formatWeekday, formatTime, dashboardFetch } from './core'

export function listLetters(params?: {
  read?: boolean
  page?: number
  limit?: number
}): Promise<Paginated<LetterDto>> {
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

/** Letters store the sender's operational role; older rows may hold free text. */
export function letterSenderRoleLabel(role: string | null): string {
  // Workflow notices are written by the system itself (see notification-outbox).
  if (role === 'system') return 'اطلاع‌رسانی سامانه'
  return (role && OPERATIONAL_ROLE_LABELS[role as OperationalRole]) || role || ''
}


export function mapMailData(dto: LetterDto): MailData {
  return {
    id: dto.id,
    title: dto.title,
    category: LETTER_TYPE_LABELS[dto.type] ?? 'نامه رسمی',
    senderName: dto.senderName ?? 'کارخانه نوآوری',
    senderRole: letterSenderRoleLabel(dto.senderRole),
    datePersian: formatDate(dto.sentAt),
    dayOfWeek: formatWeekday(dto.sentAt),
    timeStr: formatTime(dto.sentAt),
    body: dto.body,
    attachments: mapLetterAttachments(dto.attachments),
  }
}

/**
 * Keeps only safe display metadata from authorized letter attachments. The
 * server omits attachments the viewer can no longer read; any URL or storage
 * field in the payload is ignored, downloads use the letter-scoped route.
 */
function formatAttachmentSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1000) return `${bytes.toLocaleString('fa-IR')} بایت`
  return `${(bytes / 1_000_000).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} مگابایت`
}

export function mapLetterAttachments(raw: unknown): MailData['attachments'] {
  if (!Array.isArray(raw)) return []
  const items: NonNullable<MailData['attachments']> = []
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue
    const record = value as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : null
    if (!id) continue
    const name = typeof record.filename === 'string' ? record.filename : typeof record.name === 'string' ? record.name : 'پیوست'
    const sizeBytes = typeof record.sizeBytes === 'number' ? record.sizeBytes : null
    items.push({ id, name, size: formatAttachmentSize(sizeBytes) })
  }
  return items
}

export function deleteLetter(id: string): Promise<{ success: boolean }> {
  return dashboardFetch<{ success: boolean }>(`/letters/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/* ── Inbox (S1, #239) ──────────────────────────────────────────────────── */

export type InboxBox = 'received' | 'sent'
export type InboxStatusFilter = 'unread' | 'action_required'

export interface InboxQuery {
  box: InboxBox
  q?: string
  status?: InboxStatusFilter
  page: number
}

export interface InboxCounts {
  unread: number
  actionRequired: number
}

export type InboxPage = Paginated<LetterDto> & { counts: InboxCounts }

export const INBOX_PAGE_SIZE = 20

/** Backend query string for one inbox view; the same keys drive the page URL. */
export function inboxQueryString(query: InboxQuery, limit = INBOX_PAGE_SIZE): string {
  const qs = new URLSearchParams({ box: query.box, page: String(query.page), limit: String(limit) })
  if (query.q) qs.set('q', query.q)
  if (query.status) qs.set('status', query.status)
  return qs.toString()
}

/** Parses page search params into a valid inbox view; anything unknown falls back to the default. */
export function parseInboxQuery(params: Record<string, string | string[] | undefined>): InboxQuery {
  const one = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : undefined)
  const page = Number(one('page'))
  const status = one('status')
  return {
    box: one('box') === 'sent' ? 'sent' : 'received',
    q: one('q')?.trim().slice(0, 100) || undefined,
    status: status === 'unread' || status === 'action_required' ? status : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

/** The recipient's next step on the case: its button label and where it is done (by request id). */
export const NEXT_STEP_ACTIONS: Record<string, { label: string; path: (requestId: string) => string }> = {
  triage: { label: 'بررسی اولیه', path: (id) => `/dashboard/requests/${id}` },
  correct: { label: 'اصلاح', path: (id) => `/dashboard/requests/${id}` },
  evaluate: { label: 'ارزیابی', path: (id) => `/dashboard/requests/${id}/evaluation` },
  decide: { label: 'تصمیم‌گیری', path: (id) => `/dashboard/requests/${id}` },
  financial_package: { label: 'تکمیل فرم', path: (id) => `/dashboard/requests/${id}` },
  investment_memo: { label: 'ثبت یادداشت', path: (id) => `/dashboard/requests/${id}` },
  publish_result: { label: 'انتشار نتیجه', path: (id) => `/dashboard/requests/${id}` },
  supplementary_upload: { label: 'ارسال مدارک', path: (id) => `/dashboard/requests/${id}` },
}

/** Booth request steps (S7): the exhibition page shows Secretariat its queue and the company its booking. */
export const BOOTH_STEP_ACTIONS: Record<string, { label: string; path: (exhibitionId: string) => string }> = {
  attendance_decision: { label: 'بررسی حضور', path: (id) => `/dashboard/exhibitions/${id}` },
  booth_receipt: { label: 'ارسال فیش', path: (id) => `/dashboard/exhibitions/${id}` },
  receipt_decision: { label: 'بررسی فیش', path: (id) => `/dashboard/exhibitions/${id}` },
}

/** The pending action of a letter, if its recipient still has one to take. */
export function letterAction(
  dto: Pick<LetterDto, 'nextStep' | 'actionRequired' | 'requestId' | 'exhibitionId'>,
): { label: string; href: string } | null {
  if (!dto.actionRequired || !dto.nextStep) return null
  if (dto.requestId) {
    const action = NEXT_STEP_ACTIONS[dto.nextStep]
    return action ? { label: action.label, href: action.path(encodeURIComponent(dto.requestId)) } : null
  }
  if (dto.exhibitionId) {
    const action = BOOTH_STEP_ACTIONS[dto.nextStep]
    return action ? { label: action.label, href: action.path(encodeURIComponent(dto.exhibitionId)) } : null
  }
  return null
}

export function setLetterRead(id: string, read: boolean): Promise<{ letter: LetterDto }> {
  return dashboardFetch<{ letter: LetterDto }>(`/letters/${encodeURIComponent(id)}/read`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ read }),
  })
}
