import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { AdminLettersView, type AdminLetterItem } from '@/components/dashboard/admin-letters-view'
import { ApplicantLettersView, type ApplicantLetterItem } from '@/components/dashboard/applicant-letters-view'
import { DashboardReadNotice } from '@/components/dashboard/dashboard-read-notice'
import { InboxView, type InboxRow, type InboxShortcut } from '@/components/dashboard/inbox-view'
import { Typography } from '@/components/ui/typography'
import {
  formatDate,
  inboxQueryString,
  LETTER_TYPE_LABELS,
  letterAction,
  letterSenderRoleLabel,
  parseInboxQuery,
  type InboxPage,
  type LetterDto,
  type Paginated,
  type SupportTicketDto,
} from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import {
  dashboardOperationalRole,
  isSeniorManagerUser,
  serverDashboardFetchResult,
  type DashboardFetchResult,
} from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'کارتابل نامه و مکاتبات',
  description:
    'مشاهده نامه‌ها، پیام‌ها و تیکت‌های پشتیبانی در سامانه کارخانه نوآوری صنایع انرژی بوشهر',
}

/**
 * Support tickets are closed to reviewers and investment staff by design, so a 403 there
 * only means the tab has nothing for this role. Any other failed read must not look empty.
 */
function lettersFailure(
  letters: DashboardFetchResult<unknown>,
  tickets: DashboardFetchResult<unknown>,
) {
  return unavailableReasonFor(letters) ?? (tickets.kind === 'denied' ? undefined : unavailableReasonFor(tickets))
}

/** Letter DTOs carry only the recipient id. A failed lookup leaves the generic label. */
async function recipientNamesOf(payload: Awaited<ReturnType<typeof getPayload>>, letters: LetterDto[]): Promise<Map<string, string>> {
  const ids = [...new Set(letters.map((dto) => dto.recipientId))]
  const names = new Map<string, string>()
  if (!ids.length) return names
  try {
    const found = await payload.find({ collection: 'users', where: { id: { in: ids } }, depth: 0, limit: ids.length })
    for (const recipient of found.docs) {
      if (recipient.name) names.set(String(recipient.id), recipient.name)
    }
  } catch {
    return names
  }
  return names
}

function toAdminLetterItem(dto: LetterDto, names: Map<string, string>, actorId: string): AdminLetterItem {
  const received = dto.recipientId === actorId
  return {
    id: dto.id,
    title: dto.title,
    type: dto.type,
    typeLabel: LETTER_TYPE_LABELS[dto.type] ?? 'نامه رسمی',
    senderName: received ? (dto.senderName ?? 'کارخانه نوآوری') : (names.get(dto.recipientId) ?? 'گیرنده'),
    senderRole: received ? letterSenderRoleLabel(dto.senderRole) : 'گیرنده نامه',
    direction: received ? 'received' : 'sent',
    read: received ? dto.read : undefined,
    senderAvatar: (dto as unknown as { senderAvatar?: string }).senderAvatar,
    sentDate: formatDate(dto.sentAt),
    source: 'letter',
  }
}

function toInboxRow(dto: LetterDto, names: Map<string, string>, actorId: string): InboxRow {
  const received = dto.recipientId === actorId
  return {
    id: dto.id,
    title: dto.title,
    type: dto.type,
    typeLabel: LETTER_TYPE_LABELS[dto.type] ?? 'نامه رسمی',
    counterpartName: received ? (dto.senderName ?? 'کارخانه نوآوری') : (names.get(dto.recipientId) ?? 'گیرنده'),
    counterpartRole: received ? (letterSenderRoleLabel(dto.senderRole) || 'سامانه') : 'گیرنده نامه',
    sentDate: formatDate(dto.sentAt),
    read: received ? dto.read : undefined,
    received,
    canReply: received && dto.senderId !== null,
    action: received ? letterAction(dto) : null,
  }
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-50 px-4 pb-4 pt-10 sm:px-6 lg:px-4" dir="rtl">
      <Typography as="h1" variant="24/bold" className="mb-6 leading-[36px] text-neutral-700">
        کارتابل نامه
      </Typography>
      {children}
    </div>
  )
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * The inbox (S1): the reader's own received and sent letters, with next steps.
 * Support tickets, website forms and the all-letters oversight list stay
 * reachable from the filter menu through `?view=`.
 */
