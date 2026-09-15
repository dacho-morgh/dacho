import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { SupportAdminView } from '@/components/dashboard/support-admin-view'
import { SupportUserView } from '@/components/dashboard/support-user-view'
import type { Paginated, SupportTicketDto } from '@/utilities/dashboard-api'
import { isSeniorManagerUser, serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export default async function SupportPage() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSeniorManager = await isSeniorManagerUser(payload, user)

  const result = await serverDashboardFetch<Paginated<SupportTicketDto>>('/support?limit=100')

  if (isSeniorManager) {
    return <SupportAdminView initialTickets={result?.items ?? []} initialError={!result} />
  }

  return <SupportUserView initialTickets={result?.items ?? []} initialError={!result} />
}
