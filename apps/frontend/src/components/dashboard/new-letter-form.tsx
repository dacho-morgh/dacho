'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import { DashboardApiError, describeMutationFailure, LETTER_TYPE_LABELS, type LetterType, type RequestDto } from '@/utilities/dashboard-api'
import type { PrivateDocumentDto } from '@/utilities/document-api'
import { NativeSelect } from '@/components/ui/native-select'

export interface LetterRecipient {
  id: string
  companyName?: string
  name?: string
}

const SUPPORT_PRIORITY_LABELS: Record<string, string> = {
  normal: 'عادی',
  important: 'مهم',
  urgent: 'فوری',
}

type CaseOption = Pick<RequestDto, 'id' | 'trackingCode' | 'title' | 'ownerId'>
export type LetterCaseOption = Pick<RequestDto, 'id' | 'trackingCode' | 'title'>

function caseLabel(item: LetterCaseOption): string {
  return item.trackingCode ? `${item.trackingCode} — ${item.title}` : item.title
}

type CasesState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; items: CaseOption[] }
  | { kind: 'denied' }
  | { kind: 'error' }

/**
 * Correspondence attachments are private request documents, so they need a
 * case parent. The case list comes from the authorized admin request API and
 * is narrowed to the selected recipient; the backend re-checks the sender,
 * recipient and document audience when the letter is sent.
 */
function useRecipientCases(recipientId: string, enabled: boolean): CasesState {
  const [state, setState] = useState<CasesState>({ kind: 'idle' })
  useEffect(() => {
    if (!enabled || !recipientId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: 'idle' })
      return
    }
    let active = true
    setState({ kind: 'loading' })
    fetch('/api/dashboard/admin/requests?limit=100', { cache: 'no-store' })
      .then(async (response) => {
        if (!active) return
        if (response.status === 401 || response.status === 403) {
          setState({ kind: 'denied' })
          return
        }
        if (!response.ok) throw new Error('cases_unavailable')
        const body = (await response.json()) as { items?: CaseOption[] }
        if (!active) return
        const items = Array.isArray(body?.items) ? body.items.filter((item) => item.ownerId === recipientId) : []
        setState({ kind: 'ready', items })
      })
      .catch(() => {
        if (active) setState({ kind: 'error' })
      })
    return () => {
      active = false
    }
  }, [enabled, recipientId])
  return state
}

export interface NewLetterFormProps {
  mode?: 'admin' | 'support' | 'letter'
  companies?: LetterRecipient[]
  recipientsError?: boolean
  /** The case this letter belongs to; recipients and attachments follow it. */
  requestId?: string
  caseTitle?: string
  /** Cases the sender may choose from; without it a given case stays fixed. */
  caseOptions?: LetterCaseOption[]
  casesError?: boolean
  /** The backend sends these roles' letters as official whatever the form says. */
  officialOnly?: boolean
  initialRecipientId?: string
  initialTitle?: string
}

