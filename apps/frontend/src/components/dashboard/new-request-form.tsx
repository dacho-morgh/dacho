'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ParticipationEligibilityPanel } from '@/components/dashboard/participation-eligibility-panel'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  createRequest,
  describeMutationFailure,
  fetchCompanyVerification,
  submitRequest,
} from '@/utilities/dashboard-api'
import {
  describeSubmissionFailure,
  participationDestination,
  profileSectionHref,
  type Eligibility,
  type ParticipationTarget,
  type SubmissionFailureKind,
} from '@/utilities/participation-eligibility'

export interface RequestFormOption { label: string; value: string }
export interface RequestFormField { name: string; label?: string; blockType: string; required?: boolean; options?: RequestFormOption[] }

export function NewRequestForm({
  serviceId,
  serviceKey,
  title,
  fields,
  initialAnswers = {},
  participation,
  returnTo,
}: {
  serviceId: string
  serviceKey?: string
  title: string
  fields: RequestFormField[]
  initialAnswers?: Record<string, string>
  /** Event or exhibition entry: company verification gates create and is re-checked at submit. */
  participation?: ParticipationTarget
  /** This page, so profile pages can send the representative back here. */
  returnTo?: string
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadPending, setUploadPending] = useState(false)
  const [documentsReady, setDocumentsReady] = useState(false)
  const requireProposal = serviceKey === 'events'
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [eligibilityRefresh, setEligibilityRefresh] = useState(0)
  const [failureKind, setFailureKind] = useState<SubmissionFailureKind | null>(null)
  // Only the latest create/submit attempt may change the form; older replies are stale.
  const attempt = useRef(0)
  const gated = participation !== undefined
  const eligible = !gated || eligibility?.canParticipate === true
  const destination = returnTo ?? (participation ? participationDestination(participation) : undefined)
  const update = (name: string, value: string) => setAnswers((current) => ({ ...current, [name]: value }))

  const fail = (cause: unknown, fallback: string) => {
    const failure = describeSubmissionFailure(cause, fallback)
    setFailureKind(failure.kind)
    setError(failure.message)
    if (failure.kind === 'not_verified') setEligibilityRefresh((key) => key + 1)
  }

  const createDraft = async (event: FormEvent) => {
    event.preventDefault()
    if (saving || !eligible) return
    const current = ++attempt.current
    setSaving(true)
    setError(null)
    setFailureKind(null)
    try {
      const created = await createRequest({ serviceId, title, answers })
      if (current !== attempt.current) return
      setDraftId(created.request.id)
    } catch (cause) {
      if (current !== attempt.current) return
      if (gated) fail(cause, 'ایجاد پیش‌نویس انجام نشد. لطفاً دوباره تلاش کنید.')
      else setError(describeMutationFailure(cause, 'ایجاد پیش‌نویس انجام نشد. لطفاً دوباره تلاش کنید.'))
    } finally {
      if (current === attempt.current) setSaving(false)
    }
  }

  /** Verification can be withdrawn while the form is open; ask the server again before submitting. */
  const recheckEligibility = async (current: number): Promise<boolean> => {
    if (!gated) return true
    const verification = await fetchCompanyVerification()
    if (current !== attempt.current) return false
    if (verification.status === 'approved') return true
    setFailureKind('not_verified')
    setError('وضعیت احراز هویت شرکت شما پس از باز شدن این فرم تغییر کرده و دیگر تأییدشده نیست. درخواست ارسال نشد؛ پیش‌نویس حفظ شده است.')
    setEligibilityRefresh((key) => key + 1)
    return false
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draftId || saving || uploadPending) return
    if (requireProposal && !documentsReady) {
      setError('پیش از ارسال، پروپوزال را بارگذاری کنید.')
      return
    }
    const current = ++attempt.current
    setSaving(true)
    setError(null)
    setFailureKind(null)
    const fallback = 'ارسال درخواست انجام نشد. پیش‌نویس شما حفظ شده است؛ دوباره تلاش کنید.'
    try {
      if (!(await recheckEligibility(current))) return
      await submitRequest(draftId)
      if (current !== attempt.current) return
      router.push(`/dashboard/requests/${encodeURIComponent(draftId)}`)
    } catch (cause) {
      if (current !== attempt.current) return
      if (gated) fail(cause, fallback)
      else setError(describeMutationFailure(cause, fallback))
    } finally {
      if (current === attempt.current) setSaving(false)
    }
  }

  const locked = draftId !== null

  return (
    <form onSubmit={locked ? submit : createDraft} className="space-y-5" dir="rtl">
      {participation ? (
        <ParticipationEligibilityPanel
          target={participation}
          returnTo={destination}
          refreshKey={eligibilityRefresh}
          onEligibilityChange={setEligibility}
        />
      ) : null}
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
      {failureKind === 'not_verified' && destination ? (
        <Link href={profileSectionHref('company-verification', destination)} className="block">
          <Typography as="span" variant="14/semibold" color="brand-600">بررسی وضعیت احراز هویت در پروفایل شرکت</Typography>
        </Link>
      ) : null}
      {failureKind === 'stale_rfp' && participation?.kind === 'event' ? (
        <Link href={participationDestination(participation)} className="block">
          <Typography as="span" variant="14/semibold" color="brand-600">بازگشت به رویداد و مطالعه نسخه جدید RFP</Typography>
        </Link>
      ) : null}
      {failureKind === 'already_submitted' && draftId ? (
        <Link href={`/dashboard/requests/${encodeURIComponent(draftId)}`} className="block">
          <Typography as="span" variant="14/semibold" color="brand-600">مشاهده وضعیت درخواست</Typography>
        </Link>
      ) : null}

      <Button
        type="submit"
        loading={saving}
        disabled={saving || uploadPending || !eligible || (locked && requireProposal && !documentsReady)}
      >
        {locked ? 'ثبت و ارسال درخواست' : 'ایجاد پیش‌نویس و ادامه'}
      </Button>
    </form>
  )
}
