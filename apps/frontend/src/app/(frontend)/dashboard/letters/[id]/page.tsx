import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { DashboardReadNotice } from '@/components/dashboard/dashboard-read-notice'
import { MailDetailView, type MailData } from '@/components/dashboard/mail-detail-view'
import { SupportReplyProvider, SupportTicketActions } from '@/components/dashboard/support-ticket-actions'
import { formatDate, formatTime, formatWeekday, letterAction, mapMailData, type LetterDto, type Paginated, type SupportTicketDto } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { isSeniorManagerUser, serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { replyRecipient } from '@/utilities/letter-recipients'

export const dynamic = 'force-dynamic'

const THREAD_LIMIT = 100

/** Other letters of the case, within what the reader's own letter scope allows. */
async function caseThread(letter: LetterDto): Promise<Pick<MailData, 'thread' | 'threadNotice'>> {
  if (!letter.requestId) return {}
  const result = await serverDashboardFetchResult<Paginated<LetterDto>>(`/letters?requestId=${encodeURIComponent(letter.requestId)}&limit=${THREAD_LIMIT}`)
  if (result.kind !== 'ok') return { threadNotice: 'دریافت تاریخچه مکاتبات پرونده انجام نشد. صفحه را دوباره بارگذاری کنید.' }
  const thread = result.data.items
    .filter((item) => item.id !== letter.id)
    .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
    .map(mapMailData)
  return {
    thread,
    ...(result.data.total > result.data.items.length ? { threadNotice: `فقط ${THREAD_LIMIT.toLocaleString('fa-IR')} نامهٔ آخر این پرونده نمایش داده شده است.` } : {}),
  }
}

export default async function LetterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const raw = decodeURIComponent((await params).id)
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const admin = await isSeniorManagerUser(payload, user)
  const split = raw.indexOf(':')
  const prefix = split > 0 ? raw.slice(0, split) : 'letter'
  const id = split > 0 ? raw.slice(split + 1) : raw
  let mail: MailData
  let actions: ReactNode = null
  let supportClosed = false
  let replyHref: string | undefined
  let canDelete = true
  const retryHref = `/dashboard/letters/${encodeURIComponent(raw)}`
  if (prefix === 'support') {
    const result = await serverDashboardFetchResult<{ ticket: SupportTicketDto }>(`/support/${encodeURIComponent(id)}`)
    if (result.kind === 'unavailable' && result.status === 404) notFound()
    if (result.kind !== 'ok') return <DashboardReadNotice reason={unavailableReasonFor(result) ?? 'unavailable'} retryHref={retryHref} />
    const t = result.data.ticket
    supportClosed = t.status === 'closed'
    const messages = t.messages?.length ? t.messages : [
      { id: `${id}:initial`, authorId: t.requesterId, authorRole: 'representative' as const, body: t.message, createdAt: t.createdAt },
      ...(t.response ? [{ id: `${id}:response`, authorId: t.respondedBy ?? 'staff', authorRole: 'admin' as const, body: t.response, createdAt: t.updatedAt }] : []),
    ]
    mail = { id: raw, title: t.subject, category: 'پشتیبانی', senderName: t.requesterName || 'شرکت متقاضی', senderRole: 'فرستنده تیکت', datePersian: formatDate(t.createdAt), dayOfWeek: formatWeekday(t.createdAt), timeStr: formatTime(t.createdAt), body: t.message, attachments: (t.attachments ?? []).map((item) => ({ id: item.id, name: item.name, size: `${Math.max(1, Math.round(item.sizeBytes / 1024)).toLocaleString('fa-IR')} کیلوبایت` })) }
    actions = <SupportTicketActions key={t.updatedAt} id={id} status={t.status} isAdmin={admin} requesterName={t.requesterName} initialMessageId={messages[0]?.id} initialMessages={messages} />
  } else if (prefix === 'form') {
    if (!admin) notFound()
    const doc = await payload.findByID({ collection: 'form-submissions', id, depth: 1 }).catch((error: { status?: number }) => {
      if (error?.status === 404) notFound()
      throw error
    })
    const title = typeof doc.form === 'object' ? doc.form?.title : undefined
    if (title !== 'فرم تماس با ما' && title !== 'درخواست همکاری') notFound()
    const fields = Object.fromEntries((doc.submissionData ?? []).map((x: { field: string; value: unknown }) => [x.field, x.value]))
    const labels: Record<string, string> = { fullName: 'نام و نام خانوادگی', email: 'ایمیل', phone: 'شماره همراه', subject: 'موضوع', message: 'پیام' }
    mail = { id: raw, title, category: title, senderName: String(fields.fullName || 'فرستنده فرم'), senderRole: String(fields.email || 'فرم وب‌سایت'), datePersian: formatDate(doc.createdAt), dayOfWeek: formatWeekday(doc.createdAt), timeStr: formatTime(doc.createdAt), body: Object.entries(fields).map(([k, v]) => `${labels[k] ?? k}: ${String(v)}`).join('\n') }
  } else {
    const result = await serverDashboardFetchResult<{ letter: LetterDto }>(`${admin ? '/admin/letters' : '/letters'}/${encodeURIComponent(id)}`)
    if (result.kind === 'unavailable' && result.status === 404) notFound()
    if (result.kind !== 'ok') return <DashboardReadNotice reason={unavailableReasonFor(result) ?? 'unavailable'} retryHref={retryHref} />
    const { letter } = result.data
    const actorId = String(user?.id)
    if (await replyRecipient(letter, actorId)) replyHref = `/dashboard/letters/new?replyTo=${encodeURIComponent(letter.id)}`
    canDelete = letter.senderId !== actorId
    const action = letter.recipientId === actorId ? letterAction(letter) : null
    mail = { ...mapMailData(letter), ...(await caseThread(letter)), action }
  }
  return (
    <SupportReplyProvider>
      <MailDetailView mail={mail} showActions={prefix === 'letter'} replyHref={replyHref} canDelete={canDelete} supportReply={prefix === 'support' && !!actions} supportClosed={supportClosed} />
      {actions}
    </SupportReplyProvider>
  )
}
