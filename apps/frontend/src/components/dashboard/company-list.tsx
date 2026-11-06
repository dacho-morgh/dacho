'use client'
import { startTransition, useCallback, useEffect, useMemo, useOptimistic, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AdminListView,
  AdminRowActions,
  type AdminBulkAction,
  type AdminColumn,
  type AdminListLoadState,
} from '@/components/dashboard/admin-list-view'
import { CompanyBuildingIcon, DashboardTrashIcon, TickCircleIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/utilities/dashboard-api'
import { Typography } from '@/components/ui/typography'
import { CompanyCreateDialog } from '@/components/dashboard/company-create-dialog'
import { ListFilterButton } from '@/components/dashboard/list-filter-button'
import {
  COMPANIES_PAGE_SIZE,
  EMPTY_COUNTS,
  companiesParams,
  companiesQuery,
  toCompaniesPage,
  type CompaniesApiResponse,
  type Company,
  type InitialCompanies,
  type VerificationQueue,
  type VerificationStatus,
} from '@/components/dashboard/company-list-data'

const QUEUES: { id: VerificationQueue; label: string }[] = [
  { id: 'all', label: 'همه' },
  { id: 'pending', label: 'در انتظار بررسی' },
  { id: 'approved', label: 'تأیید شده' },
  { id: 'returned', label: 'برگشت داده شده' },
  { id: 'rejected', label: 'رد شده' },
]

const SEARCH_DEBOUNCE_MS = 300
const PAGE_SIZE = COMPANIES_PAGE_SIZE

type ListState = { companies: Company[]; counts: Record<VerificationQueue, number> }
/** What an action will do to the list once the server agrees; shown before it answers. */
type ListChange =
  | { type: 'approve'; ids: ReadonlySet<string> }
  | { type: 'remove'; ids: ReadonlySet<string> }
  | { type: 'add'; company: Company }

const bump = (counts: ListState['counts'], status: string, by: number): ListState['counts'] =>
  status in counts ? { ...counts, [status]: Math.max(0, counts[status as VerificationQueue] + by) } : counts

/** `queue` is the status filter on screen: a row that stops matching it leaves the list. */
function applyListChange(state: ListState, change: ListChange, queue: VerificationQueue): ListState {
  if (change.type === 'add') {
    return {
      companies: [change.company, ...state.companies].slice(0, PAGE_SIZE),
      counts: bump(state.counts, 'all', 1),
    }
  }
  let counts = state.counts
  const companies: Company[] = []
  for (const company of state.companies) {
    if (!change.ids.has(company.id)) {
      companies.push(company)
      continue
    }
    if (change.type === 'remove') {
      counts = bump(bump(counts, 'all', -1), company.verificationStatus, -1)
      continue
    }
    if (company.verificationStatus === 'approved') {
      companies.push(company)
      continue
    }
    counts = bump(bump(counts, company.verificationStatus, -1), 'approved', 1)
    // Approved, it no longer belongs to another queue.
    if (queue === 'all' || queue === 'approved') companies.push({ ...company, verificationStatus: 'approved' })
  }
  return { companies, counts }
}

function verificationStatusBadge(status: VerificationStatus): {
  label: string
  variant: 'warning' | 'success' | 'amber' | 'error' | 'gray'
} {
  switch (status) {
    case 'pending':
      return { label: 'در انتظار بررسی', variant: 'warning' }
    case 'approved':
      return { label: 'تأیید شده', variant: 'success' }
    case 'returned':
      return { label: 'برگشت داده شده', variant: 'amber' }
    case 'rejected':
      return { label: 'رد شده', variant: 'error' }
    case 'unsubmitted':
    default:
      return { label: 'ارسال نشده', variant: 'gray' }
  }
}

const text = (value: string) => (
  <Typography variant="14/regular" color="secondary" className="max-sm:text-[13px]">
    {value}
  </Typography>
)

/** The company's picture, or its building mark when none was uploaded. */
function CompanyAvatar({ company }: { company: Company }) {
  if (company.logoUrl) {
    return (
      <Image
        src={company.logoUrl}
        alt=""
        width={40}
        height={40}
        // The file route is access-checked by the session cookie, which the image optimizer would not send.
        unoptimized
        className="size-10 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600"
    >
      <CompanyBuildingIcon className="size-5" aria-hidden="true" />
    </span>
  )
}

const baseColumns: AdminColumn<Company>[] = [
  {
    id: 'name',
    header: 'نام شرکت',
    render: (item) => (
      <div className="flex items-center gap-3">
        <CompanyAvatar company={item} />
        {item.optimistic ? (
          text(item.name)
        ) : (
          <Link
            href={`/dashboard/companies/${item.id}`}
            className="min-w-0 truncate rounded-sm focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {text(item.name)}
          </Link>
        )}
      </div>
    ),
  },
  { id: 'submittedAt', header: 'تاریخ ارسال', render: (item) => text(formatDate(item.submittedAt) || '—') },
  {
    id: 'verificationStatus',
    header: 'وضعیت',
    render: (item) => {
      if (item.optimistic) {
        return (
          <Badge variant="gray" size="sm">
            در حال ثبت…
          </Badge>
        )
      }
      const badge = verificationStatusBadge(item.verificationStatus)
      return (
        <div className="flex items-center gap-1.5">
          <Badge variant={badge.variant} size="sm">
            {badge.label}
          </Badge>
          {item.verificationRevision > 0 && (
            <Typography variant="12/regular" color="muted" className="whitespace-nowrap">
              (نسخه {item.verificationRevision.toLocaleString('fa-IR')})
            </Typography>
          )}
        </div>
      )
    },
  },
  { id: 'ceo', header: 'مدیر عامل', render: (item) => text(item.ceo) },
  {
    id: 'type',
    header: 'نوع شرکت',
    render: (item) => (
      <Typography
        variant="14/regular"
        color="brand-600"
        className="inline-block rounded-lg bg-brand-50 px-3 py-1 whitespace-nowrap max-sm:text-[13px]"
      >
        {item.companyType}
      </Typography>
    ),
  },
  { id: 'address', header: 'آدرس', render: (item) => text(item.address) },
  { id: 'activity', header: 'سال فعالیت', render: (item) => text(item.activityAge) },
]

/** The table's columns; the actions popover (the last column) lists what this viewer may do to a row. */
function buildColumns(canRemoveCompany: boolean): AdminColumn<Company>[] {
  return [
    ...baseColumns,
    {
      id: 'actions',
      header: 'عملیات',
      render: (item, { runAction }) =>
        item.optimistic ? null : (
        <AdminRowActions
          viewHref={`/dashboard/companies/${item.id}`}
          viewLabel={item.verificationStatus === 'pending' ? 'بررسی' : 'مشاهده'}
          actions={[
            ...(approveAction.appliesTo?.(item)
              ? [{
                  id: approveAction.id,
                  label: approveAction.label,
                  icon: <TickCircleIcon aria-hidden="true" className="size-5" />,
                  onSelect: () => runAction(approveAction.id, item),
                }]
              : []),
            ...(canRemoveCompany
              ? [{
                  id: removeAction.id,
                  label: 'حذف شرکت',
                  icon: <DashboardTrashIcon aria-hidden="true" className="size-5" />,
                  destructive: true,
                  onSelect: () => runAction(removeAction.id, item),
                }]
              : []),
          ]}
        />
        ),
    },
  ]
}

const faNumber = (value: number) => value.toLocaleString('fa-IR')

/** Approves each pending company through the same command as its dossier page. */
async function approveCompanies(items: Company[]) {
  const results = await Promise.allSettled(
    items.map(async (item) => {
      const response = await fetch(
        `/api/dashboard/admin/companies/${encodeURIComponent(item.id)}/verification/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve', expectedRevision: item.verificationRevision }),
        },
      )
      if (!response.ok) throw new Error(String(response.status))
    }),
  )
  const done = results.filter((result) => result.status === 'fulfilled').length
  return { done, failed: results.length - done }
}

/** «حذف شرکت» deactivates the representative's account, as «حذف کارمند» does: nothing is erased. */
async function deactivateCompanies(items: Company[]) {
  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (!item.updatedAt) throw new Error('missing_version')
      const response = await fetch(`/api/users/personnel/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedUpdatedAt: item.updatedAt, isActive: false }),
      })
      if (!response.ok) throw new Error(String(response.status))
    }),
  )
  const done = results.filter((result) => result.status === 'fulfilled').length
  return { done, failed: results.length - done }
}

