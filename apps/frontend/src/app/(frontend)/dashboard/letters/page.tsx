import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { AdminLettersView, type AdminLetterItem } from '@/components/dashboard/admin-letters-view'
import { ApplicantLettersView, type ApplicantLetterItem } from '@/components/dashboard/applicant-letters-view'
import { Typography } from '@/components/ui/typography'
import {
  formatDate,
  LETTER_TYPE_LABELS,
  type LetterDto,
  type Paginated,
  type SupportTicketDto,
} from '@/utilities/dashboard-api'
import { isSeniorManagerUser, serverDashboardFetch } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'کارتابل نامه و مکاتبات',
  description:
    'مشاهده نامه‌ها، پیام‌ها و تیکت‌های پشتیبانی در سامانه کارخانه نوآوری صنایع انرژی بوشهر',
}

interface PageProps {
  searchParams?: Promise<{ state?: 'default' | 'loading' | 'empty' }>
}

function toAdminLetterItem(dto: LetterDto): AdminLetterItem {
  return {
    id: dto.id,
    title: dto.title,
    type: dto.type,
    typeLabel: LETTER_TYPE_LABELS[dto.type] ?? 'نامه رسمی',
    senderName: dto.recipientId,
    senderRole: 'گیرنده نامه',
    senderAvatar: (dto as unknown as { senderAvatar?: string }).senderAvatar,
    sentDate: formatDate(dto.sentAt),
    source: 'letter',
  }
}

export default async function LettersPage(props: PageProps) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSeniorManager = await isSeniorManagerUser(payload, user)
  const searchParams = await props.searchParams
  const state = searchParams?.state ?? 'default'

  if (isSeniorManager) {
    const [lettersRes, ticketsRes] = await Promise.all([
      serverDashboardFetch<Paginated<LetterDto>>('/admin/letters?limit=100'),
      serverDashboardFetch<Paginated<SupportTicketDto>>('/support?limit=100'),
    ])
    const tickets: AdminLetterItem[] = (ticketsRes?.items ?? []).map((ticket) => ({
      id: `support:${ticket.id}`,
      title: ticket.subject,
      type: 'notification',
      typeLabel: 'تیکت پشتیبانی',
      senderName: ticket.requesterName || 'شرکت متقاضی',
      senderRole: ticket.status === 'answered' ? 'پاسخ داده شده' : ticket.status === 'closed' ? 'بسته شده' : 'در انتظار پاسخ',
      sentDate: formatDate(ticket.createdAt),
      source: 'ticket',
    }))
    const letters: AdminLetterItem[] = (lettersRes?.items ?? []).map(toAdminLetterItem)
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
      <div className="flex min-h-screen w-full flex-col bg-neutral-50 px-4 pb-12 pt-10 sm:px-6 lg:px-4" dir="rtl">
        <Typography
          as="h1"
          variant="24/bold"
          className="mb-6 leading-[36px] text-neutral-700"
        >
          کارتابل نامه
        </Typography>
        <AdminLettersView initialLetters={[...letters, ...forms, ...tickets]} state={state} />
      </div>
    )
  }

  const [lettersRes, ticketsRes] = await Promise.all([
    serverDashboardFetch<Paginated<LetterDto>>('/letters?limit=100'),
    serverDashboardFetch<Paginated<SupportTicketDto>>('/support?limit=100'),
  ])
  const fetchedLetters = lettersRes?.items ?? []
  const fetchedTickets = ticketsRes?.items ?? []

  const letters: ApplicantLetterItem[] = fetchedLetters.map((dto) => {
    const isSent = user ? String(dto.senderId) === String(user.id) : false
    return {
      id: dto.id,
      title: dto.title,
      type: dto.type,
      typeLabel: LETTER_TYPE_LABELS[dto.type] ?? 'نامه رسمی',
      senderName: isSent ? (dto.recipientId || 'دبیرخانه') : (dto.senderName ?? 'کارخانه نوآوری'),
      senderRole: isSent ? 'گیرنده' : (dto.senderRole ?? 'دبیرخانه'),
      sentDate: formatDate(dto.sentAt),
      senderAvatar: (dto as unknown as { senderAvatar?: string }).senderAvatar,
      source: 'letter',
      direction: isSent ? 'sent' : 'received',
      read: dto.read,
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
    <div className="flex min-h-screen w-full flex-col bg-neutral-50 px-4 pb-12 pt-10 sm:px-6 lg:px-4" dir="rtl">
      <Typography
        as="h1"
        variant="24/bold"
        className="mb-6 leading-[36px] text-neutral-700"
      >
        کارتابل نامه
      </Typography>
      <ApplicantLettersView initialLetters={[...letters, ...tickets]} state={state} />
    </div>
  )
}
