'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import { getLoginUrl } from '@/utilities/auth-return-url'
import { formatDate } from '@/utilities/dashboard-api'
import {
  ownEvaluationLabel,
  REVIEW_QUEUE_VIEWS,
  REVIEW_WORK_STATE_LABELS,
  reviewerRoleLabel,
  reviewQueueHref,
  reviewWorkState,
  type ReviewQueueDto,
  type ReviewQueueItemDto,
  type ReviewQueueView,
  type ReviewWorkState,
} from '@/utilities/reviewer-case'

import { useRevalidateOnFocus } from './use-revalidate'
import { ListFilterButton } from '@/components/dashboard/list-filter-button'
import { ScrollArea } from '@/components/ui/scroll-area'

export type ReviewerQueueState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: ReviewQueueDto }
  | { kind: 'expired' }
  | { kind: 'denied' }
  | { kind: 'error' }

const PAGE_SIZE = 25

const WORK_STATE_STYLE: Record<ReviewWorkState, { color: 'brand-600' | 'secondary' | 'neutral-600'; bg: string }> = {
  open: { color: 'brand-600', bg: 'bg-brand-50' },
  superseded: { color: 'secondary', bg: 'bg-warning-50' },
  closed: { color: 'neutral-600', bg: 'bg-neutral-100' },
}

export interface ReviewerQueueProps {
  view: ReviewQueueView
  page: number
}

/**
 * The reviewer's or employer's own queue. Rows come only from `GET /review/queue`,
 * which reads the caller's active assignments on the server; the browser adds no
 * scope of its own. A refresh on focus drops a case whose assignment ended while
 * the page was open, and a 401/403 clears the list instead of keeping it on screen.
 * Callers key it by view and page so each list starts from its loading state.
 */
