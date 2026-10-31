'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  formatDate,
  listInvestmentMemos,
  saveInvestmentMemo,
  sendInvestmentMemo,
  type InvestmentMemoDto,
} from '@/utilities/dashboard-api'

const ERROR_MESSAGES: Record<string, string> = {
  investment_stage_closed: 'پرونده دیگر در مرحله پیگیری سرمایه‌گذاری نیست و این اقدام انجام نشد.',
  memo_version_stale: 'نسخه تازه‌تری از یادداشت ثبت شده است. صفحه به‌روز شد؛ دوباره بررسی کنید.',
  invalid_memo: 'متن یادداشت خالی یا بیش از حد طولانی است.',
  not_found: 'پرونده دیگر در اختیار شما نیست.',
}

type LoadState = 'loading' | 'ready' | 'absent' | 'error'

/**
 * The investment person's only action: a versioned memo sent to the Secretariat. It
 * decides nothing about the case. Before the handoff the server answers 404, and the
 * section does not exist.
 */
export function InvestmentMemoPanel({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>('loading')
  const [memos, setMemos] = useState<InvestmentMemoDto[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const prefilled = useRef(false)

  const load = useCallback(async () => {
    try {
      const next = await listInvestmentMemos(id)
      const sorted = [...next.memos].sort((a, b) => b.version - a.version)
      setMemos(sorted)
      setState('ready')
      // Resume an unsent draft, once, so a refresh does not read as lost work.
      if (!prefilled.current) {
        prefilled.current = true
        if (sorted[0] && !sorted[0].sentAt) setBody(sorted[0].body)
      }
    } catch (cause) {
      const absent = cause instanceof DashboardApiError && (cause.status === 403 || cause.status === 404)
      setState(absent ? 'absent' : 'error')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (command: () => Promise<unknown>, success: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await command()
      setMessage({ tone: 'success', text: success })
    } catch (cause) {
      const code = cause instanceof DashboardApiError ? cause.code : ''
      setMessage({ tone: 'error', text: ERROR_MESSAGES[code] ?? 'اقدام انجام نشد. دوباره تلاش کنید.' })
    } finally {
      await load()
      setBusy(false)
    }
  }

  if (state === 'absent') return null

  const latest = memos[0]
  const trimmed = body.trim()
  const canSend = Boolean(latest && !latest.sentAt && latest.body === trimmed)

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-brand-600 bg-white p-6">
      <Typography as="h2" variant="20/bold" color="neutral-900">یادداشت سرمایه‌گذاری</Typography>
      {state === 'loading' ? (
        <Typography role="status" variant="14/regular" color="neutral-500">در حال بارگذاری…</Typography>
      ) : state === 'error' ? (
        <div className="flex flex-wrap items-center gap-3">
          <Typography role="alert" variant="14/regular" color="error">دریافت یادداشت‌ها انجام نشد.</Typography>
          <Button type="button" variant="outline" size="32" onClick={() => void load()}>
            <Typography variant="12/semibold" className="text-inherit">تلاش دوباره</Typography>
          </Button>
        </div>
      ) : (
        <>
          <Typography variant="14/regular" color="neutral-500">
            این یادداشت به دبیرخانه می‌رسد، تصمیمی درباره پرونده نیست و برای شرکت منتشر نمی‌شود.
          </Typography>
          {message ? (
            <Typography role={message.tone === 'error' ? 'alert' : 'status'} variant="14/regular" color={message.tone === 'error' ? 'error' : 'neutral-700'}>
              {message.text}
            </Typography>
          ) : null}
          <label className="flex flex-col gap-1">
            <Typography variant="12/regular" color="neutral-500">متن یادداشت</Typography>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} disabled={busy} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="40"
              disabled={busy || !trimmed || canSend}
              onClick={() => void run(() => saveInvestmentMemo(id, trimmed), 'نسخه تازه یادداشت ثبت شد.')}
            >
              <Typography variant="14/regular" className="text-inherit">ثبت نسخه</Typography>
            </Button>
            <Button
              type="button"
              size="40"
              disabled={busy || !canSend}
              onClick={() => {
                if (!latest || !window.confirm('این نسخه برای دبیرخانه ارسال شود؟')) return
                void run(() => sendInvestmentMemo(id, latest.version), 'یادداشت برای دبیرخانه ارسال شد.')
              }}
            >
              <Typography variant="14/regular" className="text-inherit">ارسال به دبیرخانه</Typography>
            </Button>
          </div>
          {memos.length ? (
            <ul className="flex flex-col gap-2">
              {memos.map((memo) => (
                <li key={memo.id} className="rounded-lg border border-neutral-200 p-3">
                  <Typography variant="12/regular" color="neutral-500">
                    نسخه {memo.version.toLocaleString('fa-IR')} · {memo.sentAt ? `ارسال ${formatDate(memo.sentAt)}` : `پیش‌نویس ${formatDate(memo.createdAt)}`}
                  </Typography>
                  <Typography variant="14/regular" color="neutral-700" className="mt-1 whitespace-pre-wrap">{memo.body}</Typography>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  )
}
