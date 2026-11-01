'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  decideReview,
  decideTriage,
  getReviewCandidates,
  reopenRequest,
  startReviewRound,
  type RequestAction,
  type ReviewCandidatesDto,
  type ReviewDecisionAction,
  type TriageAction,
} from '@/utilities/dashboard-api'

const ERROR_MESSAGES: Record<string, string> = {
  stale_revision: 'پرونده پس از باز شدن این صفحه تغییر کرده است. صفحه به‌روز شد؛ وضعیت را دوباره بررسی کنید.',
  invalid_triage_state: 'پرونده دیگر در مرحله بررسی اولیه نیست. صفحه به‌روز شد.',
  invalid_decision_state: 'پرونده دیگر در مرحله تصمیم سردبیر نیست. صفحه به‌روز شد.',
  round_not_ready: 'هنوز هر چهار ارزیابی نهایی نشده است.',
  invalid_reopen_state: 'این پرونده دیگر قابل بازگشایی نیست. صفحه به‌روز شد.',
  invalid_round_state: 'پرونده در مرحله شروع داوری نیست. صفحه به‌روز شد.',
  round_already_started: 'دور داوری این نسخه قبلاً آغاز شده است. صفحه به‌روز شد.',
  employer_unavailable: 'کارفرمای فعالی برای این پرونده در دسترس نیست.',
  reviewer_not_eligible: 'یکی از داوران انتخاب‌شده دیگر واجد شرایط نیست.',
  duplicate_people: 'سه داور باید متفاوت باشند.',
  three_reviewers_required: 'سه داور را انتخاب کنید.',
  reason_required: 'نوشتن دلیل الزامی است.',
  forbidden: 'این اقدام برای نقش شما مجاز نیست.',
  not_found: 'پرونده پیدا نشد.',
}

const errorMessage = (cause: unknown) =>
  ERROR_MESSAGES[cause instanceof DashboardApiError ? cause.code : ''] ?? 'اقدام انجام نشد. دوباره تلاش کنید.'

const TRIAGE_OPTIONS: DecisionOption<TriageAction>[] = [
  { value: 'accept', label: 'پذیرش برای داوری', effect: 'پرونده به مرحله داوری می‌رود.' },
  { value: 'return', label: 'بازگرداندن برای اصلاح', effect: 'همان پرونده برای اصلاح به شرکت برمی‌گردد.', reason: true },
  { value: 'reject', label: 'رد نهایی', effect: 'پرونده رد می‌شود و فقط صاحب سیستم می‌تواند آن را بازگشایی کند.', reason: true },
]

const DECISION_OPTIONS: DecisionOption<ReviewDecisionAction>[] = [
  { value: 'advance', label: 'انتقال به مرحله مالی', effect: 'از شرکت برای ارسال بسته مالی دعوت می‌شود.' },
  { value: 'return', label: 'بازگرداندن برای اصلاح', effect: 'پس از اصلاح شرکت، دور داوری تازه‌ای لازم است.', reason: true },
  { value: 'reject', label: 'رد نهایی', effect: 'پرونده در این مرحله رد می‌شود.', reason: true },
]

interface DecisionOption<T extends string> {
  value: T
  label: string
  effect: string
  reason?: boolean
}

/**
 * The commands the server lists for this person on this case and stage. Nothing here
 * decides who may act: each control only exists for an entry of `allowedActions`, and
 * the command re-checks it.
 */
export function RequestActionsPanel({
  id,
  actions,
  revision,
}: {
  id: string
  actions: RequestAction[]
  revision?: number
}) {
  const controls = [
    actions.includes('triage') ? (
      <DecisionForm
        key="triage"
        title="بررسی اولیه"
        options={TRIAGE_OPTIONS}
        submit={(action, reason) => decideTriage(id, action, reason, revision)}
      />
    ) : null,
    actions.includes('startReview') ? <StartRoundForm key="round" id={id} revision={revision} /> : null,
    actions.includes('decideReview') ? (
      <DecisionForm
        key="decision"
        title="تصمیم پس از چهار ارزیابی"
        options={DECISION_OPTIONS}
        submit={(action, reason) => decideReview(id, action, reason, revision)}
      />
    ) : null,
    actions.includes('reopen') ? <ReopenForm key="reopen" id={id} revision={revision} /> : null,
  ].filter(Boolean)

  if (!controls.length) return null

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-brand-600 bg-white p-6">
      <Typography as="h2" variant="20/bold" color="neutral-900">اقدام شما</Typography>
      {controls}
    </section>
  )
}

/** Runs one command, keeps what was typed when it fails, and rereads the case either way. */
function useCommand() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (command: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await command()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
      router.refresh()
    }
  }
  return { busy, error, run }
}

