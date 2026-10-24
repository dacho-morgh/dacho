'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import { createRequest, submitRequest } from '@/utilities/dashboard-api'

export interface RequestFormOption { label: string; value: string }
export interface RequestFormField { name: string; label?: string; blockType: string; required?: boolean; options?: RequestFormOption[] }

export function NewRequestForm({
  serviceId,
  serviceKey,
  title,
  fields,
  initialAnswers = {},
}: {
  serviceId: string
  serviceKey?: string
  title: string
  fields: RequestFormField[]
  initialAnswers?: Record<string, string>
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadPending, setUploadPending] = useState(false)
  const [documentsReady, setDocumentsReady] = useState(false)
  const requireProposal = serviceKey === 'events'
  const update = (name: string, value: string) => setAnswers((current) => ({ ...current, [name]: value }))

  const createDraft = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const created = await createRequest({ serviceId, title, answers })
      setDraftId(created.request.id)
    } catch {
      setError('ایجاد پیش‌نویس انجام نشد. لطفاً دوباره تلاش کنید.')
    } finally {
      setSaving(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draftId || saving || uploadPending) return
    if (requireProposal && !documentsReady) {
      setError('پیش از ارسال، پروپوزال را بارگذاری کنید.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await submitRequest(draftId)
      router.push(`/dashboard/requests/${encodeURIComponent(draftId)}`)
    } catch {
      setError('ارسال درخواست انجام نشد. پیش‌نویس شما حفظ شده است؛ دوباره تلاش کنید.')
    } finally {
      setSaving(false)
    }
  }

  const locked = draftId !== null

  return (
    <form onSubmit={locked ? submit : createDraft} className="space-y-5" dir="rtl">
      {fields.map((field) => {
        const label = field.label || field.name
        if (field.blockType.includes('textarea') || field.blockType.includes('richText')) {
          return (
            <label key={field.name} className="block">
              <Typography variant="14/semibold" className="mb-2 block text-neutral-700">{label}</Typography>
              <Textarea
                required={field.required}
                disabled={locked}
                value={answers[field.name] ?? ''}
                onChange={(event) => update(field.name, event.target.value)}
              />
            </label>
          )
        }
        if (field.blockType.includes('select') && field.options?.length) {
          return (
            <label key={field.name} className="block">
              <Typography variant="14/semibold" className="mb-2 block text-neutral-700">{label}</Typography>
              <select
                required={field.required}
                disabled={locked}
                value={answers[field.name] ?? ''}
                onChange={(event) => update(field.name, event.target.value)}
                className="h-12 w-full rounded-lg border border-neutral-200 bg-white px-3"
              >
                <option value="">انتخاب کنید</option>
                {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          )
        }
        return (
          <Input
            key={field.name}
            required={field.required}
            disabled={locked}
            label={label}
            value={answers[field.name] ?? ''}
            onChange={(event) => update(field.name, event.target.value)}
          />
        )
      })}

      {locked ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
          <Typography variant="14/semibold" className="text-neutral-700">
            پیش‌نویس ایجاد شد. مدارک را بارگذاری کنید و سپس درخواست را ارسال کنید.
          </Typography>
          <PrivateDocumentField
            category="proposal"
            label="پروپوزال"
            requestId={draftId ?? undefined}
            required={requireProposal}
            canUpload
            canDelete
            onPendingChange={setUploadPending}
            onReadyChange={setDocumentsReady}
          />
        </div>
      ) : null}

      {error ? <Typography role="alert" variant="14/regular" className="text-error-600">{error}</Typography> : null}

      <Button
        type="submit"
        loading={saving}
        disabled={saving || uploadPending || (locked && requireProposal && !documentsReady)}
      >
        {locked ? 'ثبت و ارسال درخواست' : 'ایجاد پیش‌نویس و ادامه'}
      </Button>
    </form>
  )
}