const approveAction: AdminBulkAction<Company> = {
  id: 'approve',
  label: 'تأیید احراز هویت',
  icon: <TickCircleIcon aria-hidden="true" />,
  appliesTo: (item) => item.verificationStatus === 'pending',
  title: 'تأیید احراز هویت',
  describe: (count, skipped) =>
    `احراز هویت ${faNumber(count)} شرکت تأیید می‌شود و این شرکت‌ها می‌توانند درخواست ثبت کنند.` +
    (skipped > 0 ? ` ${faNumber(skipped)} شرکت انتخاب‌شده در انتظار بررسی نیست و نادیده گرفته می‌شود.` : ''),
  confirmLabel: 'تأیید',
  run: approveCompanies,
}

const removeAction: AdminBulkAction<Company> = {
  id: 'remove',
  label: 'حذف شرکت‌ها',
  icon: <DashboardTrashIcon aria-hidden="true" />,
  destructive: true,
  title: 'حذف شرکت‌ها',
  describe: (count) =>
    `حساب نماینده ${faNumber(count)} شرکت غیرفعال می‌شود و شرکت از این فهرست خارج می‌شود. نماینده دیگر نمی‌تواند وارد سامانه شود؛ سوابق و درخواست‌ها حذف نمی‌شود.`,
  confirmLabel: 'حذف شرکت‌ها',
  run: deactivateCompanies,
}

