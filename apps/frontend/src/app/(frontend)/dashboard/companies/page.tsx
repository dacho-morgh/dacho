import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { CompanyList } from '@/components/dashboard/company-list'
import { canReadCompanyDossiers } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  if (!canReadCompanyDossiers(user)) redirect('/dashboard?access=denied')

  return <CompanyList />
}
