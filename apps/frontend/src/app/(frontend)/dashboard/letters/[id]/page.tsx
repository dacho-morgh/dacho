import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { DashboardReadNotice } from '@/components/dashboard/dashboard-read-notice'
import { MailDetailView, type MailData } from '@/components/dashboard/mail-detail-view'
import { SupportTicketActions } from '@/components/dashboard/support-ticket-actions'
import { formatDate, formatTime, formatWeekday, mapMailData, type LetterDto, type SupportTicketDto } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { isSeniorManagerUser, serverDashboardFetchResult } from '@/utilities/dashboard-server'

export const dynamic = 'force-dynamic'

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
  const retryHref = `/dashboard/letters/${encodeURIComponent(raw)}`
  if (prefix === 'support') {
    const result = await serverDashboardFetchResult<{ ticket: SupportTicketDto }>(`/support/${encodeURIComponent(id)}`)
    if (result.kind === 'unavailable' && result.status === 404) notFound()
    if (result.kind !== 'ok') return <DashboardReadNotice reason={unavailableReasonFor(result) ?? 'unavailable'} retryHref={retryHref} />
    const t = result.data.ticket
    supportClosed = t.status === 'closed'
    const messages = t.messages?.length ? t.messages : [
      { id: `${id}:initial`, authorId: t.requesterId, authorRole: 'applicant' as const, body: t.message, createdAt: t.createdAt },
      ...(t.response ? [{ id: `${id}:response`, authorId: t.respondedBy ?? 'staff', authorRole: 'staff' as const, body: t.response, createdAt: t.updatedAt }] : []),
    ]
    mail = { id: raw, title: t.subject, category: 'پشتیبانی', senderName: t.requesterName || 'شرکت متقاضی', senderRole: 'فرستنده تیکت', datePersian: formatDate(t.createdAt), dayOfWeek: formatWeekday(t.createdAt), timeStr: formatTime(t.createdAt), body: t.message }
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
    mail = mapMailData(result.data.letter)
  }
  return (
    <>
      <MailDetailView mail={mail} showActions={prefix === 'letter'} supportReply={prefix === 'support' && !!actions} supportClosed={supportClosed} />
      {actions}
    </>
  )
}
