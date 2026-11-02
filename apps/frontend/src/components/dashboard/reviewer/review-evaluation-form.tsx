'use client'

import Link from 'next/link'
import { useId, useRef, useState, type ReactNode } from 'react'

import { TickCircleIcon } from '@/components/icons/generated'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import { getLoginUrl } from '@/utilities/auth-return-url'
import { formatDate } from '@/utilities/dashboard-api'
import {
  answeredRows,
  EMPLOYER_RISK_GROUPS,
  evaluationPayload,
  finalizeEvaluation,
  formatHundredths,
  formValuesFromEvaluation,
  MISSING_TEXT,
  missingForFinal,
  ORDINARY_QUESTIONS,
  RECOMMENDATIONS,
  REVIEW_RUBRIC_VERSION,
  RUBRIC_SECTIONS,
  saveEvaluationDraft,
  serverErrorText,
  stepOfPath,
  TOP_FIVE_QUESTION,
  WEIGHTED_MAX_HUNDREDTHS,
  type EvaluationDto,
  type EvaluationFormValues,
  type EvaluationVariant,
  type EvaluationWriteResult,
  type OwnEvaluationResponse,
  type RubricSection,
  type ScoreInput,
  type ScoreRow,
  type SectionKey,
  type YesNo,
} from '@/utilities/review-evaluation'
import { reviewerRoleLabel, type ReviewQueueItemDto } from '@/utilities/reviewer-case'

import { DecisionDialog } from '../decision-dialog'

const STEPS = ['نوآوری', 'تجاری‌سازی و بازار', 'مستندسازی', 'اظهار نظر کیفی', 'جمع‌بندی'] as const
const SUMMARY_STEP = STEPS.length - 1

type Notice =
  | 'saved'
  | 'finalized'
  | 'invalid'
  | 'missing'
  | 'stale'
  | 'locked'
  | 'error'
  | null

type Access = 'ok' | 'denied' | 'not-assigned' | 'expired'

export interface ReviewEvaluationFormProps {
  requestId: string
  /** The assigned case as `GET /review/cases/:id` returned it. */
  caseItem: ReviewQueueItemDto
  /** `GET /requests/:id/evaluation`: this person's own evaluation and the reviewed revision. */
  initial: OwnEvaluationResponse
}

/**
 * The fixed ordinary or employer review form (Figma 31881:33737, summary
 * 31881:34265) for the server-identified assignment. Drafts are saved to and
 * reopened from the server; finalization needs an explicit confirmation and the
 * server's acceptance, after which the form is read-only. Scores on screen are
 * only the server's, from the last save; nothing here decides an outcome.
 */
