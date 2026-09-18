'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { formatDate, formatTime, type SupportMessageDto, type SupportTicketDto } from '@/utilities/dashboard-api'

interface SupportTicketActionsProps {
  id: string
  status: SupportTicketDto['status']
  isAdmin: boolean
  initialMessages: SupportMessageDto[]
  initialMessageId?: string
  requesterName?: string
}

export function SupportTicketActions({ id, status, isAdmin, initialMessages, initialMessageId, requesterName }: SupportTicketActionsProps) {
  const pending = useRef(false)
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [currentStatus, setCurrentStatus] = useState(status)
  const [response, setResponse] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const act = async (action: 'respond' | 'close') => {
    if (pending.current || currentStatus === 'closed' || (action === 'respond' && !response.trim())) return
    pending.current = true
    setBusy(true)
    setNotice(null)
    try {
      const result = await fetch(`/api/dashboard/support/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        headers: action === 'respond' ? { 'content-type': 'application/json' } : undefined,
        body: action === 'respond' ? JSON.stringify({ body: response.trim() }) : undefined,
      })
      if (!result.ok) throw new Error('support_action_failed')
      const data = (await result.json()) as { ticket: SupportTicketDto }
      setMessages(data.ticket.messages ?? messages)
      setCurrentStatus(data.ticket.status)
      setResponse('')
      setNotice(action === 'close' ? 'تیکت لغو شد.' : 'پاسخ شما ارسال شد.')
      router.refresh()
    } catch {
      setNotice('عملیات انجام نشد. دوباره تلاش کنید.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <section id="support-conversation" tabIndex={-1} className="mt-6 flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5" dir="rtl" aria-label="گفتگوی تیکت">
      <Typography as="h2" variant="20/bold" className="text-neutral-700">گفتگوی تیکت</Typography>
      <div className="flex flex-col gap-3">
        {messages.filter((message) => message.id !== initialMessageId).map((message) => {
          const mine = isAdmin ? message.authorRole === 'staff' : message.authorRole === 'applicant'
          return (
            <article key={message.id} className={`max-w-[85%] rounded-2xl p-4 ${mine ? 'self-start bg-brand-50' : 'self-end bg-neutral-100'}`}>
              <Typography variant="12/semibold" className={mine ? 'text-brand-600' : 'text-neutral-600'}>
                {message.authorRole === 'staff' ? 'پشتیبانی' : requesterName || 'شرکت متقاضی'}
              </Typography>
              <Typography variant="14/regular" className="mt-1 whitespace-pre-wrap break-words text-neutral-700">{message.body}</Typography>
              <Typography as="span" variant="12/regular" className="mt-1 block text-neutral-400">
                {formatDate(message.createdAt)}، {formatTime(message.createdAt)}
              </Typography>
            </article>
          )
        })}
      </div>

      {notice && <Typography role="status" variant="14/regular" className="rounded-lg bg-neutral-100 p-3 text-neutral-600">{notice}</Typography>}

      {currentStatus === 'closed' ? (
        <Typography variant="14/semibold" className="rounded-xl bg-neutral-100 p-3 text-neutral-600">این تیکت لغو شده است.</Typography>
      ) : (
        <div className="flex flex-col gap-3">
          <label htmlFor="support-reply">
            <Typography as="span" variant="14/semibold" className="text-neutral-700">پاسخ جدید</Typography>
          </label>
          <textarea
            id="support-reply"
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            rows={4}
            placeholder="متن پاسخ خود را بنویسید..."
            className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="40" disabled={busy || !response.trim()} onClick={() => act('respond')}>
              <Typography as="span" variant="16/semibold" className="text-inherit">ارسال پاسخ</Typography>
            </Button>
            <Button type="button" size="40" variant="destructive" disabled={busy} onClick={() => act('close')}>
              <Typography as="span" variant="16/semibold" className="text-inherit">لغو تیکت</Typography>
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
