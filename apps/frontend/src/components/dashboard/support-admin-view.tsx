'use client'

import { useMemo, useState } from 'react'
import type { SupportTicketDto } from '@/utilities/dashboard-api'
import { formatDate } from '@/utilities/dashboard-api'
import { Typography } from '@/components/ui/typography'
import { Button } from '@/components/ui/button'

export interface SupportAdminViewProps {
  initialTickets: SupportTicketDto[]
  initialError?: boolean
  showHeader?: boolean
  onTicketsChange?: (tickets: SupportTicketDto[]) => void
}

export function SupportAdminView({
  initialTickets,
  initialError = false,
  showHeader = true,
  onTicketsChange,
}: SupportAdminViewProps) {
  const [tickets, setTickets] = useState(initialTickets)
  const [statusFilter, setStatusFilter] = useState<'all' | SupportTicketDto['status']>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(
    initialError ? 'بارگذاری تیکت‌ها انجام نشد.' : null,
  )
  const [processingId, setProcessingId] = useState<string | null>(null)

  const statusLabel: Record<SupportTicketDto['status'], string> = {
    open: 'باز',
    answered: 'پاسخ داده شده',
    closed: 'بسته شده',
  }

  const statusBadgeColor: Record<SupportTicketDto['status'], string> = {
    open: 'bg-amber-50 text-amber-700 border-amber-200',
    answered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  }

  const updateTickets = (updater: (current: SupportTicketDto[]) => SupportTicketDto[]) => {
    setTickets((current) => {
      const next = updater(current)
      if (onTicketsChange) onTicketsChange(next)
      return next
    })
  }

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter
      const matchesSearch =
        q.length === 0 ||
        ticket.subject.toLowerCase().includes(q) ||
        ticket.message.toLowerCase().includes(q) ||
        (ticket.response && ticket.response.toLowerCase().includes(q))
      return matchesStatus && matchesSearch
    })
  }, [tickets, statusFilter, searchQuery])

  const respond = async (id: string) => {
    const body = responses[id]?.trim()
    if (!body) return
    setProcessingId(id)
    setActionError(null)
    try {
      const result = await fetch(`/api/dashboard/support/${encodeURIComponent(id)}/respond`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!result.ok) throw new Error('respond_failed')
      const data = (await result.json()) as { ticket: SupportTicketDto }
      updateTickets((current) => current.map((ticket) => (ticket.id === id ? data.ticket : ticket)))
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
      const result = await fetch(`/api/dashboard/support/${encodeURIComponent(id)}/close`, {
        method: 'POST',
      })
      if (!result.ok) throw new Error('close_failed')
      const data = (await result.json()) as { ticket: SupportTicketDto }
      updateTickets((current) => current.map((ticket) => (ticket.id === id ? data.ticket : ticket)))
    } catch {
      setActionError('بستن تیکت انجام نشد. لطفاً دوباره تلاش کنید.')
    } finally {
      setProcessingId(null)
    }
  }

  const counts = useMemo(
    () => ({
      all: tickets.length,
      open: tickets.filter((t) => t.status === 'open').length,
      answered: tickets.filter((t) => t.status === 'answered').length,
      closed: tickets.filter((t) => t.status === 'closed').length,
    }),
    [tickets],
  )

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4 text-right" dir="rtl">
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Typography as="h2" variant="20/bold" className="text-neutral-900">
            تیکت‌های پشتیبانی کاربران
          </Typography>
        </div>
      )}

      {actionError && (
        <Typography
          role="alert"
          variant="14/regular"
          className="rounded-xl border border-error-100 bg-error-50 p-3 text-error-700"
        >
          {actionError}
        </Typography>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl bg-neutral-100 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            همه ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('open')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              statusFilter === 'open'
                ? 'bg-white text-amber-700 shadow-xs font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            باز ({counts.open})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('answered')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              statusFilter === 'answered'
                ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            پاسخ داده شده ({counts.answered})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('closed')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              statusFilter === 'closed'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            بسته شده ({counts.closed})
          </button>
        </div>

        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجو در تیکت‌های پشتیبانی..."
          aria-label="جستجو در تیکت‌ها"
          className="h-10 w-full sm:w-72 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 placeholder:text-neutral-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {filteredTickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center">
          <Typography variant="16/regular" className="text-neutral-500">
            {tickets.length === 0
              ? 'تیکتی برای نمایش وجود ندارد.'
              : 'تیکتی مطابق با فیلتر یا عبارت جستجو یافت نشد.'}
          </Typography>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <article
              key={ticket.id}
              className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs transition-colors hover:border-neutral-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      statusBadgeColor[ticket.status]
                    }`}
                  >
                    {statusLabel[ticket.status] ?? ticket.status}
                  </span>
                  <Typography as="h3" variant="16/semibold" className="text-neutral-900">
                    {ticket.subject}
                  </Typography>
                </div>
                <Typography variant="12/regular" className="text-neutral-400">
                  {formatDate(ticket.createdAt)}
                </Typography>
              </div>

              <Typography variant="14/regular" className="mt-3 whitespace-pre-wrap text-neutral-600 leading-relaxed">
                {ticket.message}
              </Typography>

              {ticket.response && (
                <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                  <div className="flex items-center justify-between text-xs text-brand-700 font-semibold mb-1">
                    <span>پاسخ ثبت شده توسط کارشناس پشتیبانی:</span>
                    <span className="text-neutral-400 font-normal">{formatDate(ticket.updatedAt)}</span>
                  </div>
                  <Typography variant="14/regular" className="whitespace-pre-wrap text-neutral-800">
                    {ticket.response}
                  </Typography>
                </div>
              )}

              {ticket.status !== 'closed' && (
                <div className="mt-4 flex flex-col gap-2 pt-2 sm:flex-row">
                  <textarea
                    value={responses[ticket.id] ?? ''}
                    onChange={(event) =>
                      setResponses((current) => ({ ...current, [ticket.id]: event.target.value }))
                    }
                    className="min-h-20 flex-1 rounded-xl border border-neutral-200 p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    placeholder="پاسخ به این تیکت (ارسال پاسخ به صورت خودکار یک نامه رسمی برای متقاضی نیز ایجاد می‌کند)..."
                  />
                  <div className="flex sm:flex-col gap-2 justify-end">
                    <Button
                      type="button"
                      disabled={processingId === ticket.id || !responses[ticket.id]?.trim()}
                      onClick={() => respond(ticket.id)}
                      className="rounded-xl whitespace-nowrap"
                    >
                      {processingId === ticket.id ? 'در حال ارسال...' : 'ارسال پاسخ'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline-gray"
                      disabled={processingId === ticket.id}
                      onClick={() => close(ticket.id)}
                      className="rounded-xl whitespace-nowrap"
                    >
                      بستن تیکت
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
