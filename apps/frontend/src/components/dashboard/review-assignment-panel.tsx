'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import { DecisionDialog } from '@/components/dashboard/decision-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Typography } from '@/components/ui/typography'
import {
  DashboardApiError,
  describeMutationFailure,
  formatDate,
  getEmployerCandidates,
  getReviewCandidates,
  replaceEmployer,
  replaceReviewer,
  startReviewRound,
  type EvaluationListDto,
  type RequestAction,
  type ReviewCandidatesDto,
  type ReviewRoundDto,
  type ReviewRoundSlotDto,
} from '@/utilities/dashboard-api'
import { DashboardSelect } from '@/components/dashboard/dashboard-select'
import { DashboardCloseCircle, InformationBulkIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'

/** Each optional read: null when this role has no such read, `failed` when it did not arrive. */
type Part<T> = T | null | 'failed'

const ERROR_MESSAGES: Record<string, string> = {
  stale_revision: 'پرونده پس از باز شدن این صفحه تغییر کرده است (برای نمونه شرکت نسخه تازه‌ای فرستاده است). صفحه به‌روز شد؛ وضعیت را دوباره بررسی کنید.',
  invalid_round_state: 'پرونده دیگر در مرحله داوری نیست. صفحه به‌روز شد.',
  round_already_started: 'دور داوری این نسخه قبلاً آغاز شده است. صفحه به‌روز شد.',
  round_not_started: 'برای نسخه فعلی پرونده دور داوری فعالی وجود ندارد. صفحه به‌روز شد.',
  employer_unavailable: 'کارفرمای فعالی برای این پرونده در دسترس نیست. با صاحب سیستم تماس بگیرید.',
  reviewer_not_eligible: 'داور انتخاب‌شده دیگر فعال یا واجد شرایط نیست. داور دیگری انتخاب کنید.',
  employer_not_eligible: 'کارفرمای انتخاب‌شده دیگر فعال یا واجد شرایط نیست. فرد دیگری انتخاب کنید.',
  duplicate_people: 'هر جایگاه باید به فرد متفاوتی برسد؛ یک نفر دو بار انتخاب شده است.',
  three_reviewers_required: 'سه داور را انتخاب کنید.',
  already_assigned: 'این فرد هم‌اکنون در همین دور داوری جایگاه دارد.',
  previously_assigned: 'این فرد قبلاً از همین دور داوری کنار گذاشته شده و نمی‌تواند بازگردد.',
  evaluation_final: 'این داور ارزیابی خود را نهایی کرده است و دیگر قابل جایگزینی نیست. صفحه به‌روز شد.',
  not_assigned: 'این فرد دیگر جایگاهی در این دور ندارد. صفحه به‌روز شد.',
  replacement_required: 'جایگزین را انتخاب کنید.',
  reason_required: 'نوشتن دلیل الزامی است.',
  invalid_reason: 'دلیل حداکثر ۱۰۰۰ نویسه می‌تواند باشد.',
  forbidden: 'این اقدام برای نقش شما مجاز نیست یا دسترسی شما تغییر کرده است.',
  not_found: 'پرونده پیدا نشد یا دیگر در دسترس شما نیست.',
}

const errorMessage = (cause: unknown) =>
  ERROR_MESSAGES[cause instanceof DashboardApiError ? cause.code : ''] ??
  describeMutationFailure(cause, 'اقدام انجام نشد. دوباره تلاش کنید.')

const fa = (value: number) => value.toLocaleString('fa-IR')

type SlotState = 'final' | 'draft' | 'pending'

/** The tag of a slot's evaluation (Figma 31888:52320): not opened yet, being written, or final. */
const SLOT_STATE: Record<SlotState, { label: string; variant: 'gray' | 'primary' | 'green' }> = {
  final: { label: 'بررسی شده', variant: 'green' },
  draft: { label: 'درحال بررسی', variant: 'primary' },
  pending: { label: 'مشاهده نشده', variant: 'gray' },
}

export interface ReviewAssignmentPanelProps {
  id: string
  actions: RequestAction[]
  /** The case revision the page was read at; sent so a changed case is refused as stale. */
  revision?: number
  /** The proposal revision the next round would review, when known. */
  proposalRevision: number | null
  round: Part<{ round: ReviewRoundDto | null }>
  evaluations: Part<EvaluationListDto>
  /** Display names for the ids the server returned to this reader. */
  people: Record<string, string>
  /** The employer who will take the fixed slot of a new round (chief's start only). */
  employerId?: string | null
}

type Dialog =
  | { kind: 'start' }
  | { kind: 'replace'; slot: 'ordinary'; outgoing: ReviewRoundSlotDto }
  | { kind: 'replace'; slot: 'employer'; outgoing: ReviewRoundSlotDto | null }

/**
 * The four people reviewing the case's current revision (Figma 31885:20781): the fixed
 * employer and three ordinary reviewers, each with their progress, the replacements
 * made and how many of the four evaluations are final. Controls exist only for the
 * commands `allowedActions` lists; the server re-checks every one.
 */
export function ReviewAssignmentPanel({
  id,
  actions,
  revision,
  proposalRevision,
  round,
  evaluations,
  people,
  employerId = null,
}: ReviewAssignmentPanelProps) {
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const current = round === 'failed' ? null : (round?.round ?? null)
  const canStart = actions.includes('startReview')
  const canReplaceReviewer = actions.includes('replaceReviewer')
  const canReplaceEmployer = actions.includes('replaceEmployer')
  if (round === null && !canStart) return null
  if (round !== 'failed' && !current && !canStart) return null

  const nameOf = (userId: string | null | undefined, fallback: string) => (userId && people[userId]) || fallback
  const finals = new Map<string, SlotState>()
  if (evaluations && evaluations !== 'failed') {
    for (const item of evaluations.items) {
      if (!item.userId) continue
      if (item.state === 'final') finals.set(item.userId, 'final')
      else if (!finals.has(item.userId)) finals.set(item.userId, 'draft')
    }
  }
  const slots = current?.slots ?? []
  const active = slots.filter((slot) => slot.active)
  const employerSlot = active.find((slot) => slot.slot === 'employer') ?? null
  const ordinary = active.filter((slot) => slot.slot === 'ordinary')
  // Old slots of an earlier revision were never this round's to replace.
  const isCurrent = Boolean(current && revision !== undefined && current.requestRevision === revision)
  const stateOf = (slot: ReviewRoundSlotDto): SlotState | null =>
    evaluations === 'failed' || evaluations === null ? null : (finals.get(slot.userId) ?? 'pending')

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-neutral-200 bg-background p-4" aria-labelledby={`${id}-reviewers`}>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Typography id={`${id}-reviewers`} as="h2" variant="20/extrabold" color="neutral-800">لیست داوران و فرم‌های داوری</Typography>
          {current ? (
            <div className="flex items-center gap-2">
              <Badge variant={current.completion.ready ? 'green' : 'gray'} size="md">
                <Typography as="span" variant="14/regular" className="text-inherit">
                  {fa(current.completion.finalized)}/{fa(current.completion.required)}
                </Typography>
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="text-gray" size="icon-xs" aria-label="راهنمای فهرست داوران">
                      <InformationBulkIcon aria-hidden="true" className="size-5 text-neutral-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    در صورت عدم تکمیل داوری از سمت یکی از داوران، داور را حذف کنید و یک داور جایگزین اضافه کنید
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : null}
        </div>
        {current ? (
          <Typography variant="14/regular" color="neutral-500">
            برای اتمام داوری نیاز به {fa(current.completion.required)} داوری تمام شده است
          </Typography>
        ) : null}
      </div>

      {round === 'failed' ? (
        <Typography role="alert" variant="14/regular" color="error">دریافت اطلاعات داوری انجام نشد. صفحه را دوباره بارگذاری کنید.</Typography>
      ) : null}

      {!current && canStart ? (
        <div className="flex flex-col gap-3">
          <Typography variant="14/regular" color="neutral-500">
            کارفرمای پرونده جایگاه ثابت چهارم را دارد. برای آغاز داوری سه داور متفاوت انتخاب کنید.
          </Typography>
          <Button
            type="button"
            size="40" className="w-full sm:w-fit"
            onClick={() => {
              setDialog({ kind: 'start' })
            }}
          >
            <Typography variant="14/regular" className="text-inherit">ارجاع به داوران</Typography>
          </Button>
        </div>
      ) : null}

      {current ? (
        <>
          <Typography variant="14/regular" color="neutral-500">
            نسخه پرونده {fa(current.requestRevision)} · نسخه پروپوزال {fa(current.proposalRevision)} · آغاز در {formatDate(current.startedAt)}
          </Typography>
          {!isCurrent && revision !== undefined ? (
            <Typography variant="14/regular" color="warning">
              این دور برای نسخه پیشین پرونده است و برای نسخه فعلی ({fa(revision)}) هنوز داورانی تعیین نشده است.
            </Typography>
          ) : null}
          {evaluations === 'failed' ? (
            <Typography role="alert" variant="14/regular" color="error">وضعیت ارزیابی‌ها دریافت نشد؛ جایگزینی تا بارگذاری دوباره صفحه غیرفعال است.</Typography>
          ) : null}
          {current.slots ? (
            <ul className="flex flex-col divide-y divide-neutral-200">
              {employerSlot ? (
                <SlotRow
                  employer
                  name={nameOf(employerSlot.userId, 'کارفرمای پرونده')}
                  state={stateOf(employerSlot)}
                  replaceLabel={canReplaceEmployer && isCurrent ? 'جایگزینی کارفرما' : null}
                  onReplace={() => {
                    setDialog({ kind: 'replace', slot: 'employer', outgoing: employerSlot })
                  }}
                />
              ) : (
                <li className="rounded-lg bg-warning-50 p-3">
                  <Typography variant="14/regular" color="warning">جایگاه کارفرما فعال نیست.</Typography>
                </li>
              )}
              {ordinary.map((slot, index) => {
                const state = stateOf(slot)
                return (
                  <SlotRow
                    key={slot.assignmentId}
                    name={nameOf(slot.userId, `داور ${fa(index + 1)}`)}
                    state={state}
                    // Only an unfinished ordinary reviewer is replaceable; the server re-checks it under lock.
                    replaceLabel={canReplaceReviewer && isCurrent && state !== null && state !== 'final' ? 'جایگزینی داور' : null}
                    onReplace={() => {
                      setDialog({ kind: 'replace', slot: 'ordinary', outgoing: slot })
                    }}
                  />
                )
              })}
            </ul>
          ) : null}
          {current.replacements?.length ? (
            <div className="flex flex-col gap-2">
              <Typography as="h3" variant="16/semibold" color="neutral-900">سابقه جایگزینی</Typography>
              <ol className="flex flex-col gap-2">
                {current.replacements.map((item) => (
                  <li key={item.id} className="rounded-lg border border-neutral-100 p-3">
                    <Typography variant="14/regular" color="neutral-800" className="break-words">
                      {item.slot === 'employer' ? 'کارفرما' : 'داور'}: {nameOf(item.oldUserId, 'فرد پیشین')} ← {nameOf(item.newUserId, 'فرد جدید')}
                    </Typography>
                    <Typography variant="12/regular" color="neutral-500">
                      توسط {nameOf(item.replacedBy, 'ثبت‌کننده')} · {formatDate(item.replacedAt)}
                    </Typography>
                    {item.reason ? (
                      <Typography variant="14/regular" color="neutral-600" className="mt-1 whitespace-pre-wrap break-words">دلیل: {item.reason}</Typography>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </>
      ) : null}

      {dialog?.kind === 'start' ? (
        <StartRoundDialog
          id={id}
          revision={revision}
          proposalRevision={proposalRevision}
          employerName={nameOf(employerId, 'کارفرمای ثابت پرونده')}
          available={canStart}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null)
            toast.success('پرونده به چهار داور ارجاع شد. پرونده به‌روز شد.')
          }}
        />
      ) : null}
      {dialog?.kind === 'replace' ? (
        <ReplaceDialog
          id={id}
          revision={revision}
          slot={dialog.slot}
          outgoingName={
            dialog.outgoing ? nameOf(dialog.outgoing.userId, dialog.slot === 'employer' ? 'کارفرمای فعلی' : 'داور فعلی') : 'کارفرمای فعلی'
          }
          outgoingId={dialog.outgoing?.userId ?? null}
          available={dialog.slot === 'employer' ? canReplaceEmployer : canReplaceReviewer}
          onClose={() => setDialog(null)}
          onDone={(text) => {
            setDialog(null)
            toast.success(text)
          }}
        />
      ) : null}
    </section>
  )
}

function SlotRow({
  employer = false,
  name,
  state,
  replaceLabel,
  onReplace,
}: {
  employer?: boolean
  name: string
  state: SlotState | null
  replaceLabel: string | null
  onReplace: () => void
}) {
  return (
    <li className="flex items-center gap-2 py-2">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600"
      >
        <Typography as="span" variant="14/semibold" className="text-inherit">{name.trim().charAt(0) || '—'}</Typography>
      </span>
      <Typography as="span" variant="16/regular" color={employer ? 'neutral-400' : 'neutral-600'} className="min-w-0 truncate">
        {name}
      </Typography>
      {employer ? <Badge variant="gray" size="sm">کارفرما</Badge> : null}
      <span className="flex-1" />
      {state ? <Badge variant={SLOT_STATE[state].variant} size="sm">{SLOT_STATE[state].label}</Badge> : null}
      {replaceLabel ? (
        <Button type="button" variant="text-gray" size="icon-32" onClick={onReplace} aria-label={`${replaceLabel}: ${name}`}>
          <DashboardCloseCircle aria-hidden="true" className="size-5" />
        </Button>
      ) : null}
    </li>
  )
}

/** Reads the people the server offers when a dialog opens: loading, denied or failed, and empty. */
function useCandidates(load: () => Promise<ReviewCandidatesDto>) {
  const [state, setState] = useState<{ data: ReviewCandidatesDto | null; error: string | null }>({ data: null, error: null })
  // The loader is fixed for the dialog's lifetime: one read per opening.
  const loader = useRef(load)
  useEffect(() => {
    let alive = true
    loader.current()
      .then((data) => {
        if (alive) setState({ data, error: null })
      })
      .catch((cause: unknown) => {
        if (alive) setState({ data: null, error: errorMessage(cause) })
      })
    return () => {
      alive = false
    }
  }, [])
  return state
}

function PersonSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: string
  options: { id: string; name: string | null }[]
  disabled: boolean
  onChange: (value: string) => void
}) {
  const selectId = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={selectId}>
        <Typography as="span" variant="14/semibold" color="neutral-700">{label}</Typography>
      </label>
      <DashboardSelect
        id={selectId}
        label={label}
        value={value}
        disabled={disabled}
        placeholder={`${label} را جستجو یا انتخاب کنید`}
        options={options.map((person) => ({ value: person.id, label: person.name ?? 'بدون نام' }))}
        onChange={onChange}
      />
    </div>
  )
}

/** The chief's assignment dialog: the fixed employer, three distinct reviewers, then «ارجاع». */
function StartRoundDialog({
  id,
  revision,
  proposalRevision,
  employerName,
  available,
  onClose,
  onDone,
}: {
  id: string
  revision?: number
  proposalRevision: number | null
  employerName: string
  available: boolean
  onClose: () => void
  onDone: () => void
}) {
  const router = useRouter()
  const candidates = useCandidates(() => getReviewCandidates(id))
  const [picked, setPicked] = useState<string[]>(['', '', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chosen = picked.filter(Boolean)
  const distinct = new Set(chosen).size === chosen.length
  const complete = chosen.length === 3 && distinct
  const items = candidates.data?.items ?? []

  const submit = async () => {
    if (!complete) {
      setError(distinct ? 'سه داور را انتخاب کنید.' : ERROR_MESSAGES.duplicate_people)
      return
    }
    if (busy || !available) return
    setBusy(true)
    setError(null)
    try {
      await startReviewRound(id, picked, revision)
      onDone()
    } catch (cause) {
      toast.error('ثبت ارجاع انجام نشد.')
      setError(errorMessage(cause))
      setBusy(false)
    } finally {
      router.refresh()
    }
  }

  return (
    <DecisionDialog
      title="ارجاع درخواست"
      description="در این مرحله درخواست را به سه داور ارجاع می‌دهید؛ کارفرمای پرونده جایگاه چهارم را خودکار می‌گیرد."
      onClose={() => {
        if (!busy) onClose()
      }}
      actions={
        <>
          <Button type="button" size="40" disabled={busy || !available || !candidates.data} onClick={() => void submit()}>
            <Typography variant="14/regular" className="text-inherit">{busy ? 'در حال ثبت…' : 'ارجاع'}</Typography>
          </Button>
          <Button type="button" variant="outline-gray" size="40" disabled={busy} onClick={onClose}>
            <Typography variant="14/regular" className="text-inherit">لغو</Typography>
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1 rounded-lg bg-neutral-50 p-3">
        <Typography variant="12/regular" color="neutral-500">کارفرما (ثابت)</Typography>
        <Typography variant="14/semibold" color="neutral-800" className="break-words">{employerName}</Typography>
      </div>
      <Typography variant="12/regular" color="neutral-500">
        {proposalRevision !== null ? `نسخه پروپوزال مورد داوری: ${fa(proposalRevision)}` : 'نسخه پروپوزال: ثبت نشده'}
        {revision !== undefined ? ` · نسخه پرونده ${fa(revision)}` : ''}
      </Typography>
      {candidates.error ? (
        <Typography role="alert" variant="14/regular" color="error">دریافت فهرست داوران انجام نشد. {candidates.error}</Typography>
      ) : !candidates.data ? (
        <Typography role="status" variant="14/regular" color="neutral-500">در حال دریافت فهرست داوران…</Typography>
      ) : items.length < 3 ? (
        <Typography role="alert" variant="14/regular" color="warning">
          {items.length ? `فقط ${fa(items.length)} داور فعال واجد شرایط وجود دارد؛ برای ارجاع سه داور لازم است.` : 'هیچ داور فعال واجد شرایطی وجود ندارد.'}
        </Typography>
      ) : (
        <div className="flex flex-col gap-3">
          {picked.map((value, slot) => (
            <PersonSelect
              key={slot}
              label={`داور ${fa(slot + 1)}`}
              value={value}
              disabled={busy}
              // A person already picked in another slot is not offered again.
              options={items.filter((person) => person.id === value || !picked.includes(person.id))}
              onChange={(next) => {
                setError(null)
                setPicked((current) => current.map((item, index) => (index === slot ? next : item)))
              }}
            />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Typography variant="14/semibold" color="neutral-700">داوران انتخابی</Typography>
          <Typography as="span" variant="12/regular" className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700">
            {fa(chosen.length + 1)}/{fa(4)}
          </Typography>
        </div>
        <Typography variant="12/regular" color="neutral-500">
          داوری زمانی کامل است که هر چهار ارزیابی نهایی شود. داوری را که ارزیابی خود را تمام نکرده است بعداً می‌توانید جایگزین کنید.
        </Typography>
      </div>
      {busy ? <Typography role="status" variant="12/regular" color="neutral-500">ارجاع در حال ثبت است؛ پنجره را نبندید.</Typography> : null}
      {!available && !busy ? <Typography variant="14/regular" color="warning">این اقدام دیگر برای این پرونده فعال نیست.</Typography> : null}
      {error ? <Typography role="alert" variant="14/regular" color="error">{error}</Typography> : null}
    </DecisionDialog>
  )
}

/** Replaces one slot: an unfinished ordinary reviewer (chief) or the employer (owner, with a reason). */
function ReplaceDialog({
  id,
  revision,
  slot,
  outgoingId,
  outgoingName,
  available,
  onClose,
  onDone,
}: {
  id: string
  revision?: number
  slot: 'ordinary' | 'employer'
  outgoingId: string | null
  outgoingName: string
  available: boolean
  onClose: () => void
  onDone: (notice: string) => void
}) {
  const router = useRouter()
  const employer = slot === 'employer'
  const candidates = useCandidates(() => (employer ? getEmployerCandidates(id) : getReviewCandidates(id)))
  const [picked, setPicked] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const reasonId = useId()
  const trimmed = reason.trim()
  const missingReason = employer && !trimmed
  const items = (candidates.data?.items ?? []).filter((person) => person.id !== outgoingId)

  const submit = async () => {
    setTouched(true)
    if (!picked) {
      setError(ERROR_MESSAGES.replacement_required)
      return
    }
    if (missingReason || busy || !available) return
    if (!employer && !outgoingId) return
    setBusy(true)
    setError(null)
    try {
      if (employer) await replaceEmployer(id, picked, trimmed, revision)
      else await replaceReviewer(id, outgoingId as string, picked, trimmed, revision)
      onDone(employer ? 'کارفرمای پرونده جایگزین شد و در تاریخچه ثبت شد.' : 'داور جایگزین شد و در تاریخچه ثبت شد.')
    } catch (cause) {
      toast.error('ثبت ارجاع انجام نشد.')
      setError(errorMessage(cause))
      setBusy(false)
    } finally {
      // Refreshes the slots, so a revoked assignment disappears from the list at once.
      router.refresh()
    }
  }

  return (
    <DecisionDialog
      title={employer ? 'جایگزینی کارفرما' : 'جایگزینی داور'}
      description={
        employer
          ? `دسترسی ${outgoingName} به این پرونده لغو می‌شود. ارزیابی او نگه داشته می‌شود اما در این دور شمرده نمی‌شود و کارفرمای جدید باید ارزیابی را نهایی کند.`
          : `دسترسی ${outgoingName} که ارزیابی خود را نهایی نکرده است لغو می‌شود و داور جدید جای او را می‌گیرد. این جایگزینی در تاریخچه پرونده ثبت می‌شود.`
      }
      onClose={() => {
        if (!busy) onClose()
      }}
      actions={
        <>
          <Button type="button" size="40" disabled={busy || !available || !candidates.data} onClick={() => void submit()}>
            <Typography variant="14/regular" className="text-inherit">{busy ? 'در حال ثبت…' : 'جایگزینی'}</Typography>
          </Button>
          <Button type="button" variant="outline-gray" size="40" disabled={busy} onClick={onClose}>
            <Typography variant="14/regular" className="text-inherit">لغو</Typography>
          </Button>
        </>
      }
    >
      {candidates.error ? (
        <Typography role="alert" variant="14/regular" color="error">دریافت فهرست جایگزین‌ها انجام نشد. {candidates.error}</Typography>
      ) : !candidates.data ? (
        <Typography role="status" variant="14/regular" color="neutral-500">در حال دریافت فهرست جایگزین‌ها…</Typography>
      ) : !items.length ? (
        <Typography role="alert" variant="14/regular" color="warning">
          {employer ? 'کارفرمای فعال دیگری برای جایگزینی وجود ندارد.' : 'داور فعال دیگری که در این دور نبوده باشد وجود ندارد.'}
        </Typography>
      ) : (
        <PersonSelect
          label={employer ? 'کارفرمای جدید' : 'داور جدید'}
          value={picked}
          options={items}
          disabled={busy}
          onChange={(next) => {
            setError(null)
            setPicked(next)
          }}
        />
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor={reasonId}>
          <Typography as="span" variant="14/semibold" color="neutral-700">
            {employer ? 'دلیل جایگزینی (الزامی، در تاریخچه ثبت می‌شود)' : 'توضیحات (اختیاری، در تاریخچه ثبت می‌شود)'}
          </Typography>
        </label>
        <Textarea
          id={reasonId}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="متن توضیحات خود را وارد کنید"
          rows={4}
          maxLength={1000}
          disabled={busy}
          required={employer}
          aria-invalid={touched && missingReason ? true : undefined}
        />
        {touched && missingReason ? <Typography variant="12/regular" color="error">نوشتن دلیل الزامی است.</Typography> : null}
      </div>
      {busy ? <Typography role="status" variant="12/regular" color="neutral-500">جایگزینی در حال ثبت است؛ پنجره را نبندید.</Typography> : null}
      {!available && !busy ? <Typography variant="14/regular" color="warning">این اقدام دیگر برای این پرونده فعال نیست.</Typography> : null}
      {error ? <Typography role="alert" variant="14/regular" color="error">{error}</Typography> : null}
    </DecisionDialog>
  )
}
