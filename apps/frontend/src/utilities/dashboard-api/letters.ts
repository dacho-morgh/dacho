import { OPERATIONAL_ROLE_LABELS, type OperationalRole } from '@cms-core/access/roles'
import type { LetterItem } from '@/components/dashboard/inbox-list-view'
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
  return (role && OPERATIONAL_ROLE_LABELS[role as OperationalRole]) || role || ''
}

export function mapLetterItem(dto: LetterDto): LetterItem {
  return {
    id: dto.id,
    title: dto.title,
    status: dto.type,
    statusLabel: LETTER_TYPE_LABELS[dto.type],
    senderName: dto.senderName ?? 'کارخانه نوآوری',
    senderRole: letterSenderRoleLabel(dto.senderRole),
    sentDate: formatDate(dto.sentAt),
    read: dto.read,
  }
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
