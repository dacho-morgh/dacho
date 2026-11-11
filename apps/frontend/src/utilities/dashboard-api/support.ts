import { type Paginated, dashboardFetch } from './core'

export interface SupportAttachmentDto {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
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
  attachments?: SupportAttachmentDto[]
  /** For the requesting company: a support answer it has not opened yet. */
  unread?: boolean
  createdAt: string
  updatedAt: string
}

export interface SupportMessageDto {
  id: string
  authorId: string
  /** The backend's SupportAuthorRole: the company's representative or a support administrator. */
  authorRole: 'representative' | 'admin'
  body: string
  createdAt: string
}

export function createSupportTicket(input: {
  subject: string
  message: string
  attachmentIds?: string[]
}): Promise<{ ticket: SupportTicketDto }> {
  return dashboardFetch<{ ticket: SupportTicketDto }>('/support', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function listSupportTickets(): Promise<Paginated<SupportTicketDto>> {
  return dashboardFetch<Paginated<SupportTicketDto>>('/support?limit=100')
}
