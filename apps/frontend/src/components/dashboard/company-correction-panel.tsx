'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { RequestFormFieldInput, type RequestFormField } from '@/components/dashboard/request-form-field'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import {
  listAgreements,
  resubmitCorrection,
  updateRequest,
  type AgreementDefinition,
  type RequestDto,
} from '@/utilities/dashboard-api'
import {
  emptyTeamMember,
  isTeamComplete,
  teamForAnswers,
  teamFromAnswers,
  type TeamMember,
} from '@/utilities/event-application'
import { profileSectionHref } from '@/utilities/participation-eligibility'
import {
  correctionMissingLabels,
  describeCorrectionFailure,
  type CorrectionFailure,
} from '@/utilities/request-tracking'
import { toast } from 'sonner'

const toPersianDigits = (value: number | string) =>
  String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit)

type AgreementLoad =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; nonCompete?: AgreementDefinition; eventRules?: AgreementDefinition }

export interface CompanyCorrectionPanelProps {
  request: Pick<RequestDto, 'id' | 'trackingCode' | 'answers' | 'revision'>
  fields: RequestFormField[]
  /** `review`: the chief returned the case after four evaluations, so a new review round follows. */
  after: 'triage' | 'review' | null
}

function stringAnswers(fields: RequestFormField[], answers: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = answers[field.name]
      return typeof value === 'string' || typeof value === 'number' ? [[field.name, String(value)]] : []
    }),
  )
}

/**
 * FE13: correction of a case the chief returned. It edits the same application
 * (same id and tracking code) and resubmits it, which gives the proposal a new
 * revision. Only rendered when the server lists `correct`; the server re-checks
 * the state, ownership, verification, required fields and agreement versions.
 */
