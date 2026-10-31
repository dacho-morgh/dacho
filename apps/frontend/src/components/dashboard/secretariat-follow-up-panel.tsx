'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  deliverSupplementaryFile,
  formatDate,
  getCaseFollowUp,
  publishResult,
  requestSupplementaryDocuments,
  saveResult,
  type CaseFollowUpDto,
} from '@/utilities/dashboard-api'

const ERROR_MESSAGES: Record<string, string> = {
  investment_stage_closed: 'پرونده دیگر در مرحله پیگیری سرمایه‌گذاری نیست و این اقدام انجام نشد.',
  memo_not_sent: 'هنوز یادداشتی از مسئول سرمایه‌گذاری به دبیرخانه نرسیده است.',
  result_version_stale: 'نسخه تازه‌تری از متن ثبت شده است. صفحه به‌روز شد؛ پیش‌نمایش را دوباره بررسی کنید.',
  invalid_result: 'متن نتیجه خالی یا بیش از حد طولانی است.',
  invalid_supplementary_request: 'متن درخواست خالی یا بیش از حد طولانی است.',
  forbidden: 'این اقدام برای نقش شما مجاز نیست.',
  not_found: 'مورد خواسته‌شده پیدا نشد.',
}

function errorMessage(error: unknown): string {
  const code = error instanceof DashboardApiError ? error.code : ''
  return ERROR_MESSAGES[code] ?? 'اقدام انجام نشد. دوباره تلاش کنید.'
}

type LoadState = 'loading' | 'ready' | 'denied' | 'error'

/**
 * The Secretariat's work on one case: the memos it received, the documents it asks the
 * company for and the separate text it publishes. The memo never prefills that text.
 */
