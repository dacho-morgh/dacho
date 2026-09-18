import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { NewLetterForm, type LetterRecipient } from '@/components/dashboard/new-letter-form'
import { isSeniorManagerUser, serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'ارسال نامه جدید' }

interface PageProps {
  searchParams?: Promise<{ mode?: string }>
}

export default async function NewLetterPage(props: PageProps) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/login?returnUrl=%2Fdashboard%2Fletters%2Fnew')

  const isSeniorManager = await isSeniorManagerUser(payload, user)
  const searchParams = await props.searchParams
  const mode = searchParams?.mode === 'support' || !isSeniorManager ? 'support' : 'admin'

  if (mode === 'support') {
    return <NewLetterForm mode="support" />
  }

  const result = await serverDashboardFetch<{ items: LetterRecipient[] }>('/admin/companies?limit=100')
  return <NewLetterForm mode="admin" companies={result?.items ?? []} recipientsError={!result} />
}
