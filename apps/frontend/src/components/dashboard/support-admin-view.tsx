'use client'

import { useState } from 'react'
import type { SupportTicketDto } from '@/utilities/dashboard-api'
import { Typography } from '@/components/ui/typography'
import { Button } from '@/components/ui/button'

export function SupportAdminView({ initialTickets, initialError = false }: { initialTickets: SupportTicketDto[]; initialError?: boolean }) {
  const [tickets, setTickets] = useState(initialTickets)
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(initialError ? 'بارگذاری تیکت‌ها انجام نشد.' : null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const statusLabel: Record<SupportTicketDto['status'], string> = {
    open: 'باز',
    answered: 'پاسخ داده شده',
    closed: 'بسته شده',
  }
  const respond = async (id: string) => {
    const body = responses[id]?.trim()
    if (!body) return
    setProcessingId(id)
    setActionError(null)
    try {
      const result = await fetch(`/api/dashboard/support/${encodeURIComponent(id)}/respond`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body }) })
      if (!result.ok) throw new Error('respond_failed')
      const data = await result.json()
      setTickets((current) => current.map((ticket) => ticket.id === id ? data.ticket : ticket))
      setResponses((current) => ({ ...current, [id]: '' }))
    } catch {
      setActionError('ارسال پاسخ انجام نشد. لطفاً دوباره تلاش کنید.')
    } finally {
      setProcessingId(null)
    }
  }
  const close = async (id: string) => {
    setProcessingId(id)
    setActionError(null)
    try {
      const result = await fetch(`/api/dashboard/support/${encodeURIComponent(id)}/close`, { method: 'POST' })
      if (!result.ok) throw new Error('close_failed')
      const data = await result.json()
      setTickets((current) => current.map((ticket) => ticket.id === id ? data.ticket : ticket))
    } catch {
      setActionError('بستن تیکت انجام نشد. لطفاً دوباره تلاش کنید.')
    } finally {
      setProcessingId(null)
    }
  }
  return <main className="flex min-w-0 flex-1 flex-col gap-5 p-6" dir="rtl">
    <Typography as="h1" variant="24/bold" className="text-neutral-900">پشتیبانی</Typography>
    {actionError && <Typography role="alert" variant="14/regular" className="rounded-lg bg-error-50 p-3 text-error-700">{actionError}</Typography>}
    {tickets.length === 0 ? <Typography variant="16/regular" className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-neutral-500">تیکتی برای نمایش وجود ندارد.</Typography> : <div className="space-y-4">{tickets.map((ticket) => <article key={ticket.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
      <Typography as="h2" variant="16/semibold" className="text-neutral-900">{ticket.subject}</Typography>
      <Typography variant="14/regular" className="mt-2 whitespace-pre-wrap text-neutral-600">{ticket.message}</Typography>
      <Typography variant="12/regular" className="mt-2 text-neutral-400">وضعیت: {statusLabel[ticket.status] ?? ticket.status}</Typography>
      {ticket.response && <Typography variant="14/regular" className="mt-3 rounded-lg bg-neutral-50 p-3 text-neutral-700">پاسخ: {ticket.response}</Typography>}
      {ticket.status !== 'closed' && <div className="mt-4 flex flex-col gap-2 sm:flex-row"><textarea value={responses[ticket.id] ?? ''} onChange={(event) => setResponses((current) => ({ ...current, [ticket.id]: event.target.value }))} className="min-h-20 flex-1 rounded-lg border border-neutral-200 p-2" placeholder="پاسخ شما" /><div className="flex gap-2"><Button type="button" disabled={processingId === ticket.id} onClick={() => respond(ticket.id)}>ارسال پاسخ</Button><Button type="button" variant="outline-gray" disabled={processingId === ticket.id} onClick={() => close(ticket.id)}>بستن تیکت</Button></div></div>}
    </article>)}</div>}
  </main>
}
