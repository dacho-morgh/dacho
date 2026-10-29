import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { NewLetterForm, type LetterRecipient } from '@/components/dashboard/new-letter-form'
import { isSeniorManagerUser, serverDashboardFetch } from '@/utilities/dashboard-server'
import type { LetterDto, RequestDto } from '@/utilities/dashboard-api'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'ارسال نامه جدید' }

interface PageProps {
  searchParams?: Promise<{
    mode?: string
    requestId?: string
    replyTo?: string
    recipientId?: string
  }>
}

export default async function NewLetterPage(props: PageProps) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/login?returnUrl=%2Fdashboard%2Fletters%2Fnew')

  const isSeniorManager = await isSeniorManagerUser(payload, user)
  const searchParams = await props.searchParams
  const userRole = (user as unknown as { operationalRole?: string }).operationalRole ?? ''

  if (searchParams?.mode === 'support') {
    return <NewLetterForm mode="support" />
  }

  let requestId = searchParams?.requestId
  let initialRecipientId = searchParams?.recipientId
  let initialTitle: string | undefined
  let caseTitle: string | undefined

  if (searchParams?.replyTo) {
    const letterRes = await serverDashboardFetch<{ letter: LetterDto }>(
      `${isSeniorManager ? '/admin/letters' : '/letters'}/${encodeURIComponent(searchParams.replyTo)}`,
    )
    if (letterRes?.letter) {
      const orig = letterRes.letter
      requestId = orig.requestId ?? requestId
      initialRecipientId = orig.senderId ?? initialRecipientId
      initialTitle = orig.title.startsWith('پاسخ به:') ? orig.title : `پاسخ به: ${orig.title}`
    }
  }

  if (requestId) {
    const reqRes = await serverDashboardFetch<{ request?: RequestDto } | RequestDto>(
      `${isSeniorManager ? '/admin/requests' : '/requests'}/${encodeURIComponent(requestId)}`,
    )
    const request = reqRes && 'request' in reqRes ? reqRes.request : (reqRes as RequestDto | undefined)
    if (request?.title) caseTitle = request.title
  }

  let recipients: LetterRecipient[] = []
  let recipientsError = false

  if (userRole === 'representative') {
    const secUsers = await payload.find({
      collection: 'users',
      where: {
        operationalRole: { equals: 'central-secretariat' },
        isActive: { equals: true },
      },
      limit: 20,
    })
    recipients = secUsers.docs.map((u) => ({
      id: String(u.id),
      name: u.name || 'دبیرخانه مرکزی',
      companyName: 'دبیرخانه مرکزی',
    }))
    if (recipients.length === 0) {
      recipients = [{ id: 'secretariat', name: 'دبیرخانه مرکزی', companyName: 'دبیرخانه مرکزی' }]
    }
  } else if (userRole === 'reviewer' || userRole === 'employer-reviewer') {
    const chiefUsers = await payload.find({
      collection: 'users',
      where: {
        operationalRole: { equals: 'chief-reviewer' },
        isActive: { equals: true },
      },
      limit: 20,
    })
    recipients = chiefUsers.docs.map((u) => ({
      id: String(u.id),
      name: u.name || 'سردبیر رویداد',
      companyName: 'سردبیر رویداد',
    }))
  } else if (userRole === 'investment-reviewer') {
    if (requestId) {
      const assignRes = await serverDashboardFetch<{ items: Array<{ userId: string; role: string }> }>(
        `/admin/requests/${encodeURIComponent(requestId)}/assignments`,
      )
      if (assignRes?.items) {
        recipients = assignRes.items.map((item) => ({
          id: item.userId,
          name: item.role === 'chief-reviewer' ? 'سردبیر رویداد' : item.userId,
          companyName: item.role,
        }))
      }
    }
  } else {
    const result = await serverDashboardFetch<{ items: LetterRecipient[] }>('/admin/companies?limit=100')
    recipients = result?.items ?? []
    recipientsError = !result
  }

  const mode = searchParams?.mode === 'support' || (!isSeniorManager && userRole === 'representative' && !searchParams?.requestId)
    ? 'support'
    : isSeniorManager
      ? 'admin'
      : 'letter'

  return (
    <NewLetterForm
      mode={mode}
      companies={recipients}
      recipientsError={recipientsError}
      requestId={requestId}
      caseTitle={caseTitle}
      initialRecipientId={initialRecipientId}
      initialTitle={initialTitle}
    />
  )
}
