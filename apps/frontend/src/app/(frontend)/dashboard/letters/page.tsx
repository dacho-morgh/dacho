import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { AdminLettersView } from '@/components/dashboard/admin-letters-view'
import { InboxListView, type LetterItem } from '@/components/dashboard/inbox-list-view'
import {
  mapLetterItem,
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

export default async function LettersPage(props: PageProps) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSeniorManager = await isSeniorManagerUser(payload, user)
  const searchParams = await props.searchParams

  if (isSeniorManager) {
    const [lettersRes, ticketsRes] = await Promise.all([
      serverDashboardFetch<Paginated<LetterDto>>('/admin/letters?limit=100'),
      serverDashboardFetch<Paginated<SupportTicketDto>>('/support?limit=100'),
    ])
    const letters: LetterItem[] = (lettersRes?.items ?? []).map(mapLetterItem)
    const formsResult = await payload.find({
      collection: 'form-submissions',
      limit: 100,
      depth: 1,
      sort: '-createdAt',
    })
    const allowed = new Set(['فرم تماس با ما', 'درخواست همکاری'])
    const forms: LetterItem[] = formsResult.docs.flatMap((doc) => {
      const title = typeof doc.form === 'object' ? doc.form?.title : undefined
      if (!title || !allowed.has(title)) return []
      const fields = Object.fromEntries(
        (doc.submissionData ?? []).map(({ field, value }) => [field, value]),
      )
      const item: LetterItem = {
        id: `form:${doc.id}`,
        title,
        status: 'notification',
        statusLabel: title,
        senderName: String(fields.fullName || 'فرستنده فرم'),
        senderRole: 'فرم وب‌سایت',
        sentDate: new Intl.DateTimeFormat('fa-IR-u-ca-persian').format(new Date(doc.createdAt)),
        source: 'form',
      }
      return [item]
    })
    const tickets = ticketsRes?.items ?? []
    return (
      <div className="flex min-h-screen w-full flex-col bg-neutral-50 p-6" dir="rtl">
        <AdminLettersView initialLetters={[...letters, ...forms]} initialTickets={tickets} />
      </div>
    )
  }

  const state = searchParams?.state ?? 'default'
  const [lettersRes, ticketsRes] = await Promise.all([
    serverDashboardFetch<Paginated<LetterDto>>('/letters?limit=100'),
    serverDashboardFetch<Paginated<SupportTicketDto>>('/support?limit=100'),
  ])
  const fetchedLetters: LetterItem[] = (lettersRes?.items ?? []).map(mapLetterItem)
  const fetchedTickets = ticketsRes?.items ?? []

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-[#fafafa] px-4 pt-6 pb-12 sm:px-6 sm:pt-10 lg:px-8">
      <InboxListView
        initialLetters={fetchedLetters}
        initialTickets={fetchedTickets}
        state={state}
      />
    </div>
  )
}