/**
 * The page, queue and search live in the URL (`page`, `status`, `search`), so back, refresh and
 * sharing reopen the same view; the API pages, filters and searches.
 * `canCreateCompany`: the System Owner sees «شرکت جدید» (FE34); Secretariat only reviews.
 * `canRemoveCompany`: only the owner may deactivate company accounts.
 */
export function CompanyList({
  canCreateCompany = false,
  canRemoveCompany = false,
  initial,
}: {
  canCreateCompany?: boolean
  canRemoveCompany?: boolean
  /** The first page, read by the server, so the table opens with its rows. */
  initial?: InitialCompanies
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { status, page: requestedPage, search: urlSearch } = companiesParams({
    status: searchParams?.get('status'),
    page: searchParams?.get('page'),
    search: searchParams?.get('search'),
  })
  const query = companiesQuery({ status, page: requestedPage, search: urlSearch })

  const [companies, setCompanies] = useState<Company[]>(initial?.companies ?? [])
  const [page, setPage] = useState(initial?.page ?? 1)
  const [totalPages, setTotalPages] = useState(initial?.totalPages ?? 1)
  const [counts, setCounts] = useState(initial?.counts ?? EMPTY_COUNTS)
  const [loadState, setLoadState] = useState<AdminListLoadState>(initial ? 'ready' : 'loading')
  // Approve, delete and create show their outcome at once; the screen returns to the server's rows
  // (with the same change if it succeeded, without it if it failed) when the transition ends.
  const listState = useMemo<ListState>(() => ({ companies, counts }), [companies, counts])
  const [shown, applyChange] = useOptimistic(listState, (state, change: ListChange) =>
    applyListChange(state, change, status),
  )
  // Rows stay on screen (dimmed) while the next page loads, so the table does not collapse and jump.
  const [refreshing, setRefreshing] = useState(false)
  const [searchText, setSearchText] = useState(urlSearch)
  const latestLoad = useRef(0)
  const lastWrittenSearch = useRef(urlSearch)
  const hasRows = useRef(Boolean(initial))
  // The server already answered the first query.
  const serverAnswered = useRef(initial?.key)

  const writeUrl = useCallback(
    (changes: Record<string, string | undefined>, mode: 'push' | 'replace' = 'push') => {
      const next = new URLSearchParams(searchParams?.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      const query = next.toString()
      router[mode](query ? `${pathname}?${query}` : pathname)
    },
    [pathname, router, searchParams],
  )

  // `silent`: a reload after an action, which keeps the table as it is (no dimming) until the rows arrive.
  const loadCompanies = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const load = ++latestLoad.current
    if (!silent) {
      if (hasRows.current) setRefreshing(true)
      else setLoadState('loading')
    }
    try {
      const response = await fetch(`/api/dashboard/admin/companies?${query}`, { cache: 'no-store' })
      // A slower answer to an earlier page must not replace the current one.
      if (load !== latestLoad.current) return
      const fail = (state: AdminListLoadState) => {
        hasRows.current = false
        setRefreshing(false)
        setLoadState(state)
      }
      if (response.status === 401) return fail('unauthenticated')
      if (response.status === 403) return fail('denied')
      if (!response.ok) return fail('error')
      const next = toCompaniesPage((await response.json()) as CompaniesApiResponse, requestedPage)
      if (load !== latestLoad.current) return
      if (!next) return fail('error')
      hasRows.current = true
      // In a transition, so the real rows land together with the end of an action's optimistic state.
      startTransition(() => {
        setCompanies(next.companies)
        setPage(next.page)
        setTotalPages(next.totalPages)
        setCounts(next.counts)
        setRefreshing(false)
        setLoadState('ready')
      })
    } catch {
      if (load !== latestLoad.current) return
      hasRows.current = false
      setRefreshing(false)
      setLoadState('error')
    }
  }, [query, requestedPage])

  useEffect(() => {
    // The first render already holds the server's answer to this very query.
    if (serverAnswered.current === query) {
      serverAnswered.current = undefined
      return
    }
    void loadCompanies()
  }, [loadCompanies, query])

  // Typing waits for a pause before it reaches the URL (and so the API), and starts again from page 1.
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

  const filter = (
    <ListFilterButton
      label="فیلتر شرکت‌ها"
      groups={[
        {
          key: 'status',
          label: 'وضعیت احراز',
          value: status === 'all' ? undefined : status,
          options: QUEUES.map((q) => ({ value: q.id === 'all' ? '' : q.id, label: q.label, count: shown.counts[q.id] })),
        },
      ]}
    />
  )

  const bulkActions = useMemo(() => {
    const idsOf = (items: Company[]) => new Set(items.map((item) => item.id))
    return [
      { ...approveAction, optimistic: (items: Company[]) => applyChange({ type: 'approve', ids: idsOf(items) }) },
      ...(canRemoveCompany
        ? [{ ...removeAction, optimistic: (items: Company[]) => applyChange({ type: 'remove', ids: idsOf(items) }) }]
        : []),
    ]
  }, [applyChange, canRemoveCompany])
  const columns = useMemo(() => buildColumns(canRemoveCompany), [canRemoveCompany])

  return (
    <AdminListView
      title="احراز هویت شرکت‌ها"
      notice={
        loadState === 'ready' && shown.counts.pending > 0 ? (
          <div role="status" className="flex flex-col gap-1 rounded-2xl bg-brand-50 p-4 text-brand-700">
            <Typography variant="16/semibold" className="text-inherit max-sm:text-sm">
              {shown.counts.pending.toLocaleString('fa-IR')} شرکت در انتظار بررسی
            </Typography>
            <Typography variant="14/regular" className="text-inherit max-sm:text-xs">
              پس از تایید احراز هویت، شرکت می‌تواند درخواست ثبت کند.
            </Typography>
          </div>
        ) : undefined
      }
      addAction={
        canCreateCompany ? (
          <CompanyCreateDialog
            onOptimisticCreate={(draft) => {
              // The new company is unsubmitted, so it belongs on the first page of the unfiltered list.
              if (page !== 1 || status !== 'all' || urlSearch) return
              applyChange({
                type: 'add',
                company: {
                  id: `optimistic-${draft.phone}`,
                  name: draft.companyName,
                  logoUrl: null,
                  ceo: draft.name,
                  companyType: draft.companyType || '—',
                  address: '—',
                  activityAge: '—',
                  verificationStatus: 'unsubmitted',
                  verificationRevision: 0,
                  submittedAt: null,
                  updatedAt: null,
                  optimistic: true,
                },
              })
            }}
            onCreated={() => loadCompanies({ silent: true })}
          />
        ) : undefined
      }
      searchPlaceholder="جستجوی شرکت"
      items={shown.companies}
      isSelectable={(item) => !item.optimistic}
      getSearchText={() => ''}
      query={searchText}
      onQueryChange={setSearchText}
      pagination={{
        page,
        totalPages,
        onPageChange: (next) => writeUrl({ page: next > 1 ? String(next) : undefined }),
      }}
      bulkActions={bulkActions}
      getKey={(item) => item.id}
      columns={columns}
      loadState={loadState}
      refreshing={refreshing}
      filter={filter}
      onRetry={() => loadCompanies({ silent: true })}
    />
  )
}
