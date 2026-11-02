'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useState } from 'react'

import { DecisionDialog } from '@/components/dashboard/decision-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  decideReview,
  decideTriage,
  describeMutationFailure,
  getReviewCandidates,
  reopenRequest,
  startReviewRound,
  type RequestAction,
  type ReviewCandidatesDto,
} from '@/utilities/dashboard-api'

const ERROR_MESSAGES: Record<string, string> = {
  stale_revision: 'پرونده پس از باز شدن این صفحه تغییر کرده است (برای نمونه شرکت نسخه تازه‌ای فرستاده است). صفحه به‌روز شد؛ وضعیت را دوباره بررسی کنید.',
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
  forbidden: 'این اقدام برای نقش شما مجاز نیست یا دسترسی شما تغییر کرده است.',
  not_found: 'پرونده پیدا نشد یا دیگر در دسترس شما نیست.',
}

const errorMessage = (cause: unknown) =>
  ERROR_MESSAGES[cause instanceof DashboardApiError ? cause.code : ''] ??
  describeMutationFailure(cause, 'اقدام انجام نشد. دوباره تلاش کنید.')

/** One command the server may list for this person, with what it does and what it asks for. */
interface Decision {
  /** The `allowedActions` entry that offers this command. */
  gate: RequestAction
  key: string
  /** The button that opens the dialog. */
  label: string
  variant: 'primary' | 'outline' | 'destructive'
  /** The dialog's title, consequence and confirm label (Figma 31885:6566). */
  title: string
  effect: string
  confirm: string
  /** Asked for, required and shown to the company or recorded in history. */
  reason?: { label: string; placeholder: string }
  send: (id: string, reason: string, revision?: number) => Promise<unknown>
  done: string
}

const TRIAGE: Decision[] = [
  {
    gate: 'triage',
    key: 'triage-accept',
    label: 'پذیرش و ارجاع به داوری',
    variant: 'primary',
    title: 'پذیرش برای داوری',
    effect: 'پرونده از بررسی اولیه می‌گذرد و برای تعیین داوران آماده می‌شود.',
    confirm: 'پذیرش',
    send: (id, _reason, revision) => decideTriage(id, 'accept', '', revision),
    done: 'پرونده برای داوری پذیرفته شد.',
  },
  {
    gate: 'triage',
    key: 'triage-return',
    label: 'درخواست اصلاحیه',
    variant: 'outline',
    title: 'درخواست اصلاحیه',
    effect: 'همان پرونده با همان کد پیگیری برای اصلاح به شرکت برمی‌گردد و پس از ارسال دوباره، به بررسی اولیه بازمی‌گردد.',
    confirm: 'ارسال',
    reason: { label: 'توضیحات (برای شرکت نمایش داده می‌شود)', placeholder: 'اصلاحات لازم را برای شرکت بنویسید' },
    send: (id, reason, revision) => decideTriage(id, 'return', reason, revision),
    done: 'درخواست اصلاحیه برای شرکت ثبت شد.',
  },
  {
    gate: 'triage',
    key: 'triage-reject',
    label: 'رد درخواست',
    variant: 'destructive',
    title: 'رد درخواست',
    effect: 'در صورت رد درخواست، این شرکت دیگر قادر به ثبت درخواست در عنوان انتخابی نخواهد بود. فقط صاحب سیستم می‌تواند آن را بازگشایی کند.',
    confirm: 'رد درخواست',
    reason: { label: 'دلیل رد (برای شرکت نمایش داده می‌شود)', placeholder: 'دلیل رد نهایی را بنویسید' },
    send: (id, reason, revision) => decideTriage(id, 'reject', reason, revision),
    done: 'درخواست رد شد.',
  },
]