function DecisionForm<T extends string>({
  title,
  options,
  submit,
}: {
  title: string
  options: DecisionOption<T>[]
  submit: (action: T, reason: string) => Promise<unknown>
}) {
  const { busy, error, run } = useCommand()
  const [selected, setSelected] = useState<T | null>(null)
  const [reason, setReason] = useState('')
  const option = options.find((item) => item.value === selected)
  const needsReason = option?.reason === true
  const trimmed = reason.trim()

  return (
    <fieldset className="flex flex-col gap-3" disabled={busy}>
      <legend>
        <Typography as="span" variant="16/semibold" color="neutral-900">{title}</Typography>
      </legend>
      <div className="flex flex-col gap-2">
        {options.map((item) => (
          <label key={item.value} className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3">
            <input
              type="radio"
              name={title}
              checked={selected === item.value}
              onChange={() => setSelected(item.value)}
              className="mt-1"
            />
            <span className="flex flex-col gap-1">
              <Typography as="span" variant="14/semibold" color="neutral-800">{item.label}</Typography>
              <Typography as="span" variant="12/regular" color="neutral-500">{item.effect}</Typography>
            </span>
          </label>
        ))}
      </div>
      {needsReason ? (
        <label className="flex flex-col gap-1">
          <Typography variant="12/regular" color="neutral-500">دلیل (برای شرکت نمایش داده می‌شود)</Typography>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        </label>
      ) : null}
      {error ? <Typography role="alert" variant="14/regular" color="error">{error}</Typography> : null}
      <Button
        type="button"
        size="40"
        className="w-fit"
        disabled={busy || !option || (needsReason && !trimmed)}
        onClick={() => {
          if (!option || !window.confirm(`«${option.label}» ثبت شود؟ ${option.effect}`)) return
          void run(() => submit(option.value, needsReason ? trimmed : ''))
        }}
      >
        <Typography variant="14/regular" className="text-inherit">ثبت تصمیم</Typography>
      </Button>
    </fieldset>
  )
}

function StartRoundForm({ id, revision }: { id: string; revision?: number }) {
  const { busy, error, run } = useCommand()
  const [candidates, setCandidates] = useState<ReviewCandidatesDto | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string[]>(['', '', ''])

  useEffect(() => {
    let active = true
    getReviewCandidates(id)
      .then((next) => {
        if (active) setCandidates(next)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [id])

  const complete = picked.every(Boolean) && new Set(picked).size === 3

  return (
    <div className="flex flex-col gap-3">
      <Typography as="h3" variant="16/semibold" color="neutral-900">شروع دور داوری</Typography>
      <Typography variant="14/regular" color="neutral-500">
        کارفرمای پرونده خودکار جایگاه چهارم را می‌گیرد. سه داور متفاوت انتخاب کنید.
      </Typography>
      {failed ? (
        <Typography role="alert" variant="14/regular" color="error">دریافت فهرست داوران انجام نشد. صفحه را دوباره بارگذاری کنید.</Typography>
      ) : !candidates ? (
        <Typography role="status" variant="14/regular" color="neutral-500">در حال دریافت فهرست داوران…</Typography>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {picked.map((value, slot) => (
              <label key={slot} className="flex min-w-0 flex-col gap-1">
                <Typography variant="12/regular" color="neutral-500">داور {(slot + 1).toLocaleString('fa-IR')}</Typography>
                <select
                  value={value}
                  disabled={busy}
                  onChange={(event) =>
                    setPicked((current) => current.map((item, index) => (index === slot ? event.target.value : item)))
                  }
                  className="h-10 rounded-lg border border-neutral-200 bg-white px-2"
                >
                  <option value="">انتخاب کنید</option>
                  {candidates.items
                    .filter((person) => person.id === value || !picked.includes(person.id))
                    .map((person) => (
                      <option key={person.id} value={person.id}>{person.name ?? person.id}</option>
                    ))}
                </select>
              </label>
            ))}
          </div>
          <Button
            type="button"
            size="40"
            className="w-fit"
            disabled={busy || !complete}
            onClick={() => void run(() => startReviewRound(id, picked, revision))}
          >
            <Typography variant="14/regular" className="text-inherit">شروع داوری</Typography>
          </Button>
        </>
      )}
      {error ? <Typography role="alert" variant="14/regular" color="error">{error}</Typography> : null}
    </div>
  )
}

function ReopenForm({ id, revision }: { id: string; revision?: number }) {
  const { busy, error, run } = useCommand()
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  return (
    <div className="flex flex-col gap-3">
      <Typography as="h3" variant="16/semibold" color="neutral-900">بازگشایی پرونده ردشده</Typography>
      <label className="flex flex-col gap-1">
        <Typography variant="12/regular" color="neutral-500">دلیل بازگشایی (در تاریخچه ثبت می‌شود)</Typography>
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} disabled={busy} />
      </label>
      {error ? <Typography role="alert" variant="14/regular" color="error">{error}</Typography> : null}
      <Button
        type="button"
        size="40"
        className="w-fit"
        disabled={busy || !trimmed}
        onClick={() => {
          if (!window.confirm('این پرونده بازگشایی شود؟')) return
          void run(() => reopenRequest(id, trimmed, revision))
        }}
      >
        <Typography variant="14/regular" className="text-inherit">بازگشایی</Typography>
      </Button>
    </div>
  )
}
