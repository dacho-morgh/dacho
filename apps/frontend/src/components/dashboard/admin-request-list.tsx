'use client'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AdminListView,
  AdminRowActions,
  type AdminColumn,
  type AdminListLoadState,
} from '@/components/dashboard/admin-list-view'
import {
  adminRequestsQuery,
  toAdminRequestsPage,
  type AdminRequestRow,
  type AdminRequestsApiResponse,
  type AdminRequestsPage,
  type InitialAdminRequests,
} from '@/components/dashboard/admin-request-list-data'
import { CompanyAvatar } from '@/components/dashboard/company-avatar'
import { ListFilterButton } from '@/components/dashboard/list-filter-button'
import { RowActions } from '@/components/dashboard/list-row-actions'
import { ReferRequestDialog } from '@/components/dashboard/refer-request-dialog'
import { RequestDecisionDialog, REVIEW_DECISION, TRIAGE, type Decision } from '@/components/dashboard/request-actions-panel'
import {
  REQUEST_STATUS_FILTER_OPTIONS,
  REVIEW_STAGE_OPTIONS,
  type RequestQueueFilters,
  type RequestStatus,
} from '@/components/dashboard/requests/types'
import { workQueueLabel } from '@/components/dashboard/work-queue-overview'
import { BackSquareIcon, CompanyBuildingIcon, DashboardCloseCircle, DashboardEditIcon, SendIcon } from '@/components/icons'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Typography } from '@/components/ui/typography'
import { formatDate } from '@/utilities/dashboard-api'

const SEARCH_DEBOUNCE_MS = 300

const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'پیش‌نویس',
  in_review: 'درحال بررسی',
  action_needed: 'نیازمند اقدام',
  approved: 'تایید شده',
  rejected: 'رد شده',
}

const STATUS_VARIANT: Record<RequestStatus, BadgeProps['variant']> = {
  draft: 'gray',
  in_review: 'primary',
  action_needed: 'yellow',
  approved: 'green',
  rejected: 'red',
}

/**
 * The status tag of a row (Figma 31885:20135): a case in review reads by where the review stands, since
 * that is what the people who run it look for; every other status keeps its own tag.
 */
function statusTag(item: AdminRequestRow): { label: string; variant: BadgeProps['variant'] } {
  if (item.status === 'in_review') {
    if (item.reviewStage === 'chief_triage') return { label: 'ارجاع نشده', variant: 'gray' }
    // The four evaluations are in and the chief's decision is what waits.
    if (item.reviewStage === 'triaged') {
      return item.allowedActions?.includes('decideReview')
        ? { label: 'بررسی شده', variant: 'green' }
        : { label: 'درحال بررسی', variant: 'primary' }
    }
    if (item.reviewStage === 'advanced') return { label: 'تکمیل شده', variant: 'black' }
  }
  // A case sent back to the company is being corrected.
  if (item.status === 'action_needed') return { label: 'درحال اصلاح', variant: 'yellow' }
  return { label: STATUS_LABELS[item.status] ?? item.status, variant: STATUS_VARIANT[item.status] ?? 'gray' }
}

/** What a row's menu command does: open the referral dialog, or one of the shared decision dialogs. */
type RowCommand = { kind: 'refer' } | { kind: 'decision'; decision: Decision }

/**
 * The row menu's three commands in the design's order (Figma 31885:20135): «ارجاع», «درخواست اصلاحیه», «رد درخواست».
 * In triage «ارجاع» assigns the reviewers; after the review it moves the case on to the financial stage.
 */
function rowMenu(item: AdminRequestRow): { label: string; icon: React.ReactNode; destructive?: boolean; command: RowCommand }[] | null {
  const icons = {
    send: <SendIcon aria-hidden="true" className="size-5" />,
    back: <BackSquareIcon aria-hidden="true" className="size-5" />,
    close: <DashboardCloseCircle aria-hidden="true" className="size-5" />,
  }
  if (item.allowedActions?.includes('triage')) {
    return [
      { label: 'ارجاع', icon: icons.send, command: { kind: 'refer' } },
      { label: 'درخواست اصلاحیه', icon: icons.back, command: { kind: 'decision', decision: TRIAGE[1]! } },
      { label: 'رد درخواست', icon: icons.close, destructive: true, command: { kind: 'decision', decision: TRIAGE[2]! } },
    ]
  }
  if (item.allowedActions?.includes('decideReview')) {
    return [
      { label: 'ارجاع', icon: icons.send, command: { kind: 'decision', decision: REVIEW_DECISION[0]! } },
      { label: 'درخواست اصلاحیه', icon: icons.back, command: { kind: 'decision', decision: REVIEW_DECISION[1]! } },
      { label: 'رد درخواست', icon: icons.close, destructive: true, command: { kind: 'decision', decision: REVIEW_DECISION[2]! } },
    ]
  }
  return null
}

/** The tag of a case the Secretariat follows up (its investment memo was sent). */
const FOLLOW_UP_LABEL = 'پیگیری سرمایه‌گذاری'

const text = (value: string) => (
  <Typography variant="14/regular" color="secondary" className="max-sm:text-[13px]">
    {value}
  </Typography>
)