const REVIEW_DECISION: Decision[] = [
  {
    gate: 'decideReview',
    key: 'decision-advance',
    label: 'انتقال به مرحله مالی',
    variant: 'primary',
    title: 'انتقال به مرحله مالی',
    effect: 'از شرکت برای ارسال بسته مالی دعوت می‌شود و اقدام دیگری از سردبیر لازم نیست.',
    confirm: 'انتقال',
    send: (id, _reason, revision) => decideReview(id, 'advance', '', revision),
    done: 'پرونده به مرحله مالی منتقل شد.',
  },
  {
    gate: 'decideReview',
    key: 'decision-return',
    label: 'درخواست اصلاحیه',
    variant: 'outline',
    title: 'درخواست اصلاحیه پس از داوری',
    effect: 'پرونده برای اصلاح به شرکت برمی‌گردد و پس از ارسال دوباره، بررسی اولیه و دور داوری تازه‌ای لازم است.',
    confirm: 'ارسال',
    reason: { label: 'توضیحات (برای شرکت نمایش داده می‌شود)', placeholder: 'اصلاحات لازم را برای شرکت بنویسید' },
    send: (id, reason, revision) => decideReview(id, 'return', reason, revision),
    done: 'درخواست اصلاحیه برای شرکت ثبت شد.',
  },
  {
    gate: 'decideReview',
    key: 'decision-reject',
    label: 'رد درخواست',
    variant: 'destructive',
    title: 'رد درخواست پس از داوری',
    effect: 'پرونده در این مرحله رد می‌شود. فقط صاحب سیستم می‌تواند آن را بازگشایی کند.',
    confirm: 'رد درخواست',
    reason: { label: 'دلیل رد (برای شرکت نمایش داده می‌شود)', placeholder: 'دلیل رد نهایی را بنویسید' },
    send: (id, reason, revision) => decideReview(id, 'reject', reason, revision),
    done: 'درخواست رد شد.',
  },
]

const REOPEN: Decision = {
  gate: 'reopen',
  key: 'reopen',
  label: 'بازگشایی پرونده',
  variant: 'outline',
  title: 'بازگشایی پرونده ردشده',
  effect: 'پرونده به بررسی اولیه سردبیر بازمی‌گردد. نام شما و دلیل بازگشایی در تاریخچه پرونده ثبت می‌شود.',
  confirm: 'بازگشایی',
  reason: { label: 'دلیل بازگشایی (در تاریخچه ثبت می‌شود)', placeholder: 'دلیل بازگشایی را بنویسید' },
  send: (id, reason, revision) => reopenRequest(id, reason, revision),
  done: 'پرونده بازگشایی شد و به بررسی اولیه بازگشت.',
}

type Notice = { kind: 'success' | 'error'; text: string }