export function ReviewEvaluationForm({ requestId, caseItem, initial }: ReviewEvaluationFormProps) {
  const [saved, setSaved] = useState<EvaluationDto | null>(initial.evaluation)
  const [values, setValues] = useState<EvaluationFormValues>(() => formValuesFromEvaluation(initial.evaluation))
  const [dirty, setDirty] = useState(false)
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState<'save' | 'finalize' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [access, setAccess] = useState<Access>('ok')
  const [stale, setStale] = useState(false)
  const busyRef = useRef(false)

  const variant: EvaluationVariant =
    saved?.variant ?? (caseItem.assignment.role === 'employer-reviewer' ? 'employer' : 'ordinary')
  const revision = initial.revision
  const finalized = saved?.state === 'final'
  const readOnly = finalized || !caseItem.actionable || notice === 'locked'
  const casePath = `/dashboard/requests/${encodeURIComponent(requestId)}`
  const formPath = `${casePath}/evaluation`

  if (access !== 'ok') return <FormUnavailable access={access} casePath={casePath} formPath={formPath} />

  const edit = (update: (current: EvaluationFormValues) => EvaluationFormValues, ...paths: string[]) => {
    if (readOnly) return
    setValues((current) => update(current))
    setDirty(true)
    if (notice === 'saved' || notice === 'missing' || notice === 'invalid') setNotice(null)
    if (paths.some((path) => errors[path])) {
      setErrors((current) => {
        const next = { ...current }
        for (const path of paths) delete next[path]
        return next
      })
    }
  }

  const setScore = (section: SectionKey, key: string, patch: Partial<ScoreInput>) =>
    edit(
      (current) => ({
        ...current,
        scores: { ...current.scores, [section]: { ...current.scores[section], [key]: { ...current.scores[section][key], ...patch } } },
      }),
      `scores.${section}.${key}`,
      `scores.${section}.${key}.score`,
    )

  const handleResult = async (result: EvaluationWriteResult, kind: 'save' | 'finalize') => {
    switch (result.kind) {
      case 'ok':
        setSaved(result.evaluation)
        setValues(formValuesFromEvaluation(result.evaluation))
        setErrors({})
        setDirty(false)
        setNotice(kind === 'finalize' ? 'finalized' : 'saved')
        if (kind === 'finalize') setStep(SUMMARY_STEP)
        return
      case 'invalid': {
        const translated = Object.fromEntries(Object.entries(result.errors).map(([path, message]) => [path, serverErrorText(message)]))
        setErrors(translated)
        setNotice('invalid')
        const first = Object.keys(translated)[0]
        if (first) setStep(stepOfPath(first))
        return
      }
      case 'stale':
        setStale(true)
        setNotice('stale')
        return
      case 'locked':
        setNotice('locked')
        await reloadOwnEvaluation()
        return
      case 'denied':
        setAccess('denied')
        return
      case 'not-assigned':
        setAccess('not-assigned')
        return
      case 'expired':
        setAccess('expired')
        return
      default:
        setNotice('error')
    }
  }

  // After a lock refusal, show what the server holds rather than what was on screen.
  async function reloadOwnEvaluation() {
    try {
      const response = await fetch(`/api/dashboard/requests/${encodeURIComponent(requestId)}/evaluation`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!response.ok) return
      const data = (await response.json()) as OwnEvaluationResponse
      if (data.evaluation) {
        setSaved(data.evaluation)
        setValues(formValuesFromEvaluation(data.evaluation))
        setDirty(false)
      }
    } catch {
      // The lock notice stays; the page can be reloaded.
    }
  }

  const write = async (kind: 'save' | 'finalize') => {
    if (busyRef.current || readOnly || stale) return
    busyRef.current = true
    setBusy(kind)
    try {
      const body = evaluationPayload(values, variant, revision)
      const result = kind === 'save' ? await saveEvaluationDraft(requestId, body) : await finalizeEvaluation(requestId, body)
      await handleResult(result, kind)
    } finally {
      busyRef.current = false
      setBusy(null)
      setConfirming(false)
    }
  }

  const requestFinalize = () => {
    const missing = missingForFinal(values, variant)
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((path) => [path, MISSING_TEXT])))
      setNotice('missing')
      setStep(stepOfPath(missing[0]!))
      return
    }
    setConfirming(true)
  }

  const errorSteps = new Set(Object.keys(errors).map(stepOfPath))

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-4 px-4 py-6 sm:p-10" dir="rtl">
      <div className="flex flex-col gap-1">
        <Link href={casePath} className="self-start hover:underline">
          <Typography as="span" variant="14/regular" color="brand-600">بازگشت به پرونده</Typography>
        </Link>
        <Typography as="h1" variant="24/bold" color="neutral-900">فرم داوری</Typography>
        <Typography variant="14/regular" color="neutral-500" className="break-words">
          {caseItem.title} · <span className="font-mono">{caseItem.trackingCode}</span>
        </Typography>
        <Typography variant="12/regular" color="neutral-500" className="break-words">
          {reviewerRoleLabel(caseItem)} · نسخه درخواست {revision.toLocaleString('fa-IR')}
          {caseItem.proposalRevision ? ` · نسخه پروپوزال ${caseItem.proposalRevision.toLocaleString('fa-IR')}` : ''} · {REVIEW_RUBRIC_VERSION}
        </Typography>
      </div>

      <StatusBanner
        notice={notice}
        finalized={finalized}
        actionable={caseItem.actionable}
        saved={saved}
        dirty={dirty}
        formPath={formPath}
        errorCount={Object.keys(errors).length}
      />

      <section className="flex min-w-0 flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-6">
        <nav aria-label="مراحل فرم داوری">
          <ol className="grid grid-cols-5 gap-1">
            {STEPS.map((label, index) => (
              <li key={label} className="min-w-0">
                <Button
                  type="button"
                  variant="text-gray"
                  size="clear"
                  onClick={() => setStep(index)}
                  aria-current={step === index ? 'step' : undefined}
                  className="w-full flex-col gap-1 rounded-lg p-1"
                >
                  <span
                    className={`flex size-6 items-center justify-center rounded-full ${
                      errorSteps.has(index) ? 'bg-error-500 text-white'
                        : step === index ? 'bg-brand-500 text-white'
                          : index < step || finalized ? 'bg-brand-100 text-brand-600' : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {finalized || (index < step && !errorSteps.has(index)) ? (
                      <TickCircleIcon className="size-4" aria-hidden />
                    ) : (
                      <Typography as="span" variant="12/semibold" className="text-inherit">{(index + 1).toLocaleString('fa-IR')}</Typography>
                    )}
                  </span>
                  <Typography as="span" variant="12/regular" color={step === index ? 'neutral-900' : 'neutral-600'} className="hidden text-center sm:block">
                    {label}
                  </Typography>
                  <span className="sr-only sm:hidden">{label}</span>
                </Button>
              </li>
            ))}
          </ol>
          <Typography variant="14/semibold" color="neutral-900" className="mt-2 text-center sm:hidden">{STEPS[step]}</Typography>
        </nav>

        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-6">
          <legend className="sr-only">{STEPS[step]}</legend>
          {step < 3 ? (
            <SectionStep
              section={RUBRIC_SECTIONS[step]!}
              values={values}
              errors={errors}
              onScore={setScore}
              onComment={(path, value) => edit((current) => ({ ...current, comments: { ...current.comments, [path]: value } }))}
            />
          ) : null}
          {step === 3 ? <QualitativeStep variant={variant} values={values} errors={errors} edit={edit} /> : null}
        </fieldset>
        {step === SUMMARY_STEP ? <SummaryStep values={values} saved={saved} dirty={dirty} /> : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-4">
          <div className="flex flex-wrap gap-2">
            {step > 0 ? (
              <Button type="button" variant="outline-gray" size="36" onClick={() => setStep(step - 1)}>
                <Typography as="span" variant="14/regular" className="text-inherit">مرحله قبل</Typography>
              </Button>
            ) : null}
            {step < SUMMARY_STEP ? (
              <Button type="button" variant="outline-primary" size="36" onClick={() => setStep(step + 1)}>
                <Typography as="span" variant="14/regular" className="text-inherit">بعدی</Typography>
              </Button>
            ) : null}
          </div>
          {!readOnly ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline-gray" size="36" disabled={busy !== null || stale} onClick={() => void write('save')}>
                <Typography as="span" variant="14/regular" className="text-inherit">
                  {busy === 'save' ? 'در حال ذخیره…' : 'ذخیره پیش‌نویس'}
                </Typography>
              </Button>
              {step === SUMMARY_STEP ? (
                <Button type="button" size="36" disabled={busy !== null || stale} onClick={requestFinalize}>
                  <Typography as="span" variant="14/regular" className="text-inherit">ثبت نهایی ارزیابی</Typography>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {confirming ? (
        <DecisionDialog
          title="ثبت نهایی ارزیابی"
          description="پس از ثبت نهایی، این ارزیابی قفل می‌شود و دیگر قابل ویرایش نیست. امتیاز نهایی را سرور محاسبه و ثبت می‌کند و ثبت ارزیابی به‌تنهایی پرونده را به مرحله بعد نمی‌برد؛ تصمیم با سردبیر است."
          onClose={() => (busy ? undefined : setConfirming(false))}
          actions={
            <>
              <Button type="button" size="40" disabled={busy !== null} onClick={() => void write('finalize')}>
                <Typography as="span" variant="14/regular" className="text-inherit">
                  {busy === 'finalize' ? 'در حال ثبت…' : 'تأیید و ثبت نهایی'}
                </Typography>
              </Button>
              <Button type="button" variant="outline-gray" size="40" disabled={busy !== null} onClick={() => setConfirming(false)}>
                <Typography as="span" variant="14/regular" className="text-inherit">انصراف</Typography>
              </Button>
            </>
          }
        />
      ) : null}
    </main>
  )
}

/* ── Steps ─────────────────────────────────────────────────────────────── */

function SectionStep({
  section,
  values,
  errors,
  onScore,
  onComment,
}: {
  section: RubricSection
  values: EvaluationFormValues
  errors: Record<string, string>
  onScore: (section: SectionKey, key: string, patch: Partial<ScoreInput>) => void
  onComment: (path: string, value: string) => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Typography as="h2" variant="16/bold" color="neutral-900">
        سؤالات مربوط به {section.title} (وزن {section.weightLabel}، حداکثر خام {section.rawMax.toLocaleString('fa-IR')} امتیاز)
      </Typography>
      {section.rows.map((row) => {
        const path = `scores.${section.key}.${row.key}`
        return (
          <div key={row.key} className="grid min-w-0 gap-4 border-b border-neutral-100 pb-4 last:border-b-0 md:grid-cols-2">
            <ScoreField
              row={row}
              path={path}
              input={values.scores[section.key][row.key] ?? {}}
              error={errors[path] ?? errors[`${path}.score`]}
              onChange={(patch) => onScore(section.key, row.key, patch)}
            />
            <label className="flex min-w-0 flex-col gap-2">
              <Typography as="span" variant="14/semibold" color="neutral-700">توضیحات (اختیاری)</Typography>
              <Textarea
                value={values.comments[`${section.key}.${row.key}`] ?? ''}
                onChange={(event) => onComment(`${section.key}.${row.key}`, event.target.value)}
                placeholder="نظر خود را در اینجا بنویسید"
                rows={3}
                className="border-neutral-100"
              />
            </label>
          </div>
        )
      })}
    </div>
  )
}

function ScoreField({
  row,
  path,
  input,
  error,
  onChange,
}: {
  row: ScoreRow
  path: string
  input: ScoreInput
  error: string | undefined
  onChange: (patch: Partial<ScoreInput>) => void
}) {
  const id = useId()
  const errorId = `${id}-error`
  const described = error ? errorId : undefined
  const heading = (
    <Typography as="span" id={`${id}-label`} variant="14/semibold" color="neutral-700" className="break-words">
      <span className="text-neutral-400">{row.source} · </span>{row.label}
    </Typography>
  )
  const errorText = error ? (
    <Typography id={errorId} role="alert" variant="12/regular" color="error" data-error-for={path}>{error}</Typography>
  ) : null

  if (row.kind === 'tier') {
    const tier = row.tiers.find((item) => item.key === input.tier)
    return (
      <div role="group" aria-labelledby={`${id}-label`} data-field={path} className="flex min-w-0 flex-col gap-2">
        {heading}
        <RadioGroup
          aria-labelledby={`${id}-label`}
          value={input.tier ?? ''}
          onValueChange={(tier) => onChange({ tier })}
          className="flex flex-wrap gap-2"
        >
          {row.tiers.map((item) => (
            <ChoiceChip
              key={item.key}
              value={item.key}
              checked={input.tier === item.key}
              label={`${item.label} (${item.min.toLocaleString('fa-IR')}–${item.max.toLocaleString('fa-IR')})`}
            />
          ))}
        </RadioGroup>
        <Input
          aria-label={`امتیاز: ${row.label}`}
          aria-describedby={described}
          inputMode="numeric"
          value={input.score ?? ''}
          onChange={(event) => onChange({ score: event.target.value })}
          placeholder={tier ? `بین ${tier.min.toLocaleString('fa-IR')} تا ${tier.max.toLocaleString('fa-IR')}` : 'ابتدا سطح را انتخاب کنید'}
          variant={error ? 'error' : 'default'}
        />
        {errorText}
      </div>
    )
  }

  if (row.kind === 'binary') {
    return (
      <div data-field={path} className="flex min-w-0 flex-col gap-2">
        {heading}
        <RadioGroup
          aria-labelledby={`${id}-label`}
          aria-describedby={described}
          value={input.score ?? ''}
          onValueChange={(score) => onChange({ score })}
          className="flex flex-wrap gap-2"
        >
          {[0, row.max].map((value) => (
            <ChoiceChip
              key={value}
              value={String(value)}
              checked={input.score === String(value)}
              label={`${value.toLocaleString('fa-IR')} امتیاز`}
            />
          ))}
        </RadioGroup>
        <Typography variant="12/regular" color="neutral-500">فقط ۰ یا {row.max.toLocaleString('fa-IR')} امتیاز</Typography>
        {errorText}
      </div>
    )
  }

  if (row.kind === 'innovation') {
    return (
      <div role="group" aria-labelledby={`${id}-label`} data-field={path} className="flex min-w-0 flex-col gap-2">
        {heading}
        <CheckLine checked={input.articles === true} onChange={(checked) => onChange({ articles: checked })} label="مقاله دارد (۲ امتیاز، بدون توجه به تعداد مقاله)" />
        <Input
          aria-label="تعداد پتنت داخلی"
          aria-describedby={described}
          inputMode="numeric"
          value={input.domesticPatentCount ?? ''}
          onChange={(event) => onChange({ domesticPatentCount: event.target.value })}
          placeholder="تعداد پتنت داخلی"
          variant={error ? 'error' : 'default'}
        />
        <Typography variant="12/regular" color="neutral-500">هر پتنت داخلی ۳ امتیاز، حداکثر ۹ امتیاز</Typography>
        <CheckLine checked={input.international === true} onChange={(checked) => onChange({ international: checked })} label="در سطح بین‌المللی (۹ امتیاز)" />
        <Typography variant="12/regular" color="neutral-500">حداکثر این ردیف ۲۰ امتیاز</Typography>
        {errorText}
      </div>
    )
  }

  return (
    <div data-field={path} className="flex min-w-0 flex-col gap-2">
      {heading}
      <Input
        aria-label={`امتیاز: ${row.label}`}
        aria-describedby={described}
        inputMode="numeric"
        value={input.score ?? ''}
        onChange={(event) => onChange({ score: event.target.value })}
        placeholder={`بین ۰ تا ${row.max.toLocaleString('fa-IR')}`}
        variant={error ? 'error' : 'default'}
      />
      <Typography variant="12/regular" color="neutral-500">بین ۰ تا {row.max.toLocaleString('fa-IR')}</Typography>
      {errorText}
    </div>
  )
}

function QualitativeStep({
  variant,
  values,
  errors,
  edit,
}: {
  variant: EvaluationVariant
  values: EvaluationFormValues
  errors: Record<string, string>
  edit: (update: (current: EvaluationFormValues) => EvaluationFormValues, ...paths: string[]) => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {variant === 'ordinary' ? (
        <div className="flex flex-col gap-3">
          <Typography as="h2" variant="16/bold" color="neutral-900">ارزیابی کیفی</Typography>
          <Typography variant="12/regular" color="neutral-500">پاسخ «خیر» هم پاسخ کامل است. همه پرسش‌ها برای ثبت نهایی لازم‌اند.</Typography>
          {ORDINARY_QUESTIONS.map((question) => (
            <YesNoField
              key={question.key}
              path={`answers.${question.key}`}
              label={question.label}
              value={values.questions[question.key]}
              error={errors[`answers.${question.key}`]}
              onChange={(value) =>
                edit((current) => ({ ...current, questions: { ...current.questions, [question.key]: value } }), `answers.${question.key}`)
              }
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Typography as="h2" variant="16/bold" color="neutral-900">چک‌لیست ریسک</Typography>
          <Typography variant="12/regular" color="neutral-500">
            پاسخ «خیر» هم پاسخ کامل است. پرسش‌های تشریحی به پاسخ معنادار نیاز دارند. همه موارد برای ثبت نهایی لازم‌اند.
          </Typography>
          {EMPLOYER_RISK_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col gap-3 rounded-xl bg-neutral-50 p-3">
              <Typography as="h3" variant="14/semibold" color="neutral-900">{group.title}</Typography>
              {group.items.map((item) => {
                const path = `answers.risk.${group.key}.${item.key}`
                const value = values.risk[group.key]?.[item.key]
                const set = (next: string) =>
                  edit((current) => ({ ...current, risk: { ...current.risk, [group.key]: { ...current.risk[group.key], [item.key]: next } } }), path)
                return item.kind === 'yesno' ? (
                  <YesNoField key={item.key} path={path} label={item.label} value={value === 'yes' || value === 'no' ? value : undefined} error={errors[path]} onChange={set} />
                ) : (
                  <TextField key={item.key} path={path} label={item.label} value={value ?? ''} error={errors[path]} onChange={set} />
                )
              })}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Typography as="h2" variant="16/bold" color="neutral-900">جمع‌بندی داور</Typography>
        <div data-field="answers.recommendation" className="flex flex-col gap-2">
          <Typography as="span" variant="14/semibold" color="neutral-700">توصیه کلی</Typography>
          <RadioGroup
            aria-label="توصیه کلی"
            value={values.recommendation ?? ''}
            onValueChange={(next) =>
              edit((current) => ({ ...current, recommendation: next as typeof current.recommendation }), 'answers.recommendation')
            }
            className="flex flex-wrap gap-2"
          >
            {RECOMMENDATIONS.map((option) => (
              <ChoiceChip key={option.key} value={option.key} checked={values.recommendation === option.key} label={option.label} />
            ))}
          </RadioGroup>
          <FieldError path="answers.recommendation" error={errors['answers.recommendation']} />
        </div>
        <YesNoField
          path="answers.topFive.answer"
          label={TOP_FIVE_QUESTION}
          value={values.topFiveAnswer}
          error={errors['answers.topFive.answer']}
          onChange={(value) => edit((current) => ({ ...current, topFiveAnswer: value }), 'answers.topFive.answer')}
        />
        <TextField
          path="answers.topFive.rationale"
          label="دلیل یا دلایل (مختصر)"
          value={values.topFiveRationale}
          error={errors['answers.topFive.rationale']}
          onChange={(value) => edit((current) => ({ ...current, topFiveRationale: value }), 'answers.topFive.rationale')}
        />
      </div>
    </div>
  )
}

function SummaryStep({ values, saved, dirty }: { values: EvaluationFormValues; saved: EvaluationDto | null; dirty: boolean }) {
  const serverScore = (key: SectionKey) => (saved ? { a: saved.scoreA, b: saved.scoreB, c: saved.scoreC }[key] : null)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Typography as="h2" variant="16/bold" color="neutral-900">جمع‌بندی امتیازها</Typography>
      <Typography variant="12/regular" color="neutral-500">
        امتیازها را سرور از آخرین نسخه ذخیره‌شده محاسبه کرده است: ۰٫۴۵×الف + ۰٫۴۰×ب + ۰٫۱۵×ج، با حداکثر ۵۵٫۰۵ و بدون تبدیل به ۱۰۰.
        این عدد رتبه‌بندی یا عبور خودکار ایجاد نمی‌کند.
      </Typography>
      {dirty ? (
        <Typography role="status" variant="12/regular" color="neutral-700" className="rounded-lg border border-warning-500 bg-warning-50 p-2">
          تغییرات ذخیره‌نشده دارید؛ امتیاز سرور پس از ذخیره پیش‌نویس به‌روز می‌شود.
        </Typography>
      ) : null}
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        {RUBRIC_SECTIONS.map((section) => {
          const score = serverScore(section.key)
          return (
            <dl key={section.key} data-summary={section.key} className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-100 p-3">
              <Typography as="dt" variant="14/semibold" color="neutral-900" className="pb-2">{section.title} (وزن {section.weightLabel})</Typography>
              <SummaryLine label="ردیف‌های تکمیل‌شده" value={`${answeredRows(values, section).toLocaleString('fa-IR')} از ${section.rows.length.toLocaleString('fa-IR')}`} />
              <SummaryLine label="جمع امتیاز (سرور)" value={score === null ? '—' : `${score.toLocaleString('fa-IR')} از ${section.rawMax.toLocaleString('fa-IR')}`} />
            </dl>
          )
        })}
        <dl data-summary="total" className="flex flex-col divide-y divide-neutral-100 rounded-xl border border-neutral-100 p-3">
          <Typography as="dt" variant="14/semibold" color="neutral-900" className="pb-2">امتیاز نهایی</Typography>
          <SummaryLine
            label="امتیاز وزنی (سرور)"
            strong
            value={saved ? `${formatHundredths(saved.weightedHundredths)} از ${formatHundredths(WEIGHTED_MAX_HUNDREDTHS)}` : 'هنوز ذخیره نشده'}
          />
          <SummaryLine label="وضعیت" value={saved?.state === 'final' ? 'نهایی و قفل‌شده' : saved ? 'پیش‌نویس' : 'شروع نشده'} />
        </dl>
      </div>
    </div>
  )
}

/* ── Small parts ───────────────────────────────────────────────────────── */

function SummaryLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <Typography as="span" variant="12/regular" color="neutral-500">{label}</Typography>
      <Typography as="dd" variant={strong ? '20/bold' : '14/semibold'} color="brand-600">{value}</Typography>
    </div>
  )
}

function ChoiceChip({ value, checked, label }: { value: string; checked: boolean; label: string }) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 has-[:disabled]:cursor-not-allowed ${
        checked ? 'border-brand-500 bg-brand-50' : 'border-neutral-200 bg-white'
      }`}
    >
      <RadioGroupItem value={value} />
      <Typography as="span" variant="14/regular" color={checked ? 'brand-700' : 'neutral-700'}>{label}</Typography>
    </label>
  )
}

function CheckLine({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      <Typography as="span" variant="14/regular" color="neutral-700">{label}</Typography>
    </label>
  )
}

function YesNoField({ path, label, value, error, onChange }: { path: string; label: string; value: YesNo | undefined; error?: string; onChange: (value: YesNo) => void }) {
  const id = useId()
  return (
    <div data-field={path} className="flex min-w-0 flex-col gap-2 border-b border-neutral-100 pb-3 last:border-b-0">
      <Typography as="span" id={`${id}-label`} variant="14/regular" color="neutral-800" className="break-words">{label}</Typography>
      <RadioGroup
        aria-labelledby={`${id}-label`}
        value={value ?? ''}
        onValueChange={(next) => onChange(next as YesNo)}
        className="flex gap-2"
      >
        <ChoiceChip value="yes" checked={value === 'yes'} label="بله" />
        <ChoiceChip value="no" checked={value === 'no'} label="خیر" />
      </RadioGroup>
      <FieldError path={path} error={error} />
    </div>
  )
}

function TextField({ path, label, value, error, onChange }: { path: string; label: string; value: string; error?: string; onChange: (value: string) => void }) {
  return (
    <label data-field={path} className="flex min-w-0 flex-col gap-2">
      <Typography as="span" variant="14/regular" color="neutral-800" className="break-words">{label}</Typography>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} aria-invalid={error ? true : undefined} className="border-neutral-100" />
      <FieldError path={path} error={error} />
    </label>
  )
}

