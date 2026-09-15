import type { Paginated, SupportTicketDto } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'
import { SupportUserView } from '@/components/dashboard/support-user-view'

export const dynamic = 'force-dynamic'

export default async function SupportPage() {
  const result = await serverDashboardFetch<Paginated<SupportTicketDto>>('/support?limit=100')
  return <SupportUserView initialTickets={result?.items ?? []} initialError={!result} />
}
