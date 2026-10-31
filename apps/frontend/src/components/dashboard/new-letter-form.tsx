'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography, typographyVariants } from '@/components/ui/typography'
import { LETTER_TYPE_LABELS, type LetterType } from '@/utilities/dashboard-api'
import {
  documentErrorMessage,
  formatDocumentSize,
  uploadDocument,
  validateSelectedFile,
} from '@/utilities/document-api'
import { cn } from '@/utilities/ui'

export interface LetterRecipient {
  id: string
  companyName?: string
  name?: string
}

const fieldClassName = cn(
  typographyVariants({ variant: '16/regular', color: 'neutral-600' }),
  'h-10 w-full appearance-none rounded-lg border border-neutral-100 bg-white p-2 text-right outline-none focus:border-brand-500 disabled:bg-neutral-50',
)

const SUPPORT_PRIORITY_LABELS: Record<string, string> = {
  normal: 'عادی',
  important: 'مهم',
  urgent: 'فوری',
}

export interface NewLetterFormProps {
  mode?: 'admin' | 'support' | 'letter'
  companies?: LetterRecipient[]
  recipientsError?: boolean
  requestId?: string
  caseTitle?: string
  initialRecipientId?: string
  initialTitle?: string
  initialType?: LetterType
  initialBody?: string
}

