'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ParticipationEligibilityPanel } from '@/components/dashboard/participation-eligibility-panel'
import { RequestFormFieldInput, type RequestFormField } from '@/components/dashboard/request-form-field'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  REQUEST_STATUS_LABELS,
  createRequest,
  fetchCompanyVerification,
  getEventSubtopics,
  getRequest,
  listAgreements,
  submitRequest,
  updateRequest,
  type AgreementDefinition,
  type EventSubtopicDto,
  type RequestDto,
} from '@/utilities/dashboard-api'
import {
  applicationTitle,
  describeWorkspaceLoadFailure,
  emptyTeamMember,
  isTeamComplete,
  loadExistingApplications,
  missingFieldLabels,
  teamForAnswers,
  teamFromAnswers,
  type ExistingApplication,
  type TeamMember,
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
      <ParticipationEligibilityPanel
        target={target}
        returnTo={destination}
        refreshKey={eligibilityRefresh}
        onEligibilityChange={setEligibility}
      />

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
          <Typography variant="14/regular" color="neutral-600">
            برای هر زیرعنوان یک درخواست مستقل با پیش‌نویس، کد پیگیری و نتیجه جداگانه ثبت می‌شود.
          </Typography>
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
  const [team, setTeam] = useState<TeamMember[]>(() => teamFromAnswers(existing?.request.answers?.applicationTeam))
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
    applicationTeam: teamForAnswers(team),
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
      const saved = await updateRequest(found.request.id, { answers: { ...found.request.answers, ...answers, applicationTeam: teamForAnswers(team) } })
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

  const save = async () => {
    if (busy || !eligible || !isDraft) return
    const current = begin()
    setBusy('save')
    try {
      const saved = await persistDraft(current)
      if (saved && current === attempt.current) toast.success('پیش‌نویس ذخیره شد. می‌توانید بعداً از همین صفحه ادامه دهید.')
    } catch (cause) {
      if (current !== attempt.current) return
      if (await handleConflict(cause, current)) return
      toast.error('ذخیره پیش‌نویس انجام نشد.')
      fail(cause, 'ذخیره پیش‌نویس انجام نشد. اطلاعات واردشده حفظ شده است؛ دوباره تلاش کنید.')
    } finally {
      if (current === attempt.current) setBusy(null)
    }
  }

  const submit = async () => {
    if (busy || !eligible || !isDraft) return
    const missing: string[] = []
    if (!isTeamComplete(team)) missing.push('applicationTeam')
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

  const updateMember = (position: number, key: keyof TeamMember, value: string) =>
    setTeam((rows) => rows.map((row, i) => (i === position ? { ...row, [key]: value } : row)))

  const locked = !isDraft || busy !== null
  const statusBadge = submitted ? (
    <Badge variant="success" size="md">{REQUEST_STATUS_LABELS[request.status] ?? request.status}</Badge>
  ) : request ? (
    <Badge variant="primary" size="md">پیش‌نویس ذخیره‌شده</Badge>
  ) : (
    <Badge variant="gray" size="md">بدون پیش‌نویس</Badge>
  )

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`application-${subtopic.id}`}
      className="flex min-w-0 flex-col gap-5 rounded-2xl border border-neutral-200 bg-background p-4 sm:p-6"
    >
      <header className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Typography as="h2" id={headingId} variant="16/bold" color="neutral-800" className="break-words">
            درخواست {toPersianDigits(index + 1)}: {subtopic.title}
          </Typography>
          {subtopic.categoryTitle ? (
            <Typography variant="12/regular" color="neutral-500" className="break-words">عنوان: {subtopic.categoryTitle}</Typography>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge}
          {request ? (
            <Typography as="span" variant="12/semibold" color="neutral-600" data-testid="tracking-code">
              کد پیگیری: <span dir="ltr">{request.trackingCode}</span>
            </Typography>
          ) : null}
        </div>
      </header>

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

      {isDraft ? (
        <>
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
              <Typography as="span" variant="14/semibold" color="neutral-800">اعضای کلیدی تیم این پروپوزال</Typography>
            </legend>
            <Typography variant="12/regular" color="neutral-500">
              دست‌کم یک عضو با نام و نقش وارد کنید. نسبت با شرکت اختیاری است.
            </Typography>
            {team.map((member, position) => (
              <div key={position} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-neutral-100 p-3 md:grid-cols-3">
                <Input
                  label={`نام عضو ${toPersianDigits(position + 1)}`}
                  value={member.name}
                  disabled={locked}
                  onChange={(event) => updateMember(position, 'name', event.target.value)}
                />
                <Input
                  label="نقش در پروژه"
                  value={member.role}
                  disabled={locked}
                  onChange={(event) => updateMember(position, 'role', event.target.value)}
                />
                <Input
                  label="نسبت با شرکت (اختیاری)"
                  value={member.relation}
                  disabled={locked}
                  onChange={(event) => updateMember(position, 'relation', event.target.value)}
                />
                {team.length > 1 ? (
                  <Button
                    type="button"
                    variant="text-gray"
                    size="32"
                    className="self-start md:col-span-3"
                    disabled={locked}
                    onClick={() => setTeam((rows) => rows.filter((_, i) => i !== position))}
                  >
                    حذف عضو {toPersianDigits(position + 1)}
                  </Button>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="outline-gray"
              size="36"
              className="self-start"
              disabled={locked}
              onClick={() => setTeam((rows) => [...rows, emptyTeamMember()])}
            >
              افزودن عضو
            </Button>
          </fieldset>

          <div className="flex min-w-0 flex-col gap-2">
            <Typography as="span" variant="14/semibold" color="neutral-800">فایل پروپوزال</Typography>
            {request ? (
              <PrivateDocumentField
                category="proposal"
                label="پروپوزال"
                requestId={request.id}
                required
                canUpload={!locked}
                canDelete={!locked}
                onPendingChange={setUploadPending}
                onReadyChange={setDocumentsReady}
              />
            ) : (
              <Typography variant="12/regular" color="neutral-500">
                ابتدا پیش‌نویس را ذخیره کنید؛ سپس پروپوزال این زیرعنوان را بارگذاری کنید.
              </Typography>
            )}
          </div>

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
        </>
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

      {isDraft ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline-primary"
            size="40"
            loading={busy === 'save'}
            disabled={busy !== null || !eligible}
            onClick={() => void save()}
          >
            ذخیره پیش‌نویس
          </Button>
          <Button
            type="button"
            variant="primary"
            size="40"
            loading={busy === 'submit'}
            disabled={busy !== null || !eligible || uploadPending || staleDraft}
            onClick={() => void submit()}
          >
            ارسال پروپوزال
          </Button>
        </div>
      ) : null}
    </section>
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
