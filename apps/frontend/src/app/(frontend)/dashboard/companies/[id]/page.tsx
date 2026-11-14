import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { OfflineNotice } from '@/components/dashboard/offline-notice'
import { CompanyDetailView } from '@/components/dashboard/company-detail-view'
import { loadCompanyDetail } from '@/components/dashboard/company-detail/company-detail-server'
import type { CompanyTab } from '@/components/dashboard/company-detail/company-detail-shell'
import { canReadCompanyDetail, dashboardOperationalRole } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

const TABS: readonly CompanyTab[] = ['profile', 'resume', 'account', 'requests']

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  // The case is read alongside the access check, so the page opens with its content
  // instead of a skeleton followed by two browser round trips.
  const [payload, detail, { tab }] = await Promise.all([
    getPayload({ config: configPromise }),
    loadCompanyDetail(id),
    searchParams,
  ])
  const { user } = await payload.auth({ headers: await headers() })
  if (!canReadCompanyDetail(user)) redirect('/dashboard?access=denied')

  if (detail.kind === 'missing') notFound()
  if (detail.kind === 'unavailable') {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 pt-20 md:p-10" dir="rtl">
        <OfflineNotice reason={detail.reason} retryHref={`/dashboard/companies/${encodeURIComponent(id)}`} />
      </div>
    )
  }

  const active = TABS.find((item) => item === tab) ?? 'profile'
  return (
    <CompanyDetailView
      key={`${id}:${active}`}
      id={id}
      tab={active}
      initial={detail.data}
      canManageAccount={dashboardOperationalRole(user) === 'system-owner'}
      readOnly={dashboardOperationalRole(user) === 'chief-reviewer'}
    />
  )
}