export function ReviewerQueue({ view, page }: ReviewerQueueProps) {
  const [state, setState] = useState<ReviewerQueueState>({ kind: 'loading' })
  const latest = useRef(0)

  // `initial` starts from the loading state the component mounts with; a retry shows it again.
  const load = useCallback(
    async (mode: 'initial' | 'retry' | 'silent') => {
      const silent = mode === 'silent'
      const request = ++latest.current
      if (mode === 'retry') setState({ kind: 'loading' })
      let next: ReviewerQueueState
      try {
        const response = await fetch(`/api/dashboard/review/queue?view=${view}&page=${page}&limit=${PAGE_SIZE}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        if (response.status === 401) next = { kind: 'expired' }
        else if (response.status === 403) next = { kind: 'denied' }
        else if (!response.ok) next = { kind: 'error' }
        else next = { kind: 'ready', data: (await response.json()) as ReviewQueueDto }
      } catch {
        next = { kind: 'error' }
      }
      // A slower answer to an earlier tab must not replace the current one.
      if (request !== latest.current) return
      setState((current) =>
        // A failed background refresh keeps the rows the server last authorized;
        // a lost session or role always clears them.
        silent && next.kind === 'error' && current.kind === 'ready' ? current : next,
      )
    },
    [view, page],
  )

  useEffect(() => {
    // The first read only sets state after the response arrives (the mount state is `loading`).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load('initial')
  }, [load])
  useRevalidateOnFocus(() => void load('silent'))

  const counts = state.kind === 'ready' ? state.data.counts : undefined

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 px-4 pt-6 pb-6 lg:pt-10" dir="rtl">
      <div className="flex flex-col gap-1">
        <Typography as="h1" variant="h3" color="neutral-900">
          پرونده‌های ارجاع‌شده به شما
        </Typography>
        <Typography variant="14/regular" color="neutral-500">
          فقط پرونده‌هایی که به شما ارجاع شده‌اند نمایش داده می‌شوند.
        </Typography>
      </div>

      <div className="flex justify-end">
        {/* The default view (awaiting evaluation) is the unfiltered state of the shared filter (FE35). */}
        <ListFilterButton
          label="فیلتر پرونده‌های داوری"
          groups={[
            {
              key: 'view',
              label: 'نمای صف',
              value: view === 'open' ? undefined : view,
              options: REVIEW_QUEUE_VIEWS.map((option) => ({
                value: option.value === 'open' ? '' : option.value,
                label: option.label,
                count: counts?.[option.value],
              })),
            },
          ]}
        />
      </div>

      {/* Title and filter stay put; only the queue scrolls (FE36). */}
      <ScrollArea className="min-h-0 flex-1">
        <QueueBody state={state} view={view} page={page} onRetry={() => void load('retry')} />
      </ScrollArea>
    </main>
  )
}

function QueueBody({
  state,
  view,
  page,
  onRetry,
}: {
  state: ReviewerQueueState
  view: ReviewQueueView
  page: number
  onRetry: () => void
}) {
  if (state.kind === 'loading') {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-background p-4">
        <Typography as="span" role="status" aria-live="polite" variant="14/regular" className="sr-only">
          در حال دریافت پرونده‌ها
        </Typography>
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} aria-hidden="true" className="h-10 w-full rounded-lg bg-neutral-100 motion-reduce:animate-none" />
        ))}
      </div>
    )
  }
  if (state.kind === 'expired') {
    return (
      <Notice title="نشست شما پایان یافته است" body="برای دیدن پرونده‌های خود دوباره وارد شوید.">
        <Button asChild size="36">
          <Link href={getLoginUrl(reviewQueueHref(view, page), { expired: true })}>
            <Typography as="span" variant="14/regular" className="text-inherit">ورود دوباره</Typography>
          </Link>
        </Button>
      </Notice>
    )
  }
  if (state.kind === 'denied') {
    return (
      <Notice
        title="دسترسی به صف داوری مجاز نیست"
        body="این صف فقط برای داوران و کارفرمایان منتسب است. اگر نقش شما تغییر کرده، دوباره وارد شوید."
      >
        <Button asChild size="36" variant="outline-gray">
          <Link href="/dashboard">
            <Typography as="span" variant="14/regular" className="text-inherit">بازگشت به پیشخوان</Typography>
          </Link>
        </Button>
      </Notice>
    )
  }
  if (state.kind === 'error') {
    return (
      <Notice title="دریافت پرونده‌ها انجام نشد" body="ارتباط با سرویس برقرار نشد. دوباره تلاش کنید.">
        <Button size="36" variant="outline-gray" onClick={onRetry}>
          <Typography as="span" variant="14/regular" className="text-inherit">تلاش دوباره</Typography>
        </Button>
      </Notice>
    )
  }

  const { items, totalPages } = state.data
  if (!items.length) {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-background p-6 text-center">
        <Typography variant="16/regular" color="neutral-700">
          {view === 'open' ? 'پرونده‌ای در انتظار ارزیابی شما نیست.' : 'پرونده‌ای در این بخش وجود ندارد.'}
        </Typography>
        <Typography variant="14/regular" color="neutral-500">
          پرونده‌ها پس از ارجاع توسط سردبیر اینجا نمایش داده می‌شوند.
        </Typography>
      </div>
    )
  }

  return (
    <>
      {/* Phone: one card per case. */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label="پرونده‌ها">
        {items.map((item) => (
          <li key={item.requestId}>
            <QueueCard item={item} />
          </li>
        ))}
      </ul>
      {/* Tablet and up: the Figma table. */}
      <div className="hidden min-w-0 rounded-xl border border-neutral-200 bg-background md:block">
        <table className="w-full table-fixed border-collapse">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="h-11 border-b border-neutral-200">
              {['نام شرکت', 'عنوان درخواست', 'رویداد', 'وضعیت', 'ارزیابی شما', 'تاریخ ارجاع'].map((header) => (
                <th key={header} scope="col" className="px-4 text-right">
                  <Typography variant="14/semibold" color="secondary">{header}</Typography>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.requestId} className="h-[72px] border-b border-neutral-100 last:border-0">
                <td className="px-4">
                  <Link href={`/dashboard/requests/${encodeURIComponent(item.requestId)}`} className="block truncate hover:underline">
                    <Typography as="span" variant="14/regular" color="neutral-800">{item.companyName ?? '—'}</Typography>
                  </Link>
                </td>
                <td className="px-4">
                  <Typography variant="14/regular" color="secondary" className="truncate">{item.title}</Typography>
                  <Typography variant="12/regular" color="neutral-400" className="font-mono">{item.trackingCode}</Typography>
                </td>
                <td className="px-4">
                  <Typography variant="14/regular" color="secondary" className="truncate">{eventText(item)}</Typography>
                </td>
                <td className="px-4"><WorkStateBadge item={item} /></td>
                <td className="px-4">
                  <Typography variant="14/regular" color="secondary">{ownEvaluationLabel(item.evaluation)}</Typography>
                </td>
                <td className="px-4">
                  <Typography variant="14/regular" color="secondary">{formatDate(item.assignment.assignedAt)}</Typography>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <nav aria-label="صفحه‌بندی" className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Button asChild size="36" variant="outline-gray">
              <Link href={reviewQueueHref(view, page - 1)}>
                <Typography as="span" variant="14/regular" className="text-inherit">صفحه قبل</Typography>
              </Link>
            </Button>
          ) : null}
          <Typography variant="14/regular" color="neutral-600">
            صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
          </Typography>
          {page < totalPages ? (
            <Button asChild size="36" variant="outline-gray">
              <Link href={reviewQueueHref(view, page + 1)}>
                <Typography as="span" variant="14/regular" className="text-inherit">صفحه بعد</Typography>
              </Link>
            </Button>
          ) : null}
        </nav>
      ) : null}
    </>
  )
}

function QueueCard({ item }: { item: ReviewQueueItemDto }) {
  return (
    <Link
      href={`/dashboard/requests/${encodeURIComponent(item.requestId)}`}
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-neutral-200 bg-background p-4 focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <Typography variant="14/semibold" color="neutral-900" className="min-w-0 break-words">{item.title}</Typography>
        <WorkStateBadge item={item} />
      </div>
      <Typography variant="12/regular" color="neutral-500" className="break-words">
        {item.companyName ?? '—'} · {eventText(item)}
      </Typography>
      <Typography variant="12/regular" color="neutral-500">
        {reviewerRoleLabel(item)} · {ownEvaluationLabel(item.evaluation)} · {formatDate(item.assignment.assignedAt)}
      </Typography>
    </Link>
  )
}

function WorkStateBadge({ item }: { item: ReviewQueueItemDto }) {
  const work = reviewWorkState(item)
  const style = WORK_STATE_STYLE[work]
  return (
    <Typography
      as="span"
      variant="12/regular"
      color={style.color}
      data-state={work}
      className={`inline-block shrink-0 rounded-lg px-2 py-1 ${style.bg}`}
    >
      {work === 'open' ? 'در انتظار ارزیابی' : work === 'superseded' ? 'نسخه جدیدتر' : 'بسته‌شده'}
      <span className="sr-only"> — {REVIEW_WORK_STATE_LABELS[work]}</span>
    </Typography>
  )
}

function eventText(item: ReviewQueueItemDto): string {
  if (!item.event) return '—'
  return item.subtopic ? `${item.event.title} · ${item.subtopic.title}` : item.event.title
}

function Notice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <section role="alert" className="flex flex-col items-start gap-2 rounded-xl border border-warning-500 bg-warning-50 p-4">
      <Typography as="h2" variant="14/semibold" color="neutral-700">{title}</Typography>
      <Typography variant="12/regular" color="neutral-600">{body}</Typography>
      {children}
    </section>
  )
}
