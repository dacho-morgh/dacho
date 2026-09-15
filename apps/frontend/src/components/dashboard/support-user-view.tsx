'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { listSupportTickets, type SupportTicketDto } from '@/utilities/dashboard-api'
import { SupportModal } from './support-modal'

export function SupportUserView({ initialTickets, initialError = false }: { initialTickets: SupportTicketDto[]; initialError?: boolean }) {
  const [tickets, setTickets] = useState(initialTickets)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(initialError ? 'بارگذاری تیکت‌ها انجام نشد.' : null)
  const statusLabel: Record<SupportTicketDto['status'], string> = {
    open: 'باز',
    answered: 'پاسخ داده شده',
    closed: 'بسته شده',
  }

  const refresh = async () => {
    try {
      setError(null)
      const result = await listSupportTickets()
      setTickets(result.items)
    } catch {
      setError('به‌روزرسانی تیکت‌ها انجام نشد.')
    }
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography as="h1" variant="24/bold" className="text-neutral-900">پشتیبانی</Typography>
        <Button type="button" onClick={() => setModalOpen(true)}>ثبت تیکت جدید</Button>
      </div>
      {error && <Typography role="alert" variant="14/regular" className="rounded-lg bg-error-50 p-3 text-error-700">{error}</Typography>}
      {tickets.length === 0 ? <Typography variant="16/regular" className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center text-neutral-500">هنوز تیکتی ثبت نکرده‌اید.</Typography> : <div className="space-y-4">{tickets.map((ticket) => <article key={ticket.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Typography as="h2" variant="16/semibold" className="text-neutral-900">{ticket.subject}</Typography>
          <Typography variant="12/regular" className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-600">{statusLabel[ticket.status] ?? ticket.status}</Typography>
        </div>
        <Typography variant="14/regular" className="mt-3 whitespace-pre-wrap text-neutral-600">{ticket.message}</Typography>
        {ticket.response && <Typography variant="14/regular" className="mt-3 rounded-lg bg-brand-50 p-3 text-brand-900">پاسخ پشتیبانی: {ticket.response}</Typography>}
      </article>)}</div>}
      <SupportModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSuccess={refresh} />
    </main>
  )
}
