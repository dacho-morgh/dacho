'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  formatDate,
  listSupportTickets,
  type SupportTicketDto,
} from '@/utilities/dashboard-api'
import { SupportModal } from './support-modal'
import { DashboardUserTagIcon } from '@/components/icons'

export interface SupportUserViewProps {
  initialTickets: SupportTicketDto[]
  initialError?: boolean
  showHeader?: boolean
  onTicketsChange?: (tickets: SupportTicketDto[]) => void
}

export function SupportUserView({
  initialTickets,
  initialError = false,
  showHeader = true,
  onTicketsChange,
}: SupportUserViewProps) {
  const [tickets, setTickets] = useState(initialTickets)
  const [modalOpen, setModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | SupportTicketDto['status']>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(
    initialError ? 'بارگذاری تیکت‌ها انجام نشد.' : null,
  )

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

  const refresh = async () => {
    try {
      setError(null)
      const result = await listSupportTickets()
      setTickets(result.items)
      if (onTicketsChange) onTicketsChange(result.items)
    } catch {
      setError('به‌روزرسانی تیکت‌ها انجام نشد.')
    }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showHeader ? (
          <Typography as="h2" variant="24/bold" className="text-neutral-900">
            تیکت‌های پشتیبانی
          </Typography>
        ) : (
          <Typography as="h3" variant="16/semibold" className="text-neutral-700">
            لیست درخواست‌ها و تیکت‌های پشتیبانی
          </Typography>
        )}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-white shadow-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <span className="text-sm font-semibold">ثبت تیکت جدید</span>
          <DashboardUserTagIcon className="size-5 shrink-0 stroke-white" />
        </button>
      </div>

      {error && (
        <Typography
          role="alert"
          variant="14/regular"
          className="rounded-xl border border-error-100 bg-error-50 p-3 text-error-700"
        >
          {error}
        </Typography>
      )}

      {/* Filter tabs and search */}
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
            در انتظار پاسخ ({counts.open})
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
          placeholder="جستجو در تیکت‌ها..."
          aria-label="جستجوی تیکت‌ها"
          className="h-10 w-full sm:w-64 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 placeholder:text-neutral-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {filteredTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white p-10 text-center">
          <Typography variant="16/regular" className="text-neutral-500">
            {tickets.length === 0
              ? 'هنوز تیکتی ثبت نکرده‌اید.'
              : 'تیکتی با این مشخصات یافت نشد.'}
          </Typography>
          {tickets.length === 0 && (
            <Button
              type="button"
              variant="outline-gray"
              size="48"
              onClick={() => setModalOpen(true)}
              className="mt-4 rounded-xl"
            >
              ارسال پیام به پشتیبانی
            </Button>
          )}
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
                <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                  <div className="flex items-center justify-between text-xs text-brand-700 font-semibold mb-1">
                    <span>پاسخ پشتیبانی:</span>
                    <span className="text-neutral-400 font-normal">{formatDate(ticket.updatedAt)}</span>
                  </div>
                  <Typography variant="14/regular" className="whitespace-pre-wrap text-neutral-800">
                    {ticket.response}
                  </Typography>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <SupportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={refresh}
      />
    </section>
  )
}
