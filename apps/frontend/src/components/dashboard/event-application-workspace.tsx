'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ParticipationEligibilityPanel } from '@/components/dashboard/participation-eligibility-panel'
import { RequestFormFieldInput, type RequestFormField } from '@/components/dashboard/request-form-field'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DownloadRow } from '@/components/dashboard/download-row'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  createRequest,
  fetchCompanyVerification,
  getEventSubtopics,
  getRequest,
  getProposalTemplateDownloadUrl,
  getRfpDownloadUrl,
  getSubtopicRfp,
  listAgreements,
  submitRequest,
  updateRequest,
  type AgreementDefinition,
  type EventSubtopicDto,
  type RequestDto,
  type RfpFileDto,
  type RfpVersionDto,
} from '@/utilities/dashboard-api'
import {
  applicationTitle,
  describeWorkspaceLoadFailure,
  loadExistingApplications,
  missingFieldLabels,
  type ExistingApplication,
} from '@/utilities/event-application'
import {
  describeSubmissionFailure,
  participationDestination,
  profileSectionHref,
  type Eligibility,
  type ParticipationTarget,
  type SubmissionFailureKind,
} from '@/utilities/participation-eligibility'
import { toast } from 'sonner'

interface WorkspaceProps {
  serviceId: string
  serviceTitle: string
  fields: RequestFormField[]
  initialAnswers?: Record<string, string>
  eventId: string
  subtopicIds: readonly string[]
  returnTo?: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'denied' | 'error'; message: string }
  | {
      status: 'ready'
      subtopics: EventSubtopicDto[]
      agreements: AgreementDefinition[]
      existing: Map<string, ExistingApplication>
    }

/**
 * FE12: one independent application (draft, tracking code and result) per
 * selected event subtopic. The server owns uniqueness, RFP freshness, required
 * fields, consent versions and eligibility; this page saves and resumes input
 * and explains each refusal without losing what the representative typed.
 */
export function EventApplicationWorkspace({
  serviceId,
  serviceTitle,
  fields,
  initialAnswers = {},
  eventId,
  subtopicIds,
  returnTo,
}: WorkspaceProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [eligibility, setEligibility] = useState<Eligibility | null>(null)
  const [eligibilityRefresh, setEligibilityRefresh] = useState(0)
  const loadAttempt = useRef(0)
  const target = useMemo<ParticipationTarget>(() => ({ kind: 'event', eventId, subtopicIds }), [eventId, subtopicIds])
  const eventHref = participationDestination(target)
  const destination = returnTo ?? eventHref
  const subtopicKey = subtopicIds.join(',')

  const loadWorkspace = useCallback(async () => {
    const current = ++loadAttempt.current
    try {
      const [subtopicList, agreementList, existing] = await Promise.all([
        getEventSubtopics(eventId),
        listAgreements(),
        loadExistingApplications(eventId),
      ])
      if (current !== loadAttempt.current) return
      const known = new Map((subtopicList.items ?? []).map((subtopic) => [subtopic.id, subtopic]))
      const selected = [...new Set(subtopicKey.split(',').filter(Boolean))].flatMap((id) => {
        const subtopic = known.get(id)
        return subtopic ? [subtopic] : []
      })
      setLoad({ status: 'ready', subtopics: selected, agreements: agreementList.agreements ?? [], existing })
    } catch (cause) {
      if (current !== loadAttempt.current) return
      const failure = describeWorkspaceLoadFailure(cause)
      setLoad({ status: failure.kind, message: failure.message })
    }
  }, [eventId, subtopicKey])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  const eligible = eligibility?.canParticipate === true

  const verificationChanged = useCallback(() => setEligibilityRefresh((key) => key + 1), [])

  return (
    <div className="flex min-w-0 flex-col gap-5" dir="rtl">
      {/* Stays mounted to read the verification state, but only shows itself when something blocks the applicant. */}
      <div className={eligible ? 'hidden' : undefined}>
        <ParticipationEligibilityPanel
          target={target}
          returnTo={destination}
          refreshKey={eligibilityRefresh}
          onEligibilityChange={setEligibility}
        />
      </div>

      {load.status === 'loading' ? (
        <div role="status" className="rounded-2xl border border-neutral-200 bg-background p-4">
          <Typography variant="14/regular" color="neutral-500">در حال دریافت زیرعنوان‌ها و پیش‌نویس‌های شما…</Typography>
        </div>
      ) : null}

      {load.status === 'denied' ? (
        <Notice tone="error" testId="workspace-denied">
          <Typography role="alert" variant="14/semibold" className="text-error-600">{load.message}</Typography>
          <Link href="/dashboard/events" className="block">
            <Typography as="span" variant="14/semibold" color="brand-600">بازگشت به رویدادها</Typography>
          </Link>
        </Notice>
      ) : null}

      {load.status === 'error' ? (
        <Notice tone="error" testId="workspace-error">
          <Typography role="alert" variant="14/semibold" className="text-error-600">{load.message}</Typography>
          <Button type="button" variant="outline-primary" size="36" className="self-start" onClick={() => {
            setLoad({ status: 'loading' })
            void loadWorkspace()
          }}>
            تلاش دوباره
          </Button>
        </Notice>
      ) : null}

      {load.status === 'ready' && load.subtopics.length === 0 ? (
        <Notice tone="neutral" testId="workspace-empty">
          <Typography variant="14/semibold" color="neutral-700">
            زیرعنوان معتبری برای ثبت درخواست انتخاب نشده است. به صفحه رویداد برگردید و زیرعنوان مورد نظر را انتخاب کنید.
          </Typography>
          <Link href={eventHref} className="block">
            <Typography as="span" variant="14/semibold" color="brand-600">انتخاب زیرعنوان در صفحه رویداد</Typography>
          </Link>
        </Notice>
      ) : null}

      {load.status === 'ready' && load.subtopics.length > 0 ? (
        <>
          {load.subtopics.map((subtopic, index) => (
            <ApplicationCard
              key={subtopic.id}
              index={index}
              serviceId={serviceId}
              serviceTitle={serviceTitle}
              fields={fields}
              initialAnswers={initialAnswers}
              eventId={eventId}
              eventHref={eventHref}
              destination={destination}
              subtopic={subtopic}
              agreements={load.agreements}
              existing={load.existing.get(subtopic.id)}
              eligible={eligible}
              onVerificationChanged={verificationChanged}
            />
          ))}
        </>
      ) : null}
    </div>
  )
}

