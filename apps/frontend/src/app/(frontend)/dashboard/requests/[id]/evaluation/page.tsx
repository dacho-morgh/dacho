import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { AdminRequestEvaluation } from '@/components/dashboard/admin-request-evaluation'
import { isSeniorManagerUser } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export default async function EvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSeniorManager = await isSeniorManagerUser(payload, user)
  if (!isSeniorManager) redirect('/dashboard/requests')

  const { id } = await params
  return <AdminRequestEvaluation id={id} />
}