export function SecretariatFollowUpPanel({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>('loading')
  const [data, setData] = useState<CaseFollowUpDto | null>(null)
  const [askBody, setAskBody] = useState('')
  const [resultBody, setResultBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const prefilled = useRef(false)

  const load = useCallback(async () => {
    try {
      const next = await getCaseFollowUp(id)
      setData(next)
      setState('ready')
      // Resume an unpublished draft, once, so a refresh does not read as lost work.
      const latest = next.results[0]
      if (!prefilled.current) {
        prefilled.current = true
        if (latest && !latest.publishedAt) setResultBody(latest.body)
      }
    } catch (error) {
      setState(error instanceof DashboardApiError && error.status === 403 ? 'denied' : 'error')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (action: () => Promise<unknown>, success: string, after?: () => void) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      after?.()
      setMessage({ tone: 'success', text: success })
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) })
    } finally {
      await load()
      setBusy(false)
    }
  }

  // Other roles open this page too; for them the section simply does not exist.
  if (state === 'denied') return null

  if (state === 'loading' || state === 'error') {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-6">
        <Typography as="h2" variant="20/bold" color="neutral-900">پیگیری دبیرخانه و انتشار نتیجه</Typography>
        {state === 'loading' ? (
          <Typography role="status" variant="14/regular" color="neutral-500">در حال بارگذاری…</Typography>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Typography role="alert" variant="14/regular" color="error">دریافت اطلاعات پیگیری انجام نشد.</Typography>
            <Button type="button" variant="outline" size="32" onClick={() => void load()}>
              <Typography variant="12/semibold" className="text-inherit">تلاش دوباره</Typography>
            </Button>
          </div>
        )}
      </section>
    )
  }

  const followUp = data as CaseFollowUpDto
  const editable = followUp.canAct && followUp.stageOpen
  const hasSentMemo = followUp.memos.some((memo) => memo.sentAt)
  const latest = followUp.results[0]
  const trimmed = resultBody.trim()
  const previewReady = Boolean(latest && !latest.publishedAt && latest.body === trimmed)

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-6">
      <Typography as="h2" variant="20/bold" color="neutral-900">پیگیری دبیرخانه و انتشار نتیجه</Typography>

      {message ? (
        <Typography role={message.tone === 'error' ? 'alert' : 'status'} variant="14/regular" color={message.tone === 'error' ? 'error' : 'neutral-700'}>
          {message.text}
        </Typography>
      ) : null}
      {followUp.canAct && !followUp.stageOpen ? (
        <Typography variant="14/regular" color="neutral-500">پرونده در مرحله پیگیری سرمایه‌گذاری نیست؛ فقط مشاهده امکان‌پذیر است.</Typography>
      ) : null}

      <div className="flex flex-col gap-3">
        <Typography as="h3" variant="16/semibold" color="neutral-900">یادداشت‌های سرمایه‌گذاری (داخلی)</Typography>
        <Typography variant="14/regular" color="neutral-500">این یادداشت‌ها هرگز برای شرکت منتشر نمی‌شوند.</Typography>
        {followUp.memos.length ? (
          <ul className="flex flex-col gap-2">
            {followUp.memos.map((memo) => (
              <li key={memo.id} className="rounded-lg border border-neutral-200 p-3">
                <Typography variant="12/regular" color="neutral-500">
                  نسخه {memo.version} · {memo.authorName ?? 'مسئول سرمایه‌گذاری'} · {memo.sentAt ? `ارسال ${formatDate(memo.sentAt)}` : 'پیش‌نویس'}
                </Typography>
                <Typography variant="14/regular" color="neutral-700" className="mt-1 whitespace-pre-wrap">{memo.body}</Typography>
              </li>
            ))}
          </ul>
        ) : (
          <Typography variant="14/regular" color="neutral-400">هنوز یادداشتی نرسیده است.</Typography>
        )}
      </div>

      <div className="h-px bg-neutral-200" />

      <div className="flex flex-col gap-3">
        <Typography as="h3" variant="16/semibold" color="neutral-900">درخواست مدارک تکمیلی از شرکت</Typography>
        <Typography variant="14/regular" color="neutral-500">این درخواست به صورت نامه به شرکت می‌رسد و نتیجه پرونده نیست.</Typography>
        {followUp.supplementaryRequests.length ? (
          <ul className="flex flex-col gap-2">
            {followUp.supplementaryRequests.map((item) => (
              <li key={item.id} className="rounded-lg border border-neutral-200 p-3">
                <Typography variant="12/regular" color="neutral-500">{formatDate(item.createdAt)}</Typography>
                <Typography variant="14/regular" color="neutral-700" className="mt-1 whitespace-pre-wrap">{item.body}</Typography>
              </li>
            ))}
          </ul>
        ) : null}
        {editable && hasSentMemo ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <Typography variant="12/regular" color="neutral-500">متن درخواست</Typography>
              <textarea
                value={askBody}
                onChange={(event) => setAskBody(event.target.value)}
                maxLength={5000}
                rows={3}
                className="rounded-lg border border-neutral-200 bg-white p-3"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="40"
              className="w-fit"
              disabled={busy || !askBody.trim()}
              onClick={() => void run(() => requestSupplementaryDocuments(id, askBody.trim()), 'درخواست برای شرکت ارسال شد.', () => setAskBody(''))}
            >
              <Typography variant="14/regular" className="text-inherit">ارسال درخواست به شرکت</Typography>
            </Button>
          </div>
        ) : null}

        <Typography as="h4" variant="14/semibold" color="neutral-700">پاسخ‌های شرکت</Typography>
        {followUp.files.length ? (
          <ul className="flex flex-col gap-2">
            {followUp.files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 p-3">
                <div className="min-w-0">
                  <a href={file.downloadUrl} className="break-all">
                    <Typography as="span" variant="14/regular" color="brand-600">{file.filename}</Typography>
                  </a>
                  <Typography variant="12/regular" color="neutral-500">
                    {formatDate(file.createdAt)}
                    {file.deliveredAt ? ` · در دسترس مسئول سرمایه‌گذاری از ${formatDate(file.deliveredAt)}` : ''}
                  </Typography>
                </div>
                {editable && !file.deliveredAt ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="32"
                    disabled={busy}
                    onClick={() => void run(() => deliverSupplementaryFile(id, file.id), 'مدرک برای مسئول سرمایه‌گذاری قابل بررسی شد.')}
                  >
                    <Typography variant="12/semibold" className="text-inherit">ارجاع به مسئول سرمایه‌گذاری</Typography>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <Typography variant="14/regular" color="neutral-400">هنوز فایلی از شرکت نرسیده است.</Typography>
        )}
      </div>

      <div className="h-px bg-neutral-200" />

      <div className="flex flex-col gap-3">
        <Typography as="h3" variant="16/semibold" color="neutral-900">متن نتیجه برای شرکت</Typography>
        <Typography variant="14/regular" color="neutral-500">
          فقط همین متن و فقط پس از انتشار به شرکت نشان داده می‌شود. یادداشت داخلی، امتیازها و مدارک به آن اضافه نمی‌شوند.
        </Typography>
        {followUp.published ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <Typography variant="12/regular" color="neutral-500">آنچه اکنون شرکت می‌بیند · {formatDate(followUp.published.publishedAt)}</Typography>
            <Typography variant="14/regular" color="neutral-800" className="mt-1 whitespace-pre-wrap">{followUp.published.body}</Typography>
          </div>
        ) : (
          <Typography variant="14/regular" color="neutral-400">هنوز نتیجه‌ای منتشر نشده است.</Typography>
        )}
        {editable && hasSentMemo ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <Typography variant="12/regular" color="neutral-500">متن جداگانه نتیجه</Typography>
              <textarea
                value={resultBody}
                onChange={(event) => setResultBody(event.target.value)}
                maxLength={20000}
                rows={6}
                className="rounded-lg border border-neutral-200 bg-white p-3"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="40"
              className="w-fit"
              disabled={busy || !trimmed || previewReady}
              onClick={() => void run(() => saveResult(id, trimmed), 'پیش‌نویس ثبت شد. پیش‌نمایش را بررسی کنید و سپس منتشر کنید.')}
            >
              <Typography variant="14/regular" className="text-inherit">ثبت پیش‌نویس و پیش‌نمایش</Typography>
            </Button>
            {previewReady && latest ? (
              <div className="flex flex-col gap-3 rounded-lg border border-brand-600 p-4">
                <Typography variant="12/regular" color="neutral-500">پیش‌نمایش آنچه شرکت خواهد دید · نسخه {latest.version}</Typography>
                <Typography variant="14/regular" color="neutral-800" className="whitespace-pre-wrap">{latest.body}</Typography>
                <Button
                  type="button"
                  size="40"
                  className="w-fit"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm('این متن برای شرکت منتشر می‌شود و شرکت از آن مطلع خواهد شد. ادامه می‌دهید؟')) return
                    void run(() => publishResult(id, latest.version), 'نتیجه منتشر شد.', () => setResultBody(''))
                  }}
                >
                  <Typography variant="14/regular" className="text-inherit">انتشار برای شرکت</Typography>
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {followUp.results.length ? (
          <>
            <Typography as="h4" variant="14/semibold" color="neutral-700">تاریخچه نسخه‌ها</Typography>
            <ul className="flex flex-col gap-2">
              {followUp.results.map((item) => (
                <li key={item.id} className="rounded-lg border border-neutral-200 p-3">
                  <Typography variant="12/regular" color="neutral-500">
                    نسخه {item.version} · {item.authorName ?? 'دبیرخانه'} · {formatDate(item.createdAt)} ·{' '}
                    {item.publishedAt ? `منتشرشده ${formatDate(item.publishedAt)} توسط ${item.publishedByName ?? 'دبیرخانه'}` : 'منتشرنشده'}
                  </Typography>
                  <Typography variant="14/regular" color="neutral-700" className="mt-1 whitespace-pre-wrap">{item.body}</Typography>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  )
}