export function NewLetterForm({
  mode = 'admin',
  companies = [],
  recipientsError = false,
  requestId,
  caseTitle,
  caseOptions,
  casesError = false,
  officialOnly = false,
  initialRecipientId,
  initialTitle,
}: NewLetterFormProps) {
  const router = useRouter()
  const submitting = useRef(false)
  const sendAttempt = useRef<{ payload: string; key: string | undefined } | null>(null)
  const [changingCase, startCaseChange] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipientId, setRecipientId] = useState(initialRecipientId ?? '')
  const [caseId, setCaseId] = useState('')
  const [attachments, setAttachments] = useState<PrivateDocumentDto[]>([])
  const [uploading, setUploading] = useState(false)

  const isSupport = mode === 'support'
  const cases = useRecipientCases(recipientId, mode === 'admin' && !requestId)
  const selectedCaseId = requestId ?? caseId
  const letterTypes = Object.entries(LETTER_TYPE_LABELS).filter(([value]) => !officialOnly || value === 'official')

  function chooseCase(nextCaseId: string) {
    setRecipientId('')
    setAttachments([])
    startCaseChange(() => {
      router.push(nextCaseId ? `/dashboard/letters/new?requestId=${encodeURIComponent(nextCaseId)}` : '/dashboard/letters/new')
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') ?? '').trim()
    const body = String(data.get('body') ?? '').trim()

    if (isSupport) {
      const priority = String(data.get('priority') ?? 'normal')
      if (!title || !body) {
        setError('موضوع و متن پیام را تکمیل کنید.')
        return
      }
      submitting.current = true
      setSaving(true)
      setError(null)
      try {
        const priorityLabel = SUPPORT_PRIORITY_LABELS[priority] ?? 'عادی'
        const subject = `[اولویت: ${priorityLabel}] ${title}`
        const response = await fetch('/api/dashboard/support', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subject, message: body }),
        })
        if (!response.ok) throw new DashboardApiError(response.status, 'ticket_not_created')
        const result = await response.json()
        if (!result?.ticket?.id) throw new Error('ticket_not_created')
        router.push('/dashboard/letters')
        router.refresh()
      } catch (cause) {
        setError(describeMutationFailure(cause, 'ارسال پیام پشتیبانی انجام نشد. لطفاً دوباره تلاش کنید.'))
      } finally {
        submitting.current = false
        setSaving(false)
      }
      return
    }

    const type = String(data.get('type') ?? '') as LetterType
    if (!companies.some((company) => company.id === recipientId) || !title || !body || !Object.hasOwn(LETTER_TYPE_LABELS, type)) {
      setError('گیرنده، عنوان، نوع و متن نامه را تکمیل کنید.')
      return
    }
    if (uploading) {
      setError('تا پایان بارگذاری پیوست‌ها صبر کنید.')
      return
    }
    // Only attachments uploaded to the currently selected case are sent; a
    // file left over from a previous case selection is never submitted.
    const attachmentIds = selectedCaseId
      ? attachments.filter((document) => document.requestId === selectedCaseId).map((document) => document.id)
      : []
    const payload = JSON.stringify({
      recipientId,
      title,
      type,
      body,
      ...(selectedCaseId ? { requestId: selectedCaseId } : {}),
      ...(attachmentIds.length ? { attachmentIds } : {}),
    })
    // A retry of the same letter reuses its key, so a response lost on the way
    // back cannot send it twice; any edit makes it a new letter.
    if (sendAttempt.current?.payload !== payload) {
      sendAttempt.current = { payload, key: globalThis.crypto?.randomUUID?.() }
    }
    const idempotencyKey = sendAttempt.current.key
    submitting.current = true
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(mode === 'admin' ? '/api/dashboard/admin/letters' : '/api/dashboard/letters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...JSON.parse(payload), ...(idempotencyKey ? { idempotencyKey } : {}) }),
      })
      if (!response.ok) throw new DashboardApiError(response.status, 'letter_not_created')
      const result = await response.json()
      if (!result?.letter?.id) throw new Error('letter_not_created')
      router.push('/dashboard/letters')
      router.refresh()
    } catch (cause) {
      setError(describeMutationFailure(cause, 'ارسال نامه انجام نشد. لطفاً دوباره تلاش کنید.'))
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label={isSupport ? 'ارسال پیام به پشتیبانی' : 'ارسال نامه جدید'}
      className="flex min-h-screen w-full flex-col gap-4 bg-neutral-50 px-4 pb-4 pt-10"
      dir="rtl"
    >
      <header className="flex min-h-10 flex-wrap items-center justify-between gap-4">
        <nav aria-label="مسیر صفحه" className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/letters">
            <Typography as="span" variant="16/regular" className="text-neutral-500">کارتابل نامه</Typography>
          </Link>
          <Typography as="span" variant="16/regular" className="text-neutral-500" aria-hidden="true">/</Typography>
          <Typography as="h1" variant="24/bold" className="text-neutral-700">
            {isSupport ? 'ارسال پیام به پشتیبانی' : 'ارسال نامه جدید'}
          </Typography>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline-gray"
            size="40"
            disabled={saving}
            onClick={() => router.push('/dashboard/letters')}
          >
            <Typography as="span" variant="16/semibold" className="text-inherit">لغو</Typography>
          </Button>
          <Button
            type="submit"
            size="40"
            disabled={saving || uploading || changingCase || (!isSupport && !companies.length)}
          >
            <Typography as="span" variant="16/semibold" className="text-inherit">
              {saving ? 'در حال ارسال...' : isSupport ? 'ارسال پیام' : 'ارسال نامه'}
            </Typography>
          </Button>
        </div>
      </header>

      <section aria-label={isSupport ? 'اطلاعات پیام' : 'اطلاعات نامه'} className="flex flex-1 flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-4 lg:min-h-[calc(100svh-112px)]">
        {/* Recipient field */}
        <div className="flex flex-col gap-2">
          <Typography as="label" htmlFor="letter-recipient" variant="16/semibold" className="text-neutral-700">
            گیرنده
          </Typography>
          {isSupport ? (
            <Input
              id="letter-recipient"
              name="recipientName"
              disabled
              value="پشتیبانی کارخانه نوآوری صنایع انرژی بوشهر"
            />
          ) : (
            <>
              <NativeSelect
                id="letter-recipient"
                name="recipientId"
                required
                value={recipientId}
                onChange={(event) => {
                  setRecipientId(event.target.value)
                  if (requestId) return
                  setCaseId('')
                  setAttachments([])
                }}
                disabled={saving || uploading || changingCase || !companies.length}
              >
                <option value="" disabled>انتخاب گیرنده</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.companyName || company.name || company.id}
                  </option>
                ))}
              </NativeSelect>
              {!companies.length && (
                <Typography
                  role={recipientsError ? 'alert' : 'status'}
                  variant="12/regular"
                  className="text-neutral-500"
                >
                  {recipientsError
                    ? 'دریافت گیرندگان انجام نشد. صفحه را دوباره بارگذاری کنید.'
                    : caseOptions && !requestId
                      ? 'برای نوشتن نامه، ابتدا پرونده مرتبط را انتخاب کنید.'
                      : 'گیرنده‌ای برای ارسال نامه وجود ندارد.'}
                </Typography>
              )}
            </>
          )}
        </div>

        {/* Title and Type / Priority fields side by side */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Typography as="label" htmlFor="letter-title" variant="16/semibold" className="text-neutral-700">
              {isSupport ? 'موضوع پیام پشتیبانی' : 'عنوان نامه'}
            </Typography>
            <Input
              id="letter-title"
              name="title"
              required
              disabled={saving}
              defaultValue={initialTitle}
              placeholder={isSupport ? 'موضوع پیام خود را وارد کنید' : 'متن پلیس هولدر'}
              className="placeholder:font-[150]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Typography as="label" htmlFor="letter-type" variant="16/semibold" className="text-neutral-700">
              {isSupport ? 'میزان اهمیت' : 'نوع نامه'}
            </Typography>
            {isSupport ? (
              <NativeSelect
                id="letter-type"
                name="priority"
                required
                defaultValue="normal"
                disabled={saving}
              >
                {Object.entries(SUPPORT_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </NativeSelect>
            ) : (
              <NativeSelect
                id="letter-type"
                name="type"
                required
                defaultValue={officialOnly ? 'official' : ''}
                disabled={saving}
              >
                {!officialOnly && <option value="" disabled>انتخاب نوع نامه</option>}
                {letterTypes.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </NativeSelect>
            )}
          </div>
        </div>

        {/* Body field */}
        <div className="flex flex-col gap-2">
          <Typography as="label" htmlFor="letter-body" variant="16/semibold" className="text-neutral-700">
            {isSupport ? 'متن پیام' : 'متن نامه'}
          </Typography>
          <Textarea
            id="letter-body"
            name="body"
            required
            disabled={saving}
            placeholder={isSupport ? 'متن پیام یا درخواست پشتیبانی خود را بنویسید...' : 'متن پلیس هولدر'}
            className="h-[380px] min-h-[380px] resize-y"
          />
        </div>

        {isSupport ? (
          /* Support tickets have no attachment contract on the backend. */
          <Input
            label="فایل پیوست"
            type="file"
            disabled
            hint="ارسال فایل پیوست در پیام پشتیبانی پشتیبانی نمی‌شود."
          />
        ) : (
          <div className="flex flex-col gap-2">
            <Typography as="label" htmlFor="letter-case" variant="16/semibold" className="text-neutral-700">
              {requestId && !caseOptions ? 'پرونده مرتبط' : 'پرونده مرتبط (اختیاری)'}
            </Typography>
            {requestId && !caseOptions ? (
              <Input id="letter-case" disabled value={caseTitle ?? 'پرونده این نامه'} />
            ) : caseOptions ? (
              <NativeSelect
                id="letter-case"
                name="requestId"
                value={requestId ?? ''}
                onChange={(event) => chooseCase(event.target.value)}
                disabled={saving || uploading || changingCase}
              >
                <option value="">بدون پرونده</option>
                {requestId && !caseOptions.some((item) => item.id === requestId) ? (
                  <option value={requestId}>{caseTitle ?? 'پرونده انتخاب‌شده'}</option>
                ) : null}
                {caseOptions.map((item) => (
                  <option key={item.id} value={item.id}>{caseLabel(item)}</option>
                ))}
              </NativeSelect>
            ) : (
              <NativeSelect
                id="letter-case"
                name="requestId"
                value={caseId}
                onChange={(event) => {
                  setCaseId(event.target.value)
                  setAttachments([])
                }}
                disabled={saving || uploading || cases.kind !== 'ready' || cases.items.length === 0}
              >
                <option value="">بدون پرونده</option>
                {cases.kind === 'ready'
                  ? cases.items.map((item) => (
                      <option key={item.id} value={item.id}>{caseLabel(item)}</option>
                    ))
                  : null}
              </NativeSelect>
            )}
            {casesError ? (
              <Typography role="alert" variant="12/regular" className="text-error-600">
                دریافت پرونده‌ها انجام نشد. صفحه را دوباره بارگذاری کنید.
              </Typography>
            ) : caseOptions && !requestId ? (
              <Typography role="status" variant="12/regular" className="text-neutral-500">
                {caseOptions.length ? 'پیوست فایل فقط برای نامه‌های مرتبط با پرونده ممکن است.' : 'پرونده‌ای برای مکاتبه در دسترس شما نیست.'}
              </Typography>
            ) : null}
            {mode !== 'admin' || requestId ? null : cases.kind === 'idle' ? (
              <Typography variant="12/regular" className="text-neutral-500">
                برای افزودن فایل پیوست، ابتدا گیرنده و سپس پرونده مرتبط را انتخاب کنید.
              </Typography>
            ) : cases.kind === 'loading' ? (
              <Typography role="status" variant="12/regular" className="text-neutral-500">
                در حال دریافت پرونده‌های گیرنده…
              </Typography>
            ) : cases.kind === 'denied' ? (
              <Typography role="status" variant="12/regular" className="text-neutral-500">
                دسترسی به پرونده‌های این گیرنده برای شما مجاز نیست؛ نامه بدون پیوست ارسال می‌شود.
              </Typography>
            ) : cases.kind === 'error' ? (
              <Typography role="alert" variant="12/regular" className="text-error-600">
                دریافت پرونده‌های گیرنده انجام نشد. صفحه را دوباره بارگذاری کنید.
              </Typography>
            ) : cases.items.length === 0 ? (
              <Typography role="status" variant="12/regular" className="text-neutral-500">
                این گیرنده پرونده‌ای ندارد؛ پیوست فایل فقط برای نامه‌های مرتبط با پرونده ممکن است.
              </Typography>
            ) : null}
            {selectedCaseId ? (
              <PrivateDocumentField
                key={selectedCaseId}
                category="correspondenceAttachment"
                label="فایل پیوست"
                requestId={selectedCaseId}
                disabled={saving}
                sessionOnly
                onPendingChange={setUploading}
                onDocumentsChange={setAttachments}
              />
            ) : null}
          </div>
        )}

        {error && (
          <Typography role="alert" variant="14/regular" className="text-error-600">
            {error}
          </Typography>
        )}
      </section>
    </form>
  )
}
