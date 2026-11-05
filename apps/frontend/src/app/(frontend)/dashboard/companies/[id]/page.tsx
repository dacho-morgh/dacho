import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { CompanyDetailView } from '@/components/dashboard/company-detail-view'
import type { CompanyTab } from '@/components/dashboard/company-detail/company-detail-shell'
import { canReadCompanyDossiers, dashboardOperationalRole } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

const TABS: readonly CompanyTab[] = ['profile', 'resume', 'account', 'requests']

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  if (!canReadCompanyDossiers(user)) redirect('/dashboard?access=denied')

  const { id } = await params
  const { tab } = await searchParams
  const active = TABS.find((item) => item === tab) ?? 'profile'
  return <CompanyDetailView id={id} tab={active} canManageAccount={dashboardOperationalRole(user) === 'system-owner'} />
}
