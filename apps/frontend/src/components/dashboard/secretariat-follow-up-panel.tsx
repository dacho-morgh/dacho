'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { PrivateDocumentDownload } from '@/components/documents/private-document-download'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

import { FinancialBanner, FinancialFacts } from './financial-parts'

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
export function SecretariatFollowUpPanel({
  id,
  companyName = null,
  trackingCode = null,
}: {
  id: string
  /** From the case read, for the summary (Figma 03) and the publication preview (Figma 04). */
  companyName?: string | null
  trackingCode?: string | null
}) {
  const [state, setState] = useState<LoadState>('loading')
  const [data, setData] = useState<CaseFollowUpDto | null>(null)
  const [askBody, setAskBody] = useState('')
  const [resultBody, setResultBody] = useState('')
  const resultBoxRef = useRef<HTMLTextAreaElement>(null)
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
      setMessage(null)
      toast.success(success)
    } catch (error) {
      toast.error('اقدام انجام نشد.')
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
            <Button type="button" variant="outline-gray" size="32" onClick={() => void load()}>
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
  const lastSent = followUp.memos.find((memo) => memo.sentAt)
  const code = trackingCode ? <bdi dir="ltr">{trackingCode}</bdi> : '—'

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6" data-testid="secretariat-follow-up">
      <Typography as="h2" variant="20/bold" color="neutral-900">پیگیری دبیرخانه و انتشار نتیجه</Typography>
      {followUp.published ? (
        <FinancialBanner tone="success" title="نتیجه این پرونده منتشر شده است">
          شرکت متن منتشرشده را در صفحه پرونده و کارتابل خود می‌بیند. اصلاح، نسخه تازه‌ای است که باید دوباره منتشر شود.
        </FinancialBanner>
      ) : hasSentMemo ? (
        <FinancialBanner tone="success" title="پرونده آماده انتشار نتیجه است">
          بسته مالی ثبت شده و یادداشت سرمایه‌گذاری به دبیرخانه رسیده است.
        </FinancialBanner>
      ) : (
        <FinancialBanner tone="info" title="در انتظار یادداشت سرمایه‌گذاری">
          پس از رسیدن یادداشت مسئول سرمایه‌گذاری، درخواست مدارک تکمیلی و انتشار نتیجه ممکن می‌شود.
        </FinancialBanner>
      )}
      <FinancialFacts
        items={[
          { label: 'شرکت', value: companyName ?? 'نامشخص' },
          { label: 'کد درخواست', value: code },
          {
            label: 'یادداشت سرمایه‌گذاری',
            value: lastSent ? `نسخه ${lastSent.version.toLocaleString('fa-IR')} · ${formatDate(lastSent.sentAt)}` : 'هنوز نرسیده',
          },
          { label: 'نتیجه برای شرکت', value: followUp.published ? `منتشر شده · ${formatDate(followUp.published.publishedAt)}` : 'منتشر نشده' },
        ]}
      />

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
              <Textarea
                value={askBody}
                onChange={(event) => setAskBody(event.target.value)}
                maxLength={5000}
                rows={3}
               
              />
            </label>
            <Button
              type="button"
              variant="outline-gray"
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
                <div className="flex min-w-0 flex-col gap-1">
                  <Typography as="span" variant="14/regular" color="neutral-700" className="break-all"><bdi dir="auto">{file.filename}</bdi></Typography>
                  <Typography variant="12/regular" color="neutral-500">
                    {formatDate(file.createdAt)}
                    {file.deliveredAt ? ` · در دسترس مسئول سرمایه‌گذاری از ${formatDate(file.deliveredAt)}` : ''}
                  </Typography>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                <PrivateDocumentDownload documentId={file.id} filename={file.filename} />
                {editable && !file.deliveredAt ? (
                  <Button
                    type="button"
                    variant="outline-gray"
                    size="32"
                    disabled={busy}
                    onClick={() => void run(() => deliverSupplementaryFile(id, file.id), 'مدرک برای مسئول سرمایه‌گذاری قابل بررسی شد.')}
                  >
                    <Typography variant="12/semibold" className="text-inherit">ارجاع به مسئول سرمایه‌گذاری</Typography>
                  </Button>
                ) : null}
                </div>
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
              <Textarea
                ref={resultBoxRef}
                value={resultBody}
                onChange={(event) => setResultBody(event.target.value)}
                maxLength={20000}
                rows={6}
               
              />
            </label>
            <Button
              type="button"
              variant="outline-gray"
              size="40"
              className="w-fit"
              disabled={busy || !trimmed || previewReady}
              onClick={() => void run(() => saveResult(id, trimmed), 'پیش‌نویس ثبت شد. پیش‌نمایش را بررسی کنید و سپس منتشر کنید.')}
            >
              <Typography variant="14/regular" className="text-inherit">ثبت پیش‌نویس و پیش‌نمایش</Typography>
            </Button>
            {previewReady && latest ? (
              <div className="flex flex-col gap-4 rounded-xl border border-neutral-200 p-4" data-testid="result-preview">
                <Typography as="h4" variant="16/semibold" color="neutral-900">پیش‌نمایش پیام شرکت</Typography>
                <Badge variant="primary" size="md">پیش‌نویس نسخه {latest.version.toLocaleString('fa-IR')}</Badge>
                <Typography variant="14/regular" color="neutral-800" className="whitespace-pre-wrap break-words">{latest.body}</Typography>
                <FinancialFacts
                  items={[
                    { label: 'گیرنده', value: companyName ?? 'شرکت صاحب پرونده' },
                    { label: 'کد درخواست', value: code },
                    { label: 'وضعیت انتشار', value: 'هنوز منتشر نشده' },
                  ]}
                />
                <FinancialBanner tone="warning" title="نتیجه در صفحه پرونده و کارتابل شرکت نمایش داده می‌شود">
                  متن را پیش از انتشار بررسی کنید. یادداشت داخلی، امتیازها و مدارک به آن اضافه نمی‌شوند.
                </FinancialBanner>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="40"
                    disabled={busy}
                    onClick={() => void run(() => publishResult(id, latest.version), 'نتیجه منتشر شد.', () => setResultBody(''))}
                  >
                    <Typography variant="14/regular" className="text-inherit">انتشار و ارسال به شرکت</Typography>
                  </Button>
                  <Button type="button" variant="outline-gray" size="40" disabled={busy} onClick={() => resultBoxRef.current?.focus()}>
                    <Typography variant="14/regular" className="text-inherit">بازگشت و ویرایش</Typography>
                  </Button>
                </div>
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