function FieldError({ path, error }: { path: string; error?: string }) {
  if (!error) return null
  return <Typography role="alert" variant="12/regular" color="error" data-error-for={path}>{error}</Typography>
}

function StatusBanner({
  notice,
  finalized,
  actionable,
  saved,
  dirty,
  formPath,
  errorCount,
}: {
  notice: Notice
  finalized: boolean
  actionable: boolean
  saved: EvaluationDto | null
  dirty: boolean
  formPath: string
  errorCount: number
}) {
  let tone: 'warning' | 'neutral' | 'success' = 'neutral'
  let body: ReactNode = null
  if (notice === 'stale') {
    tone = 'warning'
    body = (
      <>
        این پرونده پس از باز شدن فرم تغییر کرده است (نسخه یا دور داوری جدید). پاسخ‌ها به دور جدید منتقل نمی‌شوند و ذخیره نشدند.{' '}
        <Link href={formPath} className="underline">بارگذاری دوباره فرم</Link>
      </>
    )
  } else if (notice === 'locked') {
    tone = 'warning'
    body = 'این ارزیابی پیش‌تر نهایی و قفل شده است و تغییرات شما ذخیره نشد. نسخه ثبت‌شده نمایش داده می‌شود.'
  } else if (notice === 'error') {
    tone = 'warning'
    body = 'ذخیره انجام نشد. ارتباط با سرور برقرار نشد یا پاسخ نامعتبر بود؛ اطلاعات این صفحه حفظ شده است. دوباره تلاش کنید.'
  } else if (notice === 'invalid') {
    tone = 'warning'
    body = `سرور ${errorCount.toLocaleString('fa-IR')} مورد را نپذیرفت. موارد مشخص‌شده را اصلاح کنید.`
  } else if (notice === 'missing') {
    tone = 'warning'
    body = `${errorCount.toLocaleString('fa-IR')} مورد الزامی هنوز تکمیل نشده است. پیش‌نویس را می‌توانید ذخیره کنید، اما ثبت نهایی به تکمیل همه موارد نیاز دارد.`
  } else if (notice === 'finalized' || finalized) {
    tone = 'success'
    body = `ارزیابی شما${saved?.finalizedAt ? ` در ${formatDate(saved.finalizedAt)}` : ''} نهایی و قفل شد و دیگر قابل ویرایش نیست.`
  } else if (!actionable) {
    body = 'ارزیابی این پرونده بسته شده است و فرم فقط برای مشاهده است.'
  } else if (notice === 'saved') {
    tone = 'success'
    body = `پیش‌نویس ذخیره شد${saved ? ` (${formatDate(saved.updatedAt)})` : ''}. پیش‌نویس جزو ارزیابی‌های نهایی شمرده نمی‌شود.`
  } else if (saved && !dirty) {
    body = `پیش‌نویس ذخیره‌شده در ${formatDate(saved.updatedAt)} بازگشایی شد.`
  }
  if (!body) return null
  const classes = {
    warning: 'border border-warning-500 bg-warning-50',
    success: 'border border-success-500 bg-success-50',
    neutral: 'bg-neutral-100',
  }[tone]
  return (
    <Typography role={tone === 'warning' ? 'alert' : 'status'} data-notice={notice ?? (finalized ? 'finalized' : 'info')} variant="14/regular" color="neutral-700" className={`rounded-xl p-3 ${classes}`}>
      {body}
    </Typography>
  )
}

