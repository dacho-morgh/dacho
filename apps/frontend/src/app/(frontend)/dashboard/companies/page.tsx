import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { CompanyList } from '@/components/dashboard/company-list'
import {
  companiesParams,
  companiesQuery,
  toCompaniesPage,
  type CompaniesApiResponse,
} from '@/components/dashboard/company-list-data'
import {
  canReadCompanyDossiers,
  dashboardOperationalRole,
  serverDashboardFetchResult,
} from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

const single = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined)

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  const params = companiesParams({
    status: single(raw.status),
    page: single(raw.page),
    search: single(raw.search),
  })
  const query = companiesQuery(params)

  // The first page is read alongside the access check, so the table opens with its rows
  // instead of a skeleton followed by a loading line.
  const [payload, firstPage] = await Promise.all([
    getPayload({ config: configPromise }),
    serverDashboardFetchResult<CompaniesApiResponse>(`/admin/companies?${query}`),
  ])
  const { user } = await payload.auth({ headers: await headers() })
  if (!canReadCompanyDossiers(user)) redirect('/dashboard?access=denied')

  const initial = firstPage.kind === 'ok' ? toCompaniesPage(firstPage.data, params.page) : null
  const isOwner = dashboardOperationalRole(user) === 'system-owner'
  return (
    <CompanyList
      canCreateCompany={isOwner}
      canRemoveCompany={isOwner}
      initial={initial ? { ...initial, key: query } : undefined}
    />
  )
}