/**
 * The commands the server lists for this person on this case and stage. Nothing here
 * decides who may act: each control only exists for an entry of `allowedActions`, and
 * the command re-checks it. After any answer the case and the queue are read again.
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
  const router = useRouter()
  const [open, setOpen] = useState<Decision | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const groups = [
    actions.includes('triage')
      ? { key: 'triage', title: 'بررسی اولیه', hint: 'پروفایل و پروپوزال ثبت‌شده شرکت را بررسی کنید و یکی از سه تصمیم را ثبت کنید.', items: TRIAGE }
      : null,
    actions.includes('decideReview')
      ? { key: 'decision', title: 'تصمیم پس از چهار ارزیابی', hint: 'هر چهار ارزیابی نهایی شده است. تصمیم شما وضعیت پرونده را تغییر می‌دهد.', items: REVIEW_DECISION }
      : null,
    actions.includes('reopen')
      ? { key: 'reopen', title: 'بازگشایی پرونده ردشده', hint: 'فقط صاحب سیستم می‌تواند پرونده ردشده را با ثبت دلیل بازگشایی کند.', items: [REOPEN] }
      : null,
  ].filter((group) => group !== null)
  const startsRound = actions.includes('startReview')

  if (!groups.length && !startsRound && !notice && !open) return null

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-brand-600 bg-white p-4 sm:p-6">
      <Typography as="h2" variant="20/bold" color="neutral-900">اقدام شما</Typography>
      {notice ? (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 ${notice.kind === 'error' ? 'bg-error-50' : 'bg-success-50'}`}
        >
          <Typography variant="14/regular" color={notice.kind === 'error' ? 'error' : 'success'}>{notice.text}</Typography>
          {notice.kind === 'success' ? (
            <Button asChild variant="text-primary" size="32">
              <Link href="/dashboard/requests">
                <Typography variant="14/regular" className="text-inherit">بازگشت به صف درخواست‌ها</Typography>
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-3">
          <Typography as="h3" variant="16/semibold" color="neutral-900">{group.title}</Typography>
          <Typography variant="14/regular" color="neutral-500">{group.hint}</Typography>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <Button
                key={item.key}
                type="button"
                variant={item.variant}
                size="40"
                className="px-4"
                onClick={() => {
                  setNotice(null)
                  setOpen(item)
                }}
              >
                <Typography variant="14/regular" className="text-inherit">{item.label}</Typography>
              </Button>
            ))}
          </div>
        </div>
      ))}
      {startsRound ? <StartRoundForm id={id} revision={revision} /> : null}
      {open ? (
        <DecisionForm
          key={open.key}
          decision={open}
          // A refreshed case may no longer offer the command; the dialog then explains instead of sending.
          available={actions.includes(open.gate)}
          onClose={() => setOpen(null)}
          onSend={async (reason) => {
            try {
              await open.send(id, reason, revision)
              setOpen(null)
              setNotice({ kind: 'success', text: `${open.done} پرونده و صف به‌روز شد.` })
              return null
            } catch (cause) {
              return errorMessage(cause)
            } finally {
              router.refresh()
            }
          }}
        />
      ) : null}
    </section>
  )
}

/** The dialog of one command: keeps what was typed when it fails and shows the pending send. */
function DecisionForm({
  decision,
  available,
  onClose,
  onSend,
}: {
  decision: Decision
  available: boolean
  onClose: () => void
  onSend: (reason: string) => Promise<string | null>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const reasonId = useId()
  const trimmed = reason.trim()
  const missingReason = Boolean(decision.reason) && !trimmed

  const submit = async () => {
    setTouched(true)
    if (missingReason || busy || !available) return
    setBusy(true)
    setError(null)
    const failure = await onSend(decision.reason ? trimmed : '')
    // A success closes and unmounts the dialog; only a failure is left to show.
    if (failure) {
      setError(failure)
      setBusy(false)
    }
  }

  return (
    <DecisionDialog
      title={decision.title}
      description={decision.effect}
      onClose={() => {
        if (!busy) onClose()
      }}
      actions={
        <>
          <Button
            type="button"
            variant={decision.variant === 'destructive' ? 'destructive' : 'primary'}
            size="40"
            disabled={busy || !available}
            onClick={() => void submit()}
          >
            <Typography variant="14/regular" className="text-inherit">{busy ? 'در حال ثبت…' : decision.confirm}</Typography>
          </Button>
          <Button type="button" variant={decision.variant === 'destructive' ? 'outline-gray' : 'outline'} size="40" disabled={busy} onClick={onClose}>
            <Typography variant="14/regular" className="text-inherit">{decision.variant === 'destructive' ? 'انصراف' : 'لغو'}</Typography>
          </Button>
        </>
      }
    >
      {decision.reason ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={reasonId}>
            <Typography as="span" variant="14/semibold" color="neutral-700">{decision.reason.label}</Typography>
          </label>
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={decision.reason.placeholder}
            rows={5}
            disabled={busy}
            required
            aria-invalid={touched && missingReason ? true : undefined}
          />
          {touched && missingReason ? (
            <Typography variant="12/regular" color="error">نوشتن دلیل الزامی است.</Typography>
          ) : null}
        </div>
      ) : null}
      {busy ? <Typography role="status" variant="12/regular" color="neutral-500">تصمیم در حال ثبت است؛ پنجره را نبندید.</Typography> : null}
      {!available && !busy ? (
        <Typography variant="14/regular" color="warning">این اقدام دیگر برای این پرونده فعال نیست.</Typography>
      ) : null}
      {error ? <Typography role="alert" variant="14/regular" color="error">{error}</Typography> : null}
    </DecisionDialog>
  )
}

function StartRoundForm({ id, revision }: { id: string; revision?: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      await startReviewRound(id, picked, revision)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
      router.refresh()
    }
  }

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
            onClick={() => void start()}
          >
            <Typography variant="14/regular" className="text-inherit">شروع داوری</Typography>
          </Button>
        </>
      )}
      {error ? <Typography role="alert" variant="14/regular" color="error">{error}</Typography> : null}
    </div>
  )
}
