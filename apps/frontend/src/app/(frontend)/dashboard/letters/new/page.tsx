import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload, type Where } from 'payload'
import { NewLetterForm, type LetterRecipient } from '@/components/dashboard/new-letter-form'
import { dashboardOperationalRole, isSeniorManagerUser, serverDashboardFetch } from '@/utilities/dashboard-server'
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

const ROLE_LABELS: Record<string, string> = {
  'system-owner': 'صاحب سیستم',
  'central-secretariat': 'دبیرخانه مرکزی',
  'chief-reviewer': 'سردبیر رویداد',
  reviewer: 'داور',
  'employer-reviewer': 'کارفرما',
  'investment-reviewer': 'کمیته سرمایه‌گذاری',
  representative: 'نماینده شرکت',
}

export default async function NewLetterPage(props: PageProps) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/login?returnUrl=%2Fdashboard%2Fletters%2Fnew')

  const isSeniorManager = await isSeniorManagerUser(payload, user)
  const searchParams = await props.searchParams
  const userRole = dashboardOperationalRole(user)

  if (searchParams?.mode === 'support') {
    return <NewLetterForm mode="support" />
  }

  let requestId = searchParams?.requestId
  let initialRecipientId = searchParams?.recipientId
  let initialTitle: string | undefined
  let caseTitle: string | undefined
  let replySender: LetterRecipient | undefined

  // Without a case or a letter to answer, a company writes through support.
  if (userRole === 'representative' && !requestId && !searchParams?.replyTo) {
    return <NewLetterForm mode="support" />
  }

  if (searchParams?.replyTo) {
    const letterRes = await serverDashboardFetch<{ letter: LetterDto }>(
      `${isSeniorManager ? '/admin/letters' : '/letters'}/${encodeURIComponent(searchParams.replyTo)}`,
    )
    if (letterRes?.letter) {
      const orig = letterRes.letter
      requestId = orig.requestId ?? requestId
      if (orig.senderId && orig.senderId !== String(user.id)) {
        initialRecipientId = orig.senderId
        replySender = {
          id: orig.senderId,
          name: [orig.senderName, orig.senderRole && ROLE_LABELS[orig.senderRole]].filter(Boolean).join(' — ') || orig.senderId,
        }
      }
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

  // Recipient lists mirror the backend letter policy (canSendLetter); the API
  // still authorizes every send.
  const userId = user.id
  async function activeUsers(where: Where): Promise<LetterRecipient[]> {
    const result = await payload.find({
      collection: 'users',
      where: { and: [{ isActive: { equals: true } }, { id: { not_equals: userId } }, where] },
      depth: 0,
      limit: 100,
    })
    return result.docs.map((u) => {
      const roleLabel = (u.operationalRole && ROLE_LABELS[u.operationalRole]) || ''
      return { id: String(u.id), name: [u.name, roleLabel].filter(Boolean).join(' — ') || String(u.id) }
    })
  }

  let recipients: LetterRecipient[] = []
  let recipientsError = false

  if (userRole === 'representative') {
    recipients = await activeUsers({ operationalRole: { equals: 'central-secretariat' } })
  } else if (userRole === 'reviewer' || userRole === 'employer-reviewer') {
    // Reviewers may only write to the event chief inside a case.
    if (requestId) recipients = await activeUsers({ operationalRole: { equals: 'chief-reviewer' } })
  } else if (userRole === 'chief-reviewer') {
    // The chief may write to anyone, except investment reviewers inside a case.
    recipients = await activeUsers(
      requestId
        ? { and: [{ operationalRole: { exists: true } }, { operationalRole: { not_equals: 'investment-reviewer' } }] }
        : { operationalRole: { exists: true } },
    )
  } else if (isSeniorManager) {
    const result = await serverDashboardFetch<{ items: LetterRecipient[] }>('/admin/companies?limit=100')
    recipients = result?.items ?? []
    recipientsError = !result
  }
  // Investment reviewers have no persisted financial handoff yet (T31), so the
  // backend rejects every letter they send; no recipient is offered.

  if (replySender && !recipients.some((recipient) => recipient.id === replySender.id)) {
    recipients = [replySender, ...recipients]
  }

  return (
    <NewLetterForm
      mode={isSeniorManager ? 'admin' : 'letter'}
      companies={recipients}
      recipientsError={recipientsError}
      requestId={requestId}
      caseTitle={caseTitle}
      initialRecipientId={initialRecipientId}
      initialTitle={initialTitle}
    />
  )
}