const companyHref = (companyId: string) => `/dashboard/companies/${encodeURIComponent(companyId)}`

/**
 * `canViewCompany`: the company's name and the company actions lead to its dossier, which only the
 * owner and Secretariat may read; every other role sees the name as text.
 */
function buildColumns(
  canViewCompany: boolean,
  onCommand: (item: AdminRequestRow, command: RowCommand) => void,
): AdminColumn<AdminRequestRow>[] {
  return [
    {
      id: 'company',
      header: 'نام شرکت',
      render: (item) => (
        <div className="flex items-center gap-3">
          <CompanyAvatar logoUrl={item.logoUrl} />
          {canViewCompany && item.companyId ? (
            <Link
              href={companyHref(item.companyId)}
              className="min-w-0 truncate rounded-sm focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              {text(item.company)}
            </Link>
          ) : (
            text(item.company)
          )}
        </div>
      ),
    },
    {
      id: 'request',
      header: 'عنوان درخواست',
      render: (item) => (
        <Link
          href={`/dashboard/requests/${encodeURIComponent(item.id)}`}
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          {text(item.title)}
        </Link>
      ),
    },
    {
      id: 'status',
      header: 'وضعیت',
      render: (item) => {
        const tag = statusTag(item)
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge variant={tag.variant} size="sm">
              {tag.label}
            </Badge>
            {item.followUp ? (
              <Badge variant="brand-solid" size="sm">
                {FOLLOW_UP_LABEL}
              </Badge>
            ) : null}
          </span>
        )
      },
    },
    { id: 'due', header: 'تاریخ سررسید', render: (item) => text(formatDate(item.dueDate) || '—') },
    { id: 'date', header: 'تاریخ ثبت', render: (item) => text(formatDate(item.createdAt) || '—') },
    {
      id: 'actions',
      render: (item) => {
        const menu = rowMenu(item)
        return menu ? (
          <RowActions
            actions={menu.map(({ label, icon, destructive, command }) => ({
              id: label,
              label,
              icon,
              destructive,
              onSelect: () => onCommand(item, command),
            }))}
          />
        ) : (
          <AdminRowActions
          viewHref={`/dashboard/requests/${encodeURIComponent(item.id)}`}
          viewLabel="مشاهده درخواست"
          actions={
            canViewCompany && item.companyId
              ? [
                  {
                    id: 'company',
                    label: 'مشاهده شرکت',
                    icon: <CompanyBuildingIcon aria-hidden="true" className="size-5" />,
                    href: companyHref(item.companyId),
                  },
                  ...(item.canEvaluate
                    ? [
                        {
                          id: 'evaluate',
                          label: 'ارزیابی درخواست',
                          icon: <DashboardEditIcon aria-hidden="true" className="size-5" />,
                          href: `${companyHref(item.companyId)}/requests/${encodeURIComponent(item.id)}/evaluation`,
                        },
                      ]
                    : []),
                ]
              : []
          }
        />
        )
      },
    },
  ]
}

/**
 * The page, status, filters and search live in the URL, so back, refresh and sharing reopen the
 * same view. The server page reads the rows for that URL (`initial`) and the table shows them at
 * once; the table fetches only when the server did not (or its read failed). While the next
 * page is on its way the rows stay on screen, dimmed.
 */
