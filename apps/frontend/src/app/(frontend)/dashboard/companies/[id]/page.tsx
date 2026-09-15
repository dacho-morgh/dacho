import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { CompanyDetailView } from '@/components/dashboard/company-detail-view'
import { isSeniorManagerUser } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSeniorManager = await isSeniorManagerUser(payload, user)
  if (!isSeniorManager) redirect('/dashboard')

  const { id } = await params
  return <CompanyDetailView id={id} />
}
