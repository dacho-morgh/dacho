import { type Paginated, dashboardFetch } from './core'

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

export function createSupportTicket(input: {
  subject: string
  message: string
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
