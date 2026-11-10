'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  formatDate,
  type EvaluationListDto,
  type EvaluationSummaryDto,
  type ReviewRoundDto,
  type ReviewRoundHistoryEntry,
} from '@/utilities/dashboard-api'
import { formatHundredths } from '@/utilities/review-evaluation'

/** A read for this summary: null when the role has none, `failed`/`denied` when it did not arrive. */
export type SummaryPart<T> = T | null | 'failed' | 'denied'

export interface ChiefReviewSummaryProps {
  /** The latest round of the case, as GET /review-round returned it. */
  round: SummaryPart<{ round: ReviewRoundDto | null }>
  /** The latest round's evaluations, read by that round's request revision. */
  evaluations: SummaryPart<EvaluationListDto>
  /** Earlier rounds, newest first, each with its own evaluations. */
  history: SummaryPart<ReviewRoundHistoryEntry[]>
  /** Display names resolved on the server for ids the round responses returned. */
  people?: Record<string, string>
  /** The server lists `decideReview` for this person on this case. */
  canDecide: boolean
}

const fa = (value: number) => value.toLocaleString('fa-IR')

const DECISION_LABELS: Record<string, string> = {
  advance: 'انتقال به مرحله مالی',
  return: 'بازگشت برای اصلاح',
  reject: 'رد نهایی',
}

const finalsOf = (list: EvaluationListDto | 'failed' | 'denied' | null): EvaluationSummaryDto[] =>
  list && typeof list === 'object' ? list.items.filter((item) => item.state === 'final') : []

/**
 * The chief's (and oversight's) summary of the current round's four final
 * evaluations, the decision readiness the server reports, and earlier rounds kept
 * as history. Every number is a value the API returned; nothing here scores,
 * ranks or advances a case. The decision itself is the explicit command in
 * «اقدام شما», which exists only when the server lists `decideReview`.
 */
export function ChiefReviewSummary({ round, evaluations, history, people = {}, canDecide }: ChiefReviewSummaryProps) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const current = round && typeof round === 'object' ? round.round : null
  const finals = finalsOf(evaluations)
  const closed = Boolean(current && (current.supersededAt || current.decision?.action === 'return'))
  const ready = Boolean(current?.completion.ready)
  const denied = round === 'denied' || evaluations === 'denied'

  const refresh = () => startRefresh(() => router.refresh())

  return (
    <section
      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-neutral-200 bg-background p-4"
      aria-labelledby="chief-review-summary"
      data-testid="chief-review-summary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography id="chief-review-summary" as="h2" variant="16/bold" sm="20/bold" color="neutral-800">خلاصه چهار ارزیابی</Typography>
        {current ? (
          <Typography
            as="span"
            variant="14/semibold"
            className={`rounded-full px-3 py-1 ${ready ? 'bg-success-50 text-success-700' : 'bg-neutral-100 text-neutral-700'}`}
          >
            {fa(current.completion.finalized)}/{fa(current.completion.required)}
          </Typography>
        ) : null}
      </div>

      {denied ? (
        <Typography role="alert" variant="14/regular" color="error">
          دسترسی شما به ارزیابی‌های این پرونده مجاز نیست یا تغییر کرده است.
        </Typography>
      ) : round === 'failed' || evaluations === 'failed' ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-error-50 p-3">
          <Typography variant="14/regular" color="error">دریافت خلاصه ارزیابی‌ها انجام نشد.</Typography>
          <RefreshButton busy={refreshing} onClick={refresh} label="تلاش دوباره" />
        </div>
      ) : !current ? (
        <Typography variant="14/regular" color="neutral-500">هنوز دور داوری برای این پرونده آغاز نشده است.</Typography>
      ) : (
        <>
          <Typography variant="14/regular" color="neutral-500">
            دور نسخه {fa(current.requestRevision)} پرونده · نسخه پروپوزال {fa(current.proposalRevision)}
          </Typography>
          <Typography variant="12/regular" color="neutral-500">
            امتیازها همان مقادیری است که سرور برای هر ارزیابی نهایی‌شده ثبت کرده است. امتیاز بالا پرونده را خودکار منتقل نمی‌کند؛ انتقال به مرحله بعد فقط با تصمیم صریح سردبیر انجام می‌شود.
          </Typography>

          <ReadinessNotice
            round={current}
            closed={closed}
            canDecide={canDecide}
            refreshing={refreshing}
            onRefresh={refresh}
          />

          {finals.length ? (
            <EvaluationList items={finals} people={people} />
          ) : (
            <Typography variant="14/regular" color="neutral-500">هنوز ارزیابی نهایی‌شده‌ای برای این دور ثبت نشده است.</Typography>
          )}

          {current.decision ? <DecisionLine decision={current.decision} people={people} /> : null}
        </>
      )}

      <RoundHistory history={history} people={people} />
    </section>
  )
}

