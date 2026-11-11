import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { DashboardReadNotice } from '@/components/dashboard/dashboard-read-notice'
import { NewLetterForm, type LetterCaseOption, type LetterRecipient } from '@/components/dashboard/new-letter-form'
import type { LetterDto, Paginated, ProfileDto, RequestDto } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { dashboardOperationalRole, isSeniorManagerUser, serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { permittedRecipients, recipientOption, replyRecipient } from '@/utilities/letter-recipients'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'ارسال نامه جدید' }

interface PageProps {
  searchParams?: Promise<{
    mode?: string
    requestId?: string
    replyTo?: string
  }>
}

/** The company's own id: support attachments are private files that belong to it. */
async function supportForm() {
  const profile = await serverDashboardFetchResult<ProfileDto>('/profile')
  return <NewLetterForm mode="support" companyId={profile.kind === 'ok' ? (profile.data.companyId ?? undefined) : undefined} />
}

export default async function NewLetterPage(props: PageProps) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/login?returnUrl=%2Fdashboard%2Fletters%2Fnew')

  const isSeniorManager = await isSeniorManagerUser(payload, user)
  const searchParams = await props.searchParams
  const role = dashboardOperationalRole(user)
  const replyTo = searchParams?.replyTo

  if (searchParams?.mode === 'support') {
    return supportForm()
  }

  let requestId = searchParams?.requestId
  let initialTitle: string | undefined
  let replySender: LetterRecipient | undefined

  if (replyTo) {
    const original = await serverDashboardFetchResult<{ letter: LetterDto }>(
      `${isSeniorManager ? '/admin/letters' : '/letters'}/${encodeURIComponent(replyTo)}`,
    )
    if (original.kind !== 'ok') {
      return <DashboardReadNotice reason={unavailableReasonFor(original) ?? 'unavailable'} retryHref={`/dashboard/letters/new?replyTo=${encodeURIComponent(replyTo)}`} />
    }
    const { letter } = original.data
    requestId = letter.requestId ?? undefined
    replySender = await replyRecipient(letter, String(user.id))
    initialTitle = letter.title.startsWith('پاسخ به:') ? letter.title : `پاسخ به: ${letter.title}`
  }

  // Without a case or a letter to answer, a company writes through support.
  if (role === 'representative' && !requestId && !replyTo) {
    return supportForm()
  }

  const permitted = await permittedRecipients({ requestId })
  let recipients = permitted.kind === 'ok' ? permitted.data.items.map(recipientOption) : []
  let recipientsError = permitted.kind !== 'ok'

  // The owner sees companies under their legal names, then the staff they may write to.
  if (isSeniorManager && !requestId) {
    const companies = await serverDashboardFetchResult<{ items: LetterRecipient[] }>('/admin/companies?limit=100')
    const staff = permitted.kind === 'ok'
      ? permitted.data.items.filter((item) => item.operationalRole !== 'representative').map(recipientOption)
      : []
    recipients = [...(companies.kind === 'ok' ? companies.data.items : []), ...staff]
    recipientsError = recipientsError || companies.kind !== 'ok'
  }
  if (replySender && !recipients.some((recipient) => recipient.id === replySender.id)) {
    recipients = [replySender, ...recipients]
  }

  // Staff choose the case here; a reply and a company's letter keep the case they came from.
  let caseOptions: LetterCaseOption[] | undefined
  let casesError = false
  if (!isSeniorManager && !replyTo && role !== 'representative') {
    const cases = await serverDashboardFetchResult<Paginated<RequestDto>>('/requests?limit=100')
    caseOptions = cases.kind === 'ok' ? cases.data.items : []
    casesError = cases.kind !== 'ok'
  }

  let caseTitle: string | undefined
  if (requestId && !caseOptions?.some((item) => item.id === requestId)) {
    const request = await serverDashboardFetchResult<{ request?: RequestDto }>(`/requests/${encodeURIComponent(requestId)}`)
    if (request.kind === 'ok') caseTitle = request.data.request?.title
  }

  return (
    <NewLetterForm
      mode={isSeniorManager ? 'admin' : 'letter'}
      companies={recipients}
      recipientsError={recipientsError}
      requestId={requestId}
      caseTitle={caseTitle}
      caseOptions={caseOptions}
      casesError={casesError}
      officialOnly={!isSeniorManager && role !== 'central-secretariat'}
      initialRecipientId={replySender?.id}
      initialTitle={initialTitle}
    />
  )
}