export default async function LettersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSeniorManager = await isSeniorManagerUser(payload, user)
  const view = params.view === 'all' ? 'all' : undefined

  if (!view) {
    const query = parseInboxQuery(params)
    const result = await serverDashboardFetchResult<InboxPage>(`/letters?${inboxQueryString(query)}`)
    const failure = unavailableReasonFor(result)
    if (failure || result.kind !== 'ok') return <DashboardReadNotice reason={failure ?? 'unavailable'} retryHref="/dashboard/letters" />
    const actorId = String(user?.id)
    const names = await recipientNamesOf(payload, result.data.items.filter((dto) => dto.recipientId !== actorId))
    const shortcuts: InboxShortcut[] = [
      { label: isSeniorManager ? 'همه نامه‌ها، فرم‌ها و پشتیبانی' : 'نامه‌ها و تیکت‌های پشتیبانی', href: '/dashboard/letters?view=all' },
    ]
    return (
      <PageFrame>
        <InboxView
          rows={result.data.items.map((dto) => toInboxRow(dto, names, actorId))}
          query={query}
          counts={result.data.counts}
          page={result.data.page}
          totalPages={result.data.totalPages}
          canCompose={dashboardOperationalRole(user) !== 'representative'}
          shortcuts={shortcuts}
        />
      </PageFrame>
    )
  }

  if (isSeniorManager) {
    const [lettersRes, ticketsRes] = await Promise.all([
      serverDashboardFetchResult<Paginated<LetterDto>>('/admin/letters?limit=100'),
      serverDashboardFetchResult<Paginated<SupportTicketDto>>('/support?limit=100'),
    ])
    const failure = lettersFailure(lettersRes, ticketsRes)
    if (failure) return <DashboardReadNotice reason={failure} retryHref="/dashboard/letters" />
    const tickets: AdminLetterItem[] = (ticketsRes.kind === 'ok' ? ticketsRes.data.items : []).map((ticket) => ({
      id: `support:${ticket.id}`,
      title: ticket.subject,
      type: 'notification',
      typeLabel: 'تیکت پشتیبانی',
      senderName: ticket.requesterName || 'شرکت متقاضی',
      senderRole: ticket.status === 'answered' ? 'پاسخ داده شده' : ticket.status === 'closed' ? 'بسته شده' : 'در انتظار پاسخ',
      sentDate: formatDate(ticket.createdAt),
      source: 'ticket',
    }))
    const adminLetters = lettersRes.kind === 'ok' ? lettersRes.data.items : []
    const adminNames = await recipientNamesOf(payload, adminLetters.filter((dto) => dto.recipientId !== String(user?.id)))
    const letters: AdminLetterItem[] = adminLetters.map((dto) => toAdminLetterItem(dto, adminNames, String(user?.id)))
    const formsResult = await payload.find({
      collection: 'form-submissions',
      limit: 100,
      depth: 1,
      sort: '-createdAt',
    })
    const allowed = new Set(['فرم تماس با ما', 'درخواست همکاری'])
    const forms: AdminLetterItem[] = formsResult.docs.flatMap((doc) => {
      const title = typeof doc.form === 'object' ? doc.form?.title : undefined
      if (!title || !allowed.has(title)) return []
      const fields = Object.fromEntries(
        (doc.submissionData ?? []).map(({ field, value }) => [field, value]),
      )
      const item: AdminLetterItem = {
        id: `form:${doc.id}`,
        title,
        type: 'notification',
        typeLabel: title,
        senderName: String(fields.fullName || 'فرستنده فرم'),
        senderRole: 'فرم وب‌سایت',
        sentDate: new Intl.DateTimeFormat('fa-IR-u-ca-persian').format(new Date(doc.createdAt)),
        source: 'form',
      }
      return [item]
    })
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-50 px-4 pb-4 pt-10 sm:px-6 lg:px-4" dir="rtl">
        <Typography
          as="h1"
          variant="24/bold"
          className="mb-6 leading-[36px] text-neutral-700"
        >
          کارتابل نامه
        </Typography>
        <AdminLettersView initialLetters={[...letters, ...forms, ...tickets]} />
      </div>
    )
  }

  const [lettersRes, ticketsRes] = await Promise.all([
    serverDashboardFetchResult<Paginated<LetterDto>>('/letters?limit=100'),
    serverDashboardFetchResult<Paginated<SupportTicketDto>>('/support?limit=100'),
  ])
  const failure = lettersFailure(lettersRes, ticketsRes)
  if (failure) return <DashboardReadNotice reason={failure} retryHref="/dashboard/letters" />
  const fetchedLetters = lettersRes.kind === 'ok' ? lettersRes.data.items : []
  const fetchedTickets = ticketsRes.kind === 'ok' ? ticketsRes.data.items : []

  const actorId = String(user?.id)
  const isSentLetter = (dto: LetterDto) => dto.senderId === actorId
  const recipientNames = await recipientNamesOf(payload, fetchedLetters.filter(isSentLetter))

  const letters: ApplicantLetterItem[] = fetchedLetters.map((dto) => {
    const isSent = isSentLetter(dto)
    return {
      id: dto.id,
      title: dto.title,
      type: dto.type,
      typeLabel: LETTER_TYPE_LABELS[dto.type] ?? 'نامه رسمی',
      senderName: isSent ? (recipientNames.get(dto.recipientId) ?? 'گیرنده') : (dto.senderName ?? 'کارخانه نوآوری'),
      senderRole: isSent ? 'گیرنده' : (letterSenderRoleLabel(dto.senderRole) || 'دبیرخانه'),
      sentDate: formatDate(dto.sentAt),
      senderAvatar: (dto as unknown as { senderAvatar?: string }).senderAvatar,
      source: 'letter',
      direction: isSent ? 'sent' : 'received',
      // Only a recipient's own letter has a read state to show them.
      read: dto.recipientId === actorId ? dto.read : undefined,
    }
  })

  const tickets: ApplicantLetterItem[] = fetchedTickets.map((t) => ({
    id: `support:${t.id}`,
    title: t.subject,
    type: t.status === 'answered' ? 'approved' : t.status === 'closed' ? 'notification' : 'official',
    typeLabel: t.status === 'answered' ? 'پاسخ داده شده' : t.status === 'closed' ? 'بسته شده' : 'در انتظار پاسخ',
    senderName: 'پشتیبانی کارخانه نوآوری',
    senderRole: 'گیرنده',
    sentDate: formatDate(t.createdAt),
    source: 'ticket',
  }))

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-neutral-50 px-4 pb-4 pt-10 sm:px-6 lg:px-4" dir="rtl">
      <Typography
        as="h1"
        variant="24/bold"
        className="mb-6 leading-[36px] text-neutral-700"
      >
        کارتابل نامه
      </Typography>
      <ApplicantLettersView canComposeLetter={dashboardOperationalRole(user) !== 'representative'} initialLetters={[...letters, ...tickets]} />
    </div>
  )
}