function RefreshButton({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="outline-gray" size="32" disabled={busy} onClick={onClick}>
      <Typography variant="14/regular" className="text-inherit">{busy ? 'در حال به‌روزرسانی…' : label}</Typography>
    </Button>
  )
}

/** What the next step waits for, from the server's completion count and command list only. */
function ReadinessNotice({
  round,
  closed,
  canDecide,
  refreshing,
  onRefresh,
}: {
  round: ReviewRoundDto
  closed: boolean
  canDecide: boolean
  refreshing: boolean
  onRefresh: () => void
}) {
  if (closed) {
    return (
      <Typography role="note" variant="14/regular" color="neutral-700" className="rounded-lg bg-neutral-50 p-3">
        این دور برای اصلاح به شرکت بازگردانده شده است. امتیازهای آن در تاریخچه می‌ماند و در تصمیم بعدی شمرده نمی‌شود؛ پس از ارسال نسخه اصلاحی، دور داوری تازه با چهار ارزیابی جدید لازم است.
      </Typography>
    )
  }
  if (round.decision) return null
  if (!round.completion.ready) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 p-3" data-readiness="waiting">
        <Typography variant="14/regular" color="neutral-700">
          انتقال به مرحله بعد تا نهایی شدن هر چهار ارزیابی در دسترس نیست ({fa(round.completion.finalized)} از {fa(round.completion.required)} نهایی شده).
        </Typography>
        <RefreshButton busy={refreshing} onClick={onRefresh} label="به‌روزرسانی وضعیت" />
      </div>
    )
  }
  return (
    <Typography
      role="status"
      variant="14/regular"
      color="neutral-700"
      className="rounded-lg border border-brand-600 bg-brand-50 p-3"
      data-readiness="ready"
    >
      {canDecide
        ? 'هر چهار ارزیابی نهایی شده است. تصمیم خود را از بخش «اقدام شما» به‌صورت صریح ثبت کنید.'
        : 'هر چهار ارزیابی نهایی شده است و پرونده در انتظار تصمیم صریح سردبیر است.'}
    </Typography>
  )
}