export function CompanyCorrectionPanel({ request, fields, after }: CompanyCorrectionPanelProps) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string>>(() => stringAnswers(fields, request.answers ?? {}))
  const [team, setTeam] = useState<TeamMember[]>(() => teamFromAnswers(request.answers?.applicationTeam))
  const [agreements, setAgreements] = useState<AgreementLoad>({ status: 'loading' })
  const [acceptNonCompete, setAcceptNonCompete] = useState(false)
  const [acceptRules, setAcceptRules] = useState(false)
  const [documentsReady, setDocumentsReady] = useState(false)
  const [uploadPending, setUploadPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<CorrectionFailure | null>(null)
  const [done, setDone] = useState(false)
  // Only the latest submit may change this form; an older reply is stale.
  const attempt = useRef(0)

  const fieldLabels = useMemo(
    () => Object.fromEntries(fields.map((field) => [field.name, field.label || field.name])),
    [fields],
  )

  const loadAgreements = useCallback(async () => {
    try {
      const list = (await listAgreements()).agreements ?? []
      setAgreements({
        status: 'ready',
        nonCompete: list.find((agreement) => agreement.type === 'non_compete'),
        eventRules: list.find((agreement) => agreement.type === 'event_rules'),
      })
    } catch {
      setAgreements({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    void loadAgreements()
  }, [loadAgreements])

  const updateMember = (position: number, key: keyof TeamMember, value: string) =>
    setTeam((rows) => rows.map((row, i) => (i === position ? { ...row, [key]: value } : row)))

  const submit = async () => {
    if (busy || done) return
    const missing: string[] = []
    // Naming team members is optional; a member who was started still needs a name and a role.
    if (teamForAnswers(team).length > 0 && !isTeamComplete(team)) missing.push('applicationTeam')
    if (!documentsReady) missing.push('proposalDocuments')
    if (!acceptNonCompete) missing.push('nonCompeteAcceptance')
    if (!acceptRules) missing.push('eventRulesAcceptance')
    if (uploadPending) {
      setFailure({ kind: 'other', message: 'تا پایان بارگذاری فایل صبر کنید.' })
      return
    }
    if (missing.length > 0) {
      setFailure({
        kind: 'missing',
        message: `پیش از ارسال این موارد را کامل کنید: ${correctionMissingLabels(missing, fieldLabels).join('، ')}.`,
      })
      return
    }
    if (agreements.status !== 'ready' || !agreements.nonCompete || !agreements.eventRules) {
      setFailure({ kind: 'other', message: 'نسخه تعهدنامه‌ها از سرور دریافت نشد. دوباره تلاش کنید.' })
      return
    }
    const current = ++attempt.current
    setBusy(true)
    setFailure(null)
    try {
      // The edits land on the same case; resubmission then pins them as a new proposal revision.
      await updateRequest(request.id, {
        answers: { ...(request.answers ?? {}), ...answers, applicationTeam: teamForAnswers(team) },
      })
      if (current !== attempt.current) return
      await resubmitCorrection(request.id, {
        nonCompeteAcceptance: { accepted: true, textVersionId: agreements.nonCompete.version },
        eventRulesAcceptance: { accepted: true, textVersionId: agreements.eventRules.version },
      })
      if (current !== attempt.current) return
      setDone(true)
      toast.success('اصلاحیه ارسال شد.')
      router.refresh()
    } catch (cause) {
      if (current !== attempt.current) return
      toast.error('ارسال اصلاحیه انجام نشد.')
      const described = describeCorrectionFailure(cause, fieldLabels)
      setFailure(described)
      // A stale case is reread so the page shows what the server now holds; the typed input stays.
      if (described.kind === 'stale') router.refresh()
    } finally {
      if (current === attempt.current) setBusy(false)
    }
  }

  const locked = busy || done
  const unapproved = agreements.status === 'ready' && [agreements.nonCompete, agreements.eventRules].some((item) => item && !item.approved)

  return (
    <section
      aria-labelledby="correction-heading"
      data-testid="company-correction"
      className="flex min-w-0 flex-col gap-5 rounded-2xl border border-warning-400 bg-background p-4 sm:p-6"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <Typography as="h2" id="correction-heading" variant="20/bold" color="neutral-900">
          اصلاح و ارسال دوباره پرونده
        </Typography>
        <Typography variant="14/regular" color="neutral-600">
          اصلاحات روی همین پرونده با کد پیگیری <span dir="ltr">{request.trackingCode}</span> ثبت می‌شود و پس از ارسال، نسخه تازه‌ای از پروپوزال ساخته می‌شود.
        </Typography>
        {after === 'review' ? (
          <Typography variant="14/regular" color="neutral-600" data-testid="new-round-note">
            این پرونده پس از داوری برای اصلاح برگشته است. نسخه اصلاح‌شده دوباره بررسی اولیه می‌شود و سپس یک دور داوری تازه با ارزیابی‌های جدید آغاز خواهد شد؛ امتیازهای دور قبل در دور جدید حساب نمی‌شود.
          </Typography>
        ) : (
          <Typography variant="14/regular" color="neutral-600">
            نسخه اصلاح‌شده دوباره در بررسی اولیه قرار می‌گیرد.
          </Typography>
        )}
      </div>

      {done ? (
        <div role="status" data-testid="correction-sent" className="rounded-xl bg-success-50 p-4">
          <Typography variant="14/semibold" color="neutral-800">
            اصلاحیه ارسال شد. پرونده دوباره در صف بررسی اولیه قرار گرفت.
          </Typography>
        </div>
      ) : (
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
              <Typography as="span" variant="14/semibold" color="neutral-800">اعضای کلیدی تیم</Typography>
            </legend>
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
            <Typography variant="12/regular" color="neutral-500">
              فایل پروپوزال اصلاح‌شده را جایگزین کنید. نسخه‌های ارسال‌شده قبلی در تاریخچه پرونده باقی می‌مانند.
            </Typography>
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
          </div>

          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="mb-1">
              <Typography as="span" variant="14/semibold" color="neutral-800">تعهدنامه‌ها</Typography>
            </legend>
            {agreements.status === 'loading' ? (
              <Typography role="status" variant="12/regular" color="neutral-500">در حال دریافت نسخه تعهدنامه‌ها…</Typography>
            ) : null}
            {agreements.status === 'error' ? (
              <div className="flex flex-col gap-2">
                <Typography role="alert" variant="12/regular" className="text-error-600">
                  دریافت نسخه تعهدنامه‌ها انجام نشد.
                </Typography>
                <Button type="button" variant="outline-primary" size="32" className="self-start" onClick={() => {
                  setAgreements({ status: 'loading' })
                  void loadAgreements()
                }}>
                  تلاش دوباره
                </Button>
              </div>
            ) : null}
            {unapproved ? (
              <Typography variant="12/regular" color="neutral-500" data-testid="agreement-unapproved">
                متن نهایی تعهدنامه‌ها هنوز منتشر نشده است. پذیرش فعلی با نسخه موقت ثبت می‌شود و پس از انتشار متن نهایی دوباره از شما خواسته خواهد شد.
              </Typography>
            ) : null}
            <AgreementCheckbox
              id="correction-non-compete"
              label={`${(agreements.status === 'ready' && agreements.nonCompete?.title) || 'قرارداد عدم رقابت'} را مطالعه کرده‌ام و می‌پذیرم.`}
              checked={acceptNonCompete}
              disabled={locked || agreements.status !== 'ready' || !agreements.nonCompete}
              onChange={setAcceptNonCompete}
            />
            <AgreementCheckbox
              id="correction-rules"
              label={`${(agreements.status === 'ready' && agreements.eventRules?.title) || 'قوانین رویداد'} را مطالعه کرده‌ام و می‌پذیرم.`}
              checked={acceptRules}
              disabled={locked || agreements.status !== 'ready' || !agreements.eventRules}
              onChange={setAcceptRules}
            />
          </fieldset>

          {failure ? (
            <Typography role="alert" variant="14/regular" className="text-error-600">{failure.message}</Typography>
          ) : null}
          {failure?.kind === 'not_verified' ? (
            <Link href={profileSectionHref('company-verification', `/dashboard/requests/${encodeURIComponent(request.id)}`)} className="block">
              <Typography as="span" variant="14/semibold" color="brand-600">بررسی وضعیت احراز هویت در پروفایل شرکت</Typography>
            </Link>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="primary"
              size="40"
              loading={busy}
              disabled={locked || uploadPending}
              onClick={() => void submit()}
            >
              ارسال اصلاحیه
            </Button>
          </div>
        </>
      )}
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