export function AdminRequestList({
  status,
  page = 1,
  filters = {},
  counts,
  events = [],
  canViewCompany = false,
  canFollowUp = false,
  initial,
}: {
  status?: RequestStatus
  page?: number
  filters?: RequestQueueFilters
  /** From `GET /stats` with the same filters, so each number is the size of the list it opens. */
  counts?: Partial<Record<RequestStatus | 'all', number>>
  events?: { id: string; title: string }[]
  canViewCompany?: boolean
  /** The Secretariat and the owner may narrow the list to the follow-up cases. */
  canFollowUp?: boolean
  /** The rows the server read for the query on screen, so the table opens with them. */
  initial?: InitialAdminRequests
} = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isNavigating, startNavigation] = useTransition()
  const query = adminRequestsQuery(status, page, filters)
  const urlSearch = filters.search ?? ''

  // The API answer to a query the server did not read for us.
  const [fetched, setFetched] = useState<{ key: string; page: AdminRequestsPage } | null>(null)
  const [failure, setFailure] = useState<{ key: string; state: AdminListLoadState } | null>(null)
  const [retries, setRetries] = useState(0)
  const [searchText, setSearchText] = useState(urlSearch)
  const lastWrittenSearch = useRef(urlSearch)

  const answer = initial?.key === query ? initial : fetched?.key === query ? fetched.page : undefined
  // The rows of the last answer stay while the next one loads.
  const shown = answer ?? fetched?.page ?? initial
  const failed = failure?.key === query ? failure.state : undefined
  const loadState: AdminListLoadState = failed ?? (shown ? 'ready' : 'loading')
  const refreshing = !failed && (isNavigating || (!answer && Boolean(shown)))
  const needsFetch = !answer

  useEffect(() => {
    if (!needsFetch) return
    let current = true
    const fail = (state: AdminListLoadState) => current && setFailure({ key: query, state })
    ;(async () => {
      try {
        const response = await fetch(`/api/dashboard/admin/requests?${query}`, { cache: 'no-store' })
        if (response.status === 401) return fail('unauthenticated')
        if (response.status === 403) return fail('denied')
        if (!response.ok) return fail('error')
        const next = toAdminRequestsPage((await response.json()) as AdminRequestsApiResponse, page)
        if (!next) return fail('error')
        if (!current) return
        setFailure(null)
        setFetched({ key: query, page: next })
      } catch {
        fail('error')
      }
    })()
    return () => {
      current = false
    }
    // A retry asks again for the same query.
  }, [needsFetch, query, page, retries])

  const writeUrl = useCallback(
    (changes: Record<string, string | undefined>, mode: 'push' | 'replace' = 'push') => {
      const next = new URLSearchParams(searchParams?.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      const nextQuery = next.toString()
      startNavigation(() => router[mode](nextQuery ? `${pathname}?${nextQuery}` : pathname))
    },
    [pathname, router, searchParams],
  )

  // Typing waits for a pause before it reaches the URL (and so the server), and starts again from page 1.
  useEffect(() => {
    if (searchText.trim() === urlSearch.trim()) return
    const timer = setTimeout(() => {
      lastWrittenSearch.current = searchText
      writeUrl({ search: searchText.trim() || undefined, page: undefined }, 'replace')
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchText, urlSearch, writeUrl])

  // Back and forward change the URL without typing: show the search it holds.
  useEffect(() => {
    if (urlSearch !== lastWrittenSearch.current) {
      lastWrittenSearch.current = urlSearch
      setSearchText(urlSearch)
    }
  }, [urlSearch])

  const [command, setCommand] = useState<{ item: AdminRequestRow; command: RowCommand } | null>(null)
  const columns = useMemo(
    () => buildColumns(canViewCompany, (item, next) => setCommand({ item, command: next })),
    [canViewCompany],
  )
  const queueLabel = filters.queue ? workQueueLabel(filters.queue) : undefined

  return (
    <>
    <AdminListView
      title="درخواست ها"
      notice={
        queueLabel || filters.followUp ? (
          <Typography variant="14/regular" color="secondary">
            {queueLabel ? `صف: ${queueLabel}` : `${FOLLOW_UP_LABEL}: پرونده‌هایی که یادداشت سرمایه‌گذاری آن‌ها به دبیرخانه رسیده است`}
          </Typography>
        ) : undefined
      }
      searchPlaceholder="جستجوی عنوان یا کد پیگیری"
      items={shown?.requests ?? []}
      getSearchText={() => ''}
      query={searchText}
      onQueryChange={setSearchText}
      pagination={{
        page: shown?.page ?? page,
        totalPages: shown?.totalPages ?? 1,
        onPageChange: (next) => writeUrl({ page: next > 1 ? String(next) : undefined }),
      }}
      getKey={(item) => item.id}
      getRowHref={(item) => `/dashboard/requests/${encodeURIComponent(item.id)}`}
      columns={columns}
      loadState={loadState}
      refreshing={refreshing}
      filter={
        <ListFilterButton
          label="فیلتر درخواست‌ها"
          onChange={(key, value) => writeUrl({ [key]: value, page: undefined })}
          groups={[
            {
              key: 'status',
              label: 'وضعیت',
              value: status,
              options: REQUEST_STATUS_FILTER_OPTIONS.map((option) => ({
                value: option.value === 'all' ? '' : option.value,
                label: option.label,
                count: counts?.[option.value],
              })),
            },
            {
              key: 'eventId',
              label: 'رویداد',
              value: filters.eventId,
              options: [
                { value: '', label: 'همه رویدادها' },
                ...events.map((event) => ({ value: event.id, label: event.title })),
              ],
            },
            {
              key: 'stage',
              label: 'مرحله',
              value: filters.stage,
              options: [{ value: '', label: 'همه مرحله‌ها' }, ...REVIEW_STAGE_OPTIONS],
            },
            ...(canFollowUp
              ? [
                  {
                    key: 'followUp',
                    label: FOLLOW_UP_LABEL,
                    value: filters.followUp ? '1' : undefined,
                    options: [
                      { value: '', label: 'همه درخواست‌ها' },
                      { value: '1', label: 'فقط پرونده‌های پیگیری سرمایه‌گذاری' },
                    ],
                  },
                ]
              : []),
          ]}
        />
      }
      onRetry={() => {
        setFailure(null)
        setRetries((count) => count + 1)
      }}
    />
    {command?.command.kind === 'refer' ? (
      <ReferRequestDialog id={command.item.id} revision={command.item.revision} onClose={() => setCommand(null)} />
    ) : command?.command.kind === 'decision' ? (
      <RequestDecisionDialog
        id={command.item.id}
        revision={command.item.revision}
        decision={command.command.decision}
        available={Boolean(command.item.allowedActions?.includes(command.command.decision.gate))}
        onClose={() => setCommand(null)}
      />
    ) : null}
    </>
  )
}