function EvaluationList({ items, people }: { items: EvaluationSummaryDto[]; people: Record<string, string> }) {
  // The employer's evaluation first, then the ordinary reviewers in the order they finished.
  const ordered = [...items].sort((a, b) => (a.variant === b.variant ? 0 : a.variant === 'employer' ? -1 : 1))
  return (
    <ul className="grid min-w-0 gap-3 md:grid-cols-2">
      {ordered.map((item) => (
        <li key={item.id} className="flex min-w-0 flex-col gap-2 rounded-xl border border-neutral-100 bg-neutral-50 p-3" data-evaluation={item.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Typography variant="14/semibold" color="neutral-900" className="break-words">
              {item.variant === 'employer' ? 'ارزیابی کارفرما' : 'ارزیابی داور'}
              {item.userId && people[item.userId] ? ` · ${people[item.userId]}` : ''}
            </Typography>
            <Typography as="span" variant="12/regular" className="rounded-full bg-success-50 px-2 py-0.5 text-success-700">نهایی</Typography>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            <Score label="بخش الف" value={item.scoreA} />
            <Score label="بخش ب" value={item.scoreB} />
            <Score label="بخش ج" value={item.scoreC} />
          </dl>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Typography as="span" variant="12/regular" color="neutral-500">امتیاز وزنی (سرور)</Typography>
            <Typography as="span" variant="16/semibold" color="brand-600">
              {item.weightedHundredths === undefined ? '—' : formatHundredths(item.weightedHundredths)}
            </Typography>
          </div>
          {item.finalizedAt ? (
            <Typography variant="12/regular" color="neutral-500">نهایی‌شده در {formatDate(item.finalizedAt)}</Typography>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function Score({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-background p-2">
      <Typography as="dt" variant="12/regular" color="neutral-500">{label}</Typography>
      <Typography as="dd" variant="14/semibold" color="neutral-800">{value === undefined ? '—' : fa(value)}</Typography>
    </div>
  )
}

function DecisionLine({
  decision,
  people,
}: {
  decision: NonNullable<ReviewRoundDto['decision']>
  people: Record<string, string>
}) {
  const by = decision.decidedBy ? people[decision.decidedBy] : undefined
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-3" data-decision={decision.action}>
      <Typography variant="14/semibold" color="neutral-900">
        تصمیم سردبیر: {DECISION_LABELS[decision.action] ?? decision.action}
      </Typography>
      <Typography variant="12/regular" color="neutral-500">
        {formatDate(decision.decidedAt)}
        {by ? ` · ${by}` : ''}
      </Typography>
      {decision.reason ? (
        <Typography variant="14/regular" color="neutral-700" className="whitespace-pre-wrap break-words">{decision.reason}</Typography>
      ) : null}
    </div>
  )
}

/** Earlier rounds stay readable as history; their scores never count toward the current round. */
function RoundHistory({ history, people }: { history: SummaryPart<ReviewRoundHistoryEntry[]>; people: Record<string, string> }) {
  if (history === null) return null
  if (history === 'denied') return null
  if (history === 'failed') {
    return (
      <Typography role="alert" variant="14/regular" color="error">
        دریافت دورهای پیشین داوری انجام نشد. صفحه را دوباره بارگذاری کنید.
      </Typography>
    )
  }
  if (!history.length) return null
  return (
    <div className="flex min-w-0 flex-col gap-3 border-t border-neutral-100 pt-4" data-testid="round-history">
      <Typography as="h3" variant="16/semibold" color="neutral-900">دورهای پیشین (تاریخچه)</Typography>
      <Typography variant="12/regular" color="neutral-500">
        امتیازهای این دورها فقط برای سابقه نمایش داده می‌شود و در دور جاری شمرده نمی‌شود.
      </Typography>
      <ol className="flex min-w-0 flex-col gap-3">
        {history.map(({ round, evaluations }) => {
          const finals = finalsOf(evaluations)
          return (
            <li key={round.id} className="flex min-w-0 flex-col gap-3 rounded-xl bg-neutral-50 p-3" data-round={round.id}>
              <Typography variant="14/semibold" color="neutral-800">
                دور نسخه {fa(round.requestRevision)} پرونده · نسخه پروپوزال {fa(round.proposalRevision)} · {fa(round.completion.finalized)} از {fa(round.completion.required)} ارزیابی نهایی
              </Typography>
              {round.decision ? <DecisionLine decision={round.decision} people={people} /> : null}
              {evaluations === 'failed' ? (
                <Typography role="alert" variant="14/regular" color="error">دریافت ارزیابی‌های این دور انجام نشد.</Typography>
              ) : finals.length ? (
                <EvaluationList items={finals} people={people} />
              ) : (
                <Typography variant="14/regular" color="neutral-500">ارزیابی نهایی‌شده‌ای در این دور ثبت نشده است.</Typography>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
