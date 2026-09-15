import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { CompanyList } from '@/components/dashboard/company-list'
import { isSeniorManagerUser } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSeniorManager = await isSeniorManagerUser(payload, user)
  if (!isSeniorManager) redirect('/dashboard')

  return <CompanyList />
}