export function NewLetterForm({
  mode = 'admin',
  companies = [],
  recipientsError = false,
  requestId,
  caseTitle,
  initialRecipientId,
  initialTitle,
  initialType,
  initialBody,
}: NewLetterFormProps) {
  const router = useRouter()
  const submitting = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; size: string }>>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const isSupport = mode === 'support'

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !requestId) return
    const localErr = validateSelectedFile(file)
    if (localErr) {
      setUploadError(documentErrorMessage(localErr))
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const doc = await uploadDocument({
        file,
        category: 'correspondenceAttachment',
        requestId,
      })
      setAttachments((prev) => [
        ...prev,
        { id: doc.id, name: doc.filename, size: formatDocumentSize(doc.sizeBytes) },
      ])
      event.target.value = ''
    } catch {
      setUploadError('بارگذاری پیوست انجام نشد. دوباره تلاش کنید.')
    } finally {
      setUploading(false)
    }
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
        const result = await response.json()
        if (!response.ok || !result?.ticket?.id) throw new Error('ticket_not_created')
        router.push('/dashboard/letters')
        router.refresh()
      } catch {
        setError('ارسال پیام پشتیبانی انجام نشد. لطفاً دوباره تلاش کنید.')
      } finally {
        submitting.current = false
        setSaving(false)
      }
      return
    }

    const recipientId = String(data.get('recipientId') ?? '')
    const type = String(data.get('type') ?? '') as LetterType
    if (!companies.some((company) => company.id === recipientId) || !title || !body || !Object.hasOwn(LETTER_TYPE_LABELS, type)) {
      setError('گیرنده، عنوان، نوع و متن نامه را تکمیل کنید.')
      return
    }
    submitting.current = true
    setSaving(true)
    setError(null)
    try {
      const endpoint = requestId || mode !== 'admin'
        ? '/api/dashboard/letters'
        : '/api/dashboard/admin/letters'

      const payloadData: Record<string, unknown> = {
        recipientId,
        title,
        type,
        body,
      }
      if (requestId) payloadData.requestId = requestId
      if (attachments.length > 0) payloadData.attachmentIds = attachments.map((a) => a.id)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payloadData),
      })
      const result = await response.json()
      if (!response.ok || !result?.letter?.id) {
        if (response.status === 403) throw new Error('forbidden')
        throw new Error('letter_not_created')
      }
      router.push('/dashboard/letters')
      router.refresh()
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'forbidden') {
        setError('شما دسترسی لازم برای ارسال این نامه به گیرنده انتخابی را ندارید.')
      } else {
        setError('ارسال نامه انجام نشد. لطفاً دوباره تلاش کنید.')
      }
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
            variant="outline"
            size="40"
            className="px-4"
            disabled={saving}
            onClick={() => router.push('/dashboard/letters')}
          >
            <Typography as="span" variant="16/semibold" className="text-inherit">لغو</Typography>
          </Button>
          <Button
            type="submit"
            size="40"
            disabled={saving || (!isSupport && !companies.length)}
            className="bg-brand-500 px-4 hover:bg-brand-600"
          >
            <Typography as="span" variant="16/semibold" className="text-inherit">
              {saving ? 'در حال ارسال...' : isSupport ? 'ارسال پیام' : 'ارسال نامه'}
            </Typography>
          </Button>
        </div>
      </header>

      <section aria-label={isSupport ? 'اطلاعات پیام' : 'اطلاعات نامه'} className="flex flex-1 flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-4 lg:min-h-[calc(100svh-112px)]">
        {requestId && (
          <div className="flex items-center justify-between rounded-xl border border-brand-100 bg-brand-50/50 p-3 text-sm text-brand-700">
            <div className="flex items-center gap-2">
              <span className="font-semibold">پرونده مرتبط:</span>
              <span>{caseTitle || requestId}</span>
            </div>
          </div>
        )}

        {/* Recipient field */}
        <div className="flex flex-col gap-2">
          <Typography as="label" htmlFor="letter-recipient" variant="16/semibold" className="text-neutral-700">
            گیرنده
          </Typography>
          {isSupport ? (
            <input
              id="letter-recipient"
              name="recipientName"
              disabled
              value="پشتیبانی کارخانه نوآوری صنایع انرژی بوشهر"
              className={fieldClassName}
            />
          ) : (
            <>
              <select
                id="letter-recipient"
                name="recipientId"
                required
                defaultValue={initialRecipientId || ''}
                disabled={saving || !companies.length}
                className={fieldClassName}
              >
                <option value="" disabled>انتخاب گیرنده</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.companyName || company.name || company.id}
                  </option>
                ))}
              </select>
              {!companies.length && (
                <Typography
                  role={recipientsError ? 'alert' : 'status'}
                  variant="12/regular"
                  className="text-neutral-500"
                >
                  {recipientsError ? 'دریافت گیرندگان انجام نشد. صفحه را دوباره بارگذاری کنید.' : 'گیرنده‌ای برای ارسال نامه وجود ندارد.'}
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
              defaultValue={initialTitle || ''}
              placeholder={isSupport ? 'موضوع پیام خود را وارد کنید' : 'متن پلیس هولدر'}
              className="placeholder:font-[150]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Typography as="label" htmlFor="letter-type" variant="16/semibold" className="text-neutral-700">
              {isSupport ? 'میزان اهمیت' : 'نوع نامه'}
            </Typography>
            {isSupport ? (
              <select
                id="letter-type"
                name="priority"
                required
                defaultValue="normal"
                disabled={saving}
                className={fieldClassName}
              >
                {Object.entries(SUPPORT_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            ) : (
              <select
                id="letter-type"
                name="type"
                required
                defaultValue={initialType || ''}
                disabled={saving}
                className={fieldClassName}
              >
                <option value="" disabled>انتخاب نوع نامه</option>
                {Object.entries(LETTER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
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
            defaultValue={initialBody || ''}
            placeholder={isSupport ? 'متن پیام یا درخواست پشتیبانی خود را بنویسید...' : 'متن پلیس هولدر'}
            className={cn(
              typographyVariants({ variant: '16/regular', color: 'neutral-600' }),
              'h-[380px] min-h-[380px] resize-y rounded-lg border-neutral-100 bg-white p-2 shadow-none placeholder:font-[150] placeholder:text-neutral-400 md:text-base',
            )}
          />
        </div>

        {/* Attachments */}
        <div className="flex flex-col gap-2">
          <Input
            id="letter-attachment"
            label="فایل پیوست"
            type="file"
            disabled={saving || uploading || !requestId}
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hint={
              requestId
                ? uploading
                  ? 'در حال بارگذاری پیوست...'
                  : 'فقط PDF یا Word (doc / docx) - حداکثر ۱۰ مگابایت'
                : 'ارسال فایل پیوست هنوز در سامانه پشتیبانی نمی‌شود.'
            }
            onChange={requestId ? handleAttachmentChange : undefined}
          />
          {uploadError && (
            <Typography role="alert" variant="12/regular" className="text-error-600">
              {uploadError}
            </Typography>
          )}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm text-neutral-700"
                >
                  <span>{att.name}</span>
                  <span className="text-neutral-400">({att.size})</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                    className="text-neutral-400 hover:text-error-600"
                    aria-label={`حذف پیوست ${att.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <Typography role="alert" variant="14/regular" className="text-error-600">
            {error}
          </Typography>
        )}
      </section>
    </form>
  )
}
