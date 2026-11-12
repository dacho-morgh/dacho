'use client'

import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { DashboardApiError, describeMutationFailure, formatDate, formatTime, type SupportMessageDto, type SupportTicketDto } from '@/utilities/dashboard-api'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface SupportReplyState {
  open: boolean
  openReply: () => void
}

const SupportReplyContext = createContext<SupportReplyState | null>(null)

/** Shares «the reader pressed ثبت بازخورد» between the mail header button and the conversation below it. */
export function SupportReplyProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <SupportReplyContext.Provider value={{ open, openReply: () => setOpen(true) }}>{children}</SupportReplyContext.Provider>
}

/** Null outside a ticket page, where the button has nothing to open. */
export function useSupportReply(): SupportReplyState | null {
  return useContext(SupportReplyContext)
}

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
  const replyState = useSupportReply()
  const replyOpen = replyState?.open ?? true
  const history = messages.filter((message) => message.id !== initialMessageId)

  // The reply form appears only once the reader asks for it; then it takes the focus.
  useEffect(() => {
    if (!replyState?.open) return
    const field = document.getElementById('support-reply')
    field?.scrollIntoView({ block: 'center' })
    field?.focus({ preventScroll: true })
  }, [replyState?.open])

  const act = async (action: 'respond' | 'close') => {
    if (pending.current || currentStatus === 'closed' || (action === 'respond' && !response.trim())) return
    pending.current = true
    setBusy(true)
    try {
      const result = await fetch(`/api/dashboard/support/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        headers: action === 'respond' ? { 'content-type': 'application/json' } : undefined,
        body: action === 'respond' ? JSON.stringify({ body: response.trim() }) : undefined,
      })
      if (!result.ok) throw new DashboardApiError(result.status, 'support_action_failed')
      const data = (await result.json()) as { ticket: SupportTicketDto }
      setMessages(data.ticket.messages ?? messages)
      setCurrentStatus(data.ticket.status)
      setResponse('')
      toast.success(action === 'close' ? 'تیکت لغو شد.' : 'پاسخ شما ارسال شد.')
      router.refresh()
    } catch (cause) {
      toast.error(describeMutationFailure(cause, 'عملیات انجام نشد. دوباره تلاش کنید.'))
      // The ticket changed under this page: show its current state, keep the typed reply.
      if (cause instanceof DashboardApiError && cause.status === 409) router.refresh()
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  // Nothing to show yet: no earlier answers and the form has not been asked for.
  if (!history.length && !replyOpen && currentStatus !== 'closed') return null

  return (
    <section id="support-conversation" tabIndex={-1} className="mt-6 flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-background p-5" dir="rtl" aria-label="گفتگوی تیکت">
      <Typography as="h2" variant="20/bold" className="text-neutral-700">گفتگوی تیکت</Typography>
      <div className="flex flex-col gap-3">
        {history.map((message) => {
          const mine = isAdmin ? message.authorRole === 'admin' : message.authorRole === 'representative'
          return (
            <article key={message.id} className={`max-w-[85%] rounded-2xl p-4 ${mine ? 'self-start bg-brand-50' : 'self-end bg-neutral-100'}`}>
              <Typography variant="12/semibold" className={mine ? 'text-brand-600' : 'text-neutral-600'}>
                {message.authorRole === 'admin' ? 'پشتیبانی' : requesterName || 'شرکت متقاضی'}
              </Typography>
              <Typography variant="14/regular" className="mt-1 whitespace-pre-wrap break-words text-neutral-700">{message.body}</Typography>
              <Typography as="span" variant="12/regular" className="mt-1 block text-neutral-400">
                {formatDate(message.createdAt)}، {formatTime(message.createdAt)}
              </Typography>
            </article>
          )
        })}
      </div>

      {currentStatus === 'closed' ? (
        <Typography variant="14/semibold" className="rounded-xl bg-neutral-100 p-3 text-neutral-600">این تیکت لغو شده است.</Typography>
      ) : replyOpen && (
        <div className="flex flex-col gap-3">
          <label htmlFor="support-reply">
            <Typography as="span" variant="14/semibold" className="text-neutral-700">پاسخ جدید</Typography>
          </label>
          <Textarea
            id="support-reply"
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            rows={4}
            placeholder="متن پاسخ خود را بنویسید..."
            className="w-full"
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