function FormUnavailable({ access, casePath, formPath }: { access: Exclude<Access, 'ok'>; casePath: string; formPath: string }) {
  const copy = {
    denied: { title: 'اجازه ثبت این ارزیابی را ندارید', body: 'دسترسی شما به این پرونده تغییر کرده است یا نقش فعلی شما اجازه این کار را ندارد.' },
    'not-assigned': { title: 'این پرونده دیگر به شما ارجاع نشده است', body: 'ارجاع شما لغو یا جایگزین شده است و فرم ارزیابی دیگر نمایش داده نمی‌شود.' },
    expired: { title: 'نشست شما پایان یافته است', body: 'برای ادامه دوباره وارد شوید. پاسخ‌های ذخیره‌نشده این صفحه ثبت نشده‌اند.' },
  }[access]
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:p-10" dir="rtl">
      <section role="alert" data-state={access} className="flex flex-col items-start gap-2 rounded-2xl border border-warning-500 bg-warning-50 p-4">
        <Typography as="h1" variant="16/semibold" color="neutral-700">{copy.title}</Typography>
        <Typography variant="14/regular" color="neutral-600">{copy.body}</Typography>
        <Button asChild size="36" variant={access === 'expired' ? 'default' : 'outline-gray'}>
          <Link href={access === 'expired' ? getLoginUrl(formPath, { expired: true }) : access === 'denied' ? casePath : '/dashboard/requests'}>
            <Typography as="span" variant="14/regular" className="text-inherit">
              {access === 'expired' ? 'ورود دوباره' : access === 'denied' ? 'بازگشت به پرونده' : 'پرونده‌های من'}
            </Typography>
          </Link>
        </Button>
      </section>
    </main>
  )
}