function Notice({ tone, testId, children }: { tone: 'error' | 'neutral' | 'warning'; testId?: string; children: ReactNode }) {
  const toneClass =
    tone === 'error'
      ? 'border-error-100 bg-error-50'
      : tone === 'warning'
        ? 'border-warning-50 bg-warning-50'
        : 'border-neutral-200 bg-neutral-50'
  return (
    <div data-testid={testId} className={`flex min-w-0 flex-col gap-3 rounded-2xl border p-4 ${toneClass}`}>
      {children}
    </div>
  )
}

const toPersianDigits = (value: number | string) => String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit)

interface ApplicationCardProps {
  index: number
  serviceId: string
  serviceTitle: string
  fields: RequestFormField[]
  initialAnswers: Record<string, string>
  eventId: string
  eventHref: string
  destination: string
  subtopic: EventSubtopicDto
  agreements: AgreementDefinition[]
  existing?: ExistingApplication
  eligible: boolean
  onVerificationChanged: () => void
}

function stringAnswers(fields: RequestFormField[], answers: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = answers[field.name]
      return typeof value === 'string' || typeof value === 'number' ? [[field.name, String(value)]] : []
    }),
  )
}

function ApplicationCard({
  index,
  serviceId,
  serviceTitle,
  fields,
  initialAnswers,
  eventId,
  eventHref,
  destination,
  subtopic,
  agreements,
  existing,
  eligible,
  onVerificationChanged,
}: ApplicationCardProps) {
  const [request, setRequest] = useState<RequestDto | null>(existing?.request ?? null)
  const [pinnedRfpVersionId, setPinnedRfpVersionId] = useState<string | null>(existing?.rfpVersionId ?? null)
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({
    ...initialAnswers,
    ...stringAnswers(fields, existing?.request.answers ?? {}),
  }))
  const [acceptNonCompete, setAcceptNonCompete] = useState(false)
  const [acceptRules, setAcceptRules] = useState(false)
  const [documentsReady, setDocumentsReady] = useState(false)
  const [uploadPending, setUploadPending] = useState(false)
  const [busy, setBusy] = useState<'save' | 'submit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [failureKind, setFailureKind] = useState<SubmissionFailureKind | null>(null)
  // Only the latest save/submit may change this card; older replies are stale.
  const attempt = useRef(0)

  const nonCompete = agreements.find((agreement) => agreement.type === 'non_compete')
  const eventRules = agreements.find((agreement) => agreement.type === 'event_rules')
  const isDraft = request === null || request.status === 'draft'
  const submitted = request !== null && request.status !== 'draft'
  const staleDraft =
    request?.status === 'draft' && pinnedRfpVersionId !== null && pinnedRfpVersionId !== subtopic.currentRfpVersionId
  const fieldLabels = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.name, field.label || field.name])),
    [fields],
  )
  const headingId = `application-${subtopic.id}`

  const buildAnswers = (): Record<string, unknown> => ({
    ...(request?.answers ?? {}),
    ...answers,
  })

  const begin = () => {
    const current = ++attempt.current
    setError(null)
    setNotice(null)
    setFailureKind(null)
    return current
  }

  const fail = (cause: unknown, fallback: string) => {
    if (cause instanceof DashboardApiError && cause.code === 'invalid_answers' && cause.missingFields.length > 0) {
      setFailureKind('other')
      setError(`موارد زیر هنوز کامل نشده است: ${missingFieldLabels(cause.missingFields, fieldLabels).join('، ')}. اطلاعات واردشده حفظ شده است.`)
      return
    }
    if (cause instanceof DashboardApiError && (cause.code === 'invalid_answers' || cause.code === 'invalid_title')) {
      setFailureKind('other')
      setError('برخی از پاسخ‌ها معتبر نیست. موارد فرم را بررسی کنید؛ اطلاعات واردشده حفظ شده است.')
      return
    }
    if (cause instanceof DashboardApiError && cause.code === 'invalid_event_subtopic') {
      setFailureKind('other')
      setError('این زیرعنوان دیگر به این رویداد تعلق ندارد. به صفحه رویداد برگردید و دوباره انتخاب کنید.')
      return
    }
    const failure = describeSubmissionFailure(cause, fallback)
    setFailureKind(failure.kind)
    setError(failure.message)
    if (failure.kind === 'not_verified') onVerificationChanged()
  }

  /** Shows the server's current state of a request that is no longer an editable draft. */
  const refreshSubmitted = async (id: string, current: number) => {
    try {
      const detail = await getRequest(id)
      if (current === attempt.current) setRequest(detail.request)
    } catch {
      // The conflict message already explains the state; the link still opens the request.
    }
  }

  /** Create-time duplicate: adopt the company's existing application for this subtopic instead of a second one. */
  const adoptExisting = async (current: number): Promise<boolean> => {
    const found = (await loadExistingApplications(eventId)).get(subtopic.id)
    if (current !== attempt.current || !found) return false
    setRequest(found.request)
    setPinnedRfpVersionId(found.rfpVersionId)
    if (found.request.status === 'draft') {
      const saved = await updateRequest(found.request.id, { answers: { ...found.request.answers, ...answers } })
      if (current !== attempt.current) return true
      setRequest(saved.request)
      setNotice('برای این زیرعنوان پیش‌تر پیش‌نویسی ساخته شده بود؛ همان پیش‌نویس بازیابی و اطلاعات شما در آن ذخیره شد.')
    } else {
      setNotice('برای این زیرعنوان پیش‌تر درخواستی ارسال شده است؛ وضعیت آن در ادامه نمایش داده می‌شود.')
    }
    return true
  }

  /** Creates the draft once; later saves update the same draft so a retry never creates another application. */
  const persistDraft = async (current: number): Promise<RequestDto | null> => {
    if (request) {
      const saved = await updateRequest(request.id, { answers: buildAnswers() })
      if (current !== attempt.current) return null
      setRequest(saved.request)
      return saved.request
    }
    if (!subtopic.currentRfpVersionId) {
      setError('RFP این زیرعنوان هنوز منتشر نشده است؛ پس از انتشار آن می‌توانید پیش‌نویس بسازید.')
      return null
    }
    const created = await createRequest({
      serviceId,
      title: applicationTitle(serviceTitle, subtopic.title),
      answers: buildAnswers(),
      eventId,
      subtopicId: subtopic.id,
      rfpVersionId: subtopic.currentRfpVersionId,
    })
    if (current !== attempt.current) return null
    setRequest(created.request)
    setPinnedRfpVersionId(subtopic.currentRfpVersionId)
    return created.request
  }

  const handleConflict = async (cause: unknown, current: number): Promise<boolean> => {
    if (!(cause instanceof DashboardApiError)) return false
    if (cause.code === 'duplicate_subtopic_request') {
      try {
        if (await adoptExisting(current)) return true
      } catch {
        // Fall through to the duplicate explanation.
      }
      return false
    }
    if ((cause.code === 'already_submitted' || cause.code === 'request_not_draft') && request) {
      if (current !== attempt.current) return true
      setFailureKind('already_submitted')
      setError('این درخواست پیش‌تر ارسال شده است و دیگر قابل ویرایش نیست. وضعیت آن را از صفحه پیگیری درخواست ببینید.')
      await refreshSubmitted(request.id, current)
      return true
    }
    return false
  }

  /** The page has no «save» button: the draft is created as soon as the applicant may apply, so the upload can attach to it. */
  const ensureDraft = async () => {
    const current = begin()
    setBusy('save')
    try {
      await persistDraft(current)
    } catch (cause) {
      if (current !== attempt.current) return
      if (await handleConflict(cause, current)) return
      fail(cause, 'ساخت پیش‌نویس انجام نشد. دوباره تلاش کنید.')
    } finally {
      if (current === attempt.current) setBusy(null)
    }
  }
  const draftRequested = useRef<string | null>(null)
  const [completeOpen, setCompleteOpen] = useState(false)
  useEffect(() => {
    if (!eligible || request || !subtopic.currentRfpVersionId || draftRequested.current === subtopic.id) return
    draftRequested.current = subtopic.id
    void ensureDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, request, subtopic.id, subtopic.currentRfpVersionId])

  const submit = async () => {
    if (busy || !eligible || !isDraft) return
    const missing: string[] = []
    if (!request || !documentsReady) missing.push('proposalDocuments')
    if (!acceptNonCompete) missing.push('nonCompeteAcceptance')
    if (!acceptRules) missing.push('eventRulesAcceptance')
    if (missing.length > 0 || uploadPending) {
      begin()
      setError(
        uploadPending
          ? 'تا پایان بارگذاری فایل صبر کنید.'
          : `پیش از ارسال این موارد را کامل کنید: ${missingFieldLabels(missing, fieldLabels).join('، ')}.`,
      )
      return
    }
    if (!nonCompete || !eventRules) {
      begin()
      setError('نسخه توافق‌نامه‌ها از سرور دریافت نشد. صفحه را تازه کنید و دوباره تلاش کنید.')
      return
    }
    const current = begin()
    setBusy('submit')
    const fallback = 'ارسال پروپوزال انجام نشد. پیش‌نویس و اطلاعات شما حفظ شده است؛ دوباره تلاش کنید.'
    try {
      // Verification can be withdrawn while the form is open; ask the server again first.
      const verification = await fetchCompanyVerification()
      if (current !== attempt.current) return
      if (verification.status !== 'approved') {
        setFailureKind('not_verified')
        toast.error('ارسال پروپوزال انجام نشد.')
        setError('وضعیت احراز هویت شرکت شما پس از باز شدن این فرم تغییر کرده و دیگر تأییدشده نیست. پروپوزال ارسال نشد؛ پیش‌نویس حفظ شده است.')
        onVerificationChanged()
        return
      }
      const draft = await persistDraft(current)
      if (!draft || current !== attempt.current) return
      const result = await submitRequest(draft.id, {
        nonCompeteAcceptance: { accepted: true, textVersionId: nonCompete.version },
        eventRulesAcceptance: { accepted: true, textVersionId: eventRules.version },
      })
      if (current !== attempt.current) return
      setRequest(result.request)
      toast.success('پروپوزال ارسال شد.')
    } catch (cause) {
      if (current !== attempt.current) return
      if (await handleConflict(cause, current)) return
      toast.error('ارسال پروپوزال انجام نشد.')
      fail(cause, fallback)
    } finally {
      if (current === attempt.current) setBusy(null)
    }
  }

  const locked = !isDraft || busy !== null
  // The RFP files of the chosen subtitle: they change together with it.
  const rfpKey = `${subtopic.id}:${subtopic.currentRfpVersionId ?? ''}`
  const [loadedRfp, setLoadedRfp] = useState<{ key: string; version: RfpVersionDto | null; failed: boolean } | null>(null)
  useEffect(() => {
    if (!subtopic.currentRfpVersionId) return
    let active = true
    getSubtopicRfp(eventId, subtopic.id)
      .then((result) => {
        if (active) setLoadedRfp({ key: rfpKey, version: result.version, failed: false })
      })
      .catch(() => {
        if (active) setLoadedRfp({ key: rfpKey, version: null, failed: true })
      })
    return () => {
      active = false
    }
  }, [eventId, subtopic.id, subtopic.currentRfpVersionId, rfpKey])
  const currentRfp = loadedRfp?.key === rfpKey ? loadedRfp : null
  const rfpVersion = subtopic.currentRfpVersionId ? (currentRfp?.version ?? null) : null
  const rfpState: 'loading' | 'ready' | 'error' = !subtopic.currentRfpVersionId
    ? 'ready'
    : currentRfp
      ? currentRfp.failed
        ? 'error'
        : 'ready'
      : 'loading'
  const rfpFiles: RfpFileDto[] = rfpVersion?.files ?? []

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`application-${subtopic.id}`}
      className="flex min-w-0 flex-col gap-5"
    >
      {/* Header (Figma 31983:86041): the breadcrumb at the start, the actions at the end */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {index === 0 ? (
          <nav aria-label="مسیر راهنما" className="flex min-w-0 items-center gap-2">
            <Link href="/dashboard/events">
              <Typography as="span" variant="16/regular" color="neutral-500">لیست رویدادها</Typography>
            </Link>
            <Typography as="span" variant="16/regular" color="neutral-500">/</Typography>
            <Typography as="h1" variant="24/bold" color="neutral-700">ثبت نام در رویداد</Typography>
          </nav>
        ) : (
          <span />
        )}
        {isDraft ? (
          <Button
            type="button"
            variant="primary"
            size="40"
            disabled={busy !== null || !eligible || uploadPending || staleDraft}
            onClick={() => setCompleteOpen(true)}
          >
            ثبت درخواست
          </Button>
        ) : null}
      </div>

      {submitted ? (
        <Notice tone="neutral" testId="application-result">
          <Typography variant="14/semibold" color="neutral-700">
            پروپوزال این زیرعنوان ارسال شد و با کد پیگیری <span dir="ltr">{request.trackingCode}</span> بررسی می‌شود.
          </Typography>
          <Link href={`/dashboard/requests/${encodeURIComponent(request.id)}`} className="block">
            <Typography as="span" variant="14/semibold" color="brand-600">مشاهده و پیگیری درخواست</Typography>
          </Link>
        </Notice>
      ) : null}

      {staleDraft ? (
        <Notice tone="warning" testId="stale-draft">
          <Typography variant="14/semibold" color="neutral-700">
            این پیش‌نویس بر اساس نسخه قبلی RFP ساخته شده است و با نسخه فعلی قابل ارسال نیست.
          </Typography>
          <Link href={eventHref} className="block">
            <Typography as="span" variant="14/semibold" color="brand-600">مطالعه نسخه جدید RFP در صفحه رویداد</Typography>
          </Link>
        </Notice>
      ) : null}

      {notice ? <Typography role="status" variant="14/regular" color="neutral-600">{notice}</Typography> : null}
      {error ? <Typography role="alert" variant="14/regular" className="text-error-600">{error}</Typography> : null}
      {failureKind === 'not_verified' ? (
        <Link href={profileSectionHref('company-verification', destination)} className="block">
          <Typography as="span" variant="14/semibold" color="brand-600">بررسی وضعیت احراز هویت در پروفایل شرکت</Typography>
        </Link>
      ) : null}
      {failureKind === 'stale_rfp' ? (
        <Link href={eventHref} className="block">
          <Typography as="span" variant="14/semibold" color="brand-600">بازگشت به رویداد و مطالعه نسخه جدید RFP</Typography>
        </Link>
      ) : null}
      {(failureKind === 'already_submitted' || failureKind === 'duplicate') && request ? (
        <Link href={`/dashboard/requests/${encodeURIComponent(request.id)}`} className="block">
          <Typography as="span" variant="14/semibold" color="brand-600">مشاهده وضعیت درخواست</Typography>
        </Link>
      ) : null}
      {failureKind === 'duplicate' && !request ? (
        <Link href="/dashboard/requests" className="block">
          <Typography as="span" variant="14/semibold" color="brand-600">مشاهده فهرست درخواست‌ها</Typography>
        </Link>
      ) : null}

      {/* Card 1 (Figma 31983:86020): the title, the subtitle and their RFP files */}
      <div className="flex min-w-0 flex-col gap-8 rounded-[16px] border border-neutral-200 bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <Typography as="h2" id={headingId} variant="20/bold" color="neutral-600">
              عنوان و فایل‌های درخواست پروپوزال
            </Typography>
            <Typography as="p" variant="14/regular" color="neutral-500">
              عنوان و زیر عنوان در صفحه رویداد انتخاب شده‌اند. فایل RFP و نمونه فرم پروپوزال را دانلود کنید.
            </Typography>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-5 gap-y-8 md:grid-cols-2">
          {/* The title and the subtitle come from the subtitle chosen on the event page; they are not editable here. */}
          <ApplicationField label="عنوان" htmlFor={`${headingId}-category`}>
            <Input
              id={`${headingId}-category`}
              aria-label="عنوان"
              value={subtopic.categoryTitle ?? ''}
              disabled
              readOnly
            />
          </ApplicationField>
          <ApplicationField label="زیر عنوان" htmlFor={`${headingId}-subtopic`}>
            <Input id={`${headingId}-subtopic`} aria-label="زیر عنوان" value={subtopic.title} disabled readOnly />
          </ApplicationField>

          {rfpFiles.map((file, position) => (
            <DownloadRow
              key={file.id}
              label={rfpFiles.length > 1 ? `فایل RFP ${rfpOrdinal(position)}` : 'فایل RFP'}
              href={getRfpDownloadUrl(eventId, subtopic.id, rfpVersion!.id, file.id)}
              filename={file.filename}
            />
          ))}
          {rfpFiles.length === 0 && rfpState !== 'loading' ? (
            <div className="flex min-w-0 items-center justify-between gap-3">
              <Typography as="span" variant="16/semibold" color="neutral-700">فایل RFP</Typography>
              <Typography variant="14/regular" color="neutral-500">
                {rfpState === 'error' ? 'دریافت فایل RFP انجام نشد.' : 'بارگذاری نشده است.'}
              </Typography>
            </div>
          ) : null}
          {/* The sample proposal form: the bundled default, or the owner's replacement for this event. */}
          <DownloadRow label="نمونه فرم پروپوزال" href={getProposalTemplateDownloadUrl(eventId)} />
        </div>
      </div>

      {isDraft ? (
        <>
          {/* Card 2 (Figma 31983:86030): the proposal file and the notes */}
          <div className="flex min-w-0 flex-col gap-4 rounded-[16px] border border-neutral-200 bg-background p-4">
            <div className="flex flex-col gap-1">
              <Typography as="h2" variant="20/bold" color="neutral-600">بارگذاری پروپوزال</Typography>
              <Typography as="p" variant="14/regular" color="neutral-500">
                پروپوزال خود را متناسب با عنوان های انتخاب شده و RFP های ارائه شده در یک فایل نوشته و در یکی از فرمت‌های گفته شده بارگذاری کنید
              </Typography>
            </div>
            {request ? (
              <PrivateDocumentField
                category="proposal"
                variant="dropzone"
                label="پروپوزال"
                requestId={request.id}
                required
                canUpload={!locked}
                canDelete={!locked}
                onPendingChange={setUploadPending}
                onReadyChange={setDocumentsReady}
              />
            ) : (
              <Typography variant="14/regular" color="neutral-500">
                ابتدا پیش‌نویس را ذخیره کنید؛ سپس پروپوزال این زیرعنوان را بارگذاری کنید.
              </Typography>
            )}
            <ApplicationField label="توضیحات" htmlFor={`${headingId}-notes`}>
              <Textarea
                id={`${headingId}-notes`}
                name="proposalNotes"
                placeholder="توضیحات خود را در اینجا وارد کنید"
                disabled={locked}
                className="min-h-[140px]"
                value={answers.proposalNotes ?? ''}
                onChange={(event) => setAnswers((current) => ({ ...current, proposalNotes: event.target.value }))}
              />
            </ApplicationField>
          </div>

          {/* What the server still requires beyond the page: form fields and agreements, asked on submit */}
          <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
            <DialogContent className="max-w-2xl">
              <div className="flex flex-col gap-1">
                <DialogTitle>تکمیل اطلاعات ثبت‌نام</DialogTitle>
                <DialogDescription>
                  پیش از ثبت درخواست، اطلاعات زیر و تعهدنامه‌ها را تکمیل کنید.
                </DialogDescription>
              </div>
              <div className="flex min-w-0 flex-col gap-5">
            {fields.length > 0 ? (
              <fieldset className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                <legend className="mb-3">
                  <Typography as="span" variant="14/semibold" color="neutral-800">اطلاعات ثبت‌نام</Typography>
                </legend>
                {fields.map((field) => (
                  <RequestFormFieldInput
                    key={field.name}
                    field={field}
                    disabled={locked}
                    value={answers[field.name] ?? ''}
                    onChange={(value) => setAnswers((current) => ({ ...current, [field.name]: value }))}
                  />
                ))}
              </fieldset>
            ) : null}

            <fieldset className="flex min-w-0 flex-col gap-3">
              <legend className="mb-1">
                <Typography as="span" variant="14/semibold" color="neutral-800">تعهدنامه‌ها</Typography>
              </legend>
              {[nonCompete, eventRules].some((agreement) => agreement && !agreement.approved) ? (
                <Typography variant="12/regular" color="neutral-500" data-testid="agreement-unapproved">
                  متن نهایی تعهدنامه‌ها هنوز منتشر نشده است. پذیرش فعلی با نسخه موقت ثبت می‌شود و پس از انتشار متن نهایی دوباره از شما خواسته خواهد شد.
                </Typography>
              ) : null}
              <AgreementCheckbox
                id={`${headingId}-non-compete`}
                label={`${nonCompete?.title ?? 'قرارداد عدم رقابت'} را مطالعه کرده‌ام و می‌پذیرم.`}
                checked={acceptNonCompete}
                disabled={locked || !nonCompete}
                onChange={setAcceptNonCompete}
              />
              <AgreementCheckbox
                id={`${headingId}-rules`}
                label={`${eventRules?.title ?? 'قوانین رویداد'} را مطالعه کرده‌ام و می‌پذیرم.`}
                checked={acceptRules}
                disabled={locked || !eventRules}
                onChange={setAcceptRules}
              />
            </fieldset>
              </div>
              {error ? <Typography role="alert" variant="14/regular" className="text-error-600">{error}</Typography> : null}
              <DialogFooter className="border-t-0 pt-0">
                <Button
                  type="button"
                  variant="primary"
                  size="40"
                  loading={busy === 'submit'}
                  disabled={busy !== null || !eligible || uploadPending || staleDraft}
                  onClick={() => void submit()}
                >
                  تایید و ثبت
                </Button>
                <Button type="button" variant="outline-primary" size="40" onClick={() => setCompleteOpen(false)}>
                  لغو
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </section>
  )
}

const RFP_ORDINALS = ['یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه', 'ده']
const rfpOrdinal = (position: number) => RFP_ORDINALS[position] ?? toPersianDigits(position + 1)

/** A label above a control, as the Figma text field draws it: 16/SemiBold neutral-700, 8px gap. */
function ApplicationField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={htmlFor}>
        <Typography as="span" variant="16/semibold" color="neutral-700">{label}</Typography>
      </label>
      {children}
    </div>
  )
}

function AgreementCheckbox({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
        className="mt-1"
      />
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <Typography as="span" variant="14/regular" color="neutral-700" className="break-words">{label}</Typography>
      </label>
    </div>
  )
}
