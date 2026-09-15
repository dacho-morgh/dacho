import { serverDashboardFetch } from '@/utilities/dashboard-server'
import type { Paginated, SupportTicketDto } from '@/utilities/dashboard-api'
import { SupportAdminView } from '@/components/dashboard/support-admin-view'

export const dynamic = 'force-dynamic'

export default async function AdminSupportPage() {
  const result = await serverDashboardFetch<Paginated<SupportTicketDto>>('/support?limit=100')
  return <SupportAdminView initialTickets={result?.items ?? []} initialError={!result} />
}
