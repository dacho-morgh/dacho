'use client'
import { SearchField } from '@/components/dashboard/search-field'
import { ListRow, ListTableFrame } from '@/components/dashboard/list-table'
import { ListToolbar } from '@/components/dashboard/list-toolbar'
import { RowActions } from '@/components/dashboard/list-row-actions'
import { startTransition, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { DecisionDialog } from '@/components/dashboard/decision-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Typography } from '@/components/ui/typography'
import { BulkActionButtons } from '@/components/dashboard/bulk-action-buttons'
import { DashboardEyeIcon } from '@/components/icons'
import { getLoginUrl } from '@/utilities/auth-return-url'
/** What a cell may ask of the list: run one of its `bulkActions` on this row alone (after the confirmation). */
export type AdminRowHelpers<T> = { runAction: (actionId: string, item: T) => void }
export type AdminColumn<T> = {
  id: string
  header?: string
  render: (item: T, helpers: AdminRowHelpers<T>) => React.ReactNode
}
export type AdminListLoadState = 'loading' | 'ready' | 'unauthenticated' | 'denied' | 'error'
/** One action applied to every selected row (the table gains a checkbox column). */
export type AdminBulkAction<T> = {
  id: string
  /** Shown as the button's name on hover (the button itself is only the icon). */
  label: string
  icon: React.ReactNode
  destructive?: boolean
  /** The selected rows this action covers; the others are left untouched. */
  appliesTo?: (item: T) => boolean
  /** Title of the confirmation dialog. */
  title: string
  /** The consequence, told before the action runs: `count` rows run, `skipped` do not apply. */
  describe: (count: number, skipped: number) => string
  confirmLabel: string
  /**
   * Shows the outcome at once (e.g. through `useOptimistic`). It runs inside a transition, so the
   * screen returns to the real data when `run` and the reload have finished, whatever the result.
   */
  optimistic?: (items: T[]) => void
  run: (items: T[]) => Promise<{ done: number; failed: number }>
}
/** The caller owns the page (the server pages the list): see `page` in the URL. */
export type AdminListPagination = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}
const PAGE_SIZE = 10
/** True below Tailwind's `sm` (640px), where the toolbar stacks. */
function useBelowSm() {
  const [below, setBelow] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(max-width: 639px)')
    const update = () => setBelow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return below
}
/** An extra action of a row's popover, after «مشاهده». */
export type AdminRowAction = {
  id: string
  label: string
  icon: React.ReactNode
  destructive?: boolean
  /** A link to another page; otherwise `onSelect` runs. */
  href?: string
  onSelect?: () => void
}
/**
 * A row's actions (the shared RowActions). «مشاهده» comes first; `viewLabel` renames it (e.g.
 * «بررسی» for a pending review) and `actions` adds the others (approve, delete…). With more
 * than one they live in the «more» menu; a row with only «مشاهده» shows it directly.
 */
export function AdminRowActions({
  viewHref,
  viewLabel = 'مشاهده',
  actions = [],
}: {
  viewHref?: string
  viewLabel?: string
  actions?: AdminRowAction[]
}) {
  if (!viewHref) return null
  return (
    <RowActions
      actions={[
        { id: 'view', label: viewLabel, href: viewHref, icon: <DashboardEyeIcon aria-hidden="true" className="size-5" /> },
        ...actions,
      ]}
    />
  )
}
function ListPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <nav
      aria-label="صفحه‌بندی"
      className="flex flex-wrap items-center justify-center gap-3 pb-2"
      dir="rtl"
    >
      <Button
        type="button"
        size="40"
        variant="outline-gray"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <Typography as="span" className="text-inherit">
          صفحه قبل
        </Typography>
      </Button>
      <Typography variant="14/regular" color="neutral-600" aria-live="polite">
        صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
      </Typography>
      <Button
        type="button"
        size="40"
        variant="outline-gray"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <Typography as="span" className="text-inherit">
          صفحه بعد
        </Typography>
      </Button>
    </nav>
  )
}
export function AdminListView<T>({
  title,
  notice,
  addAction,
  searchPlaceholder = 'جستجو',
  items,
  getSearchText,
  getKey,
  columns,
  loadState = 'ready',
  refreshing = false,
  onRetry,
  filter,
  toolbar,
  serverFiltered = false,
  query: controlledQuery,
  onQueryChange,
  pagination,
  bulkActions,
  isSelectable,
  getRowHref,
}: {
  title: string
  /** A status banner under the title, such as the verification queue's pending count. */
  notice?: React.ReactNode
  /** The page's create action, shown only to whoever may create (e.g. the owner's «شرکت جدید»). */
  addAction?: React.ReactNode
  searchPlaceholder?: string
  items: T[]
  getSearchText: (item: T) => string
  getKey: (item: T) => string
  columns: AdminColumn<T>[]
  loadState?: AdminListLoadState
  /** A new page is on its way: the rows stay on screen (dimmed) instead of making way for a loading line. */
  refreshing?: boolean
  onRetry?: () => void | Promise<void>
  /** The list's ListFilterButton (FE35); every filter lives inside it. */
  filter?: React.ReactNode
  /** Replaces search and filter when the caller filters through the API (it brings its own search field and ListFilterButton). */
  toolbar?: React.ReactNode
  /** The caller filters through the API: a search over one page would misreport the list. */
  serverFiltered?: boolean
  /** With `onQueryChange` the caller searches through the API: the search field shows this value. */
  query?: string
  onQueryChange?: (query: string) => void
  /** The caller pages through the API (and keeps the page in the URL). Without it the list pages itself. */
  pagination?: AdminListPagination
  /** Adds a checkbox column and runs one action on every selected row. */
  bulkActions?: AdminBulkAction<T>[]
  /** Rows that cannot be selected (e.g. one that is still being created). */
  isSelectable?: (item: T) => boolean
  /** The detail page of a row: a click (or Enter) on the row opens it, while its links and buttons keep their own action. */
  getRowHref?: (item: T) => string | undefined
}) {
  const [localQuery, setLocalQuery] = useState('')
  const [localPage, setLocalPage] = useState(1)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  // The action being confirmed and the rows it will run on (the selection, or one row's own action).
  const [pending, setPending] = useState<{ action: AdminBulkAction<T>; items: T[]; skipped: number } | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnUrl = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ''}`
  const searchValue = onQueryChange ? (controlledQuery ?? '') : localQuery
  const filtered = useMemo(
    () => (onQueryChange ? items : items.filter((item) => getSearchText(item).includes(localQuery))),
    [items, localQuery, getSearchText, onQueryChange],
  )
  // A server-filtered or server-paged caller pages through the API; everything else pages here.
  const pagedHere = !serverFiltered && !pagination
  const totalPages = pagination
    ? pagination.totalPages
    : pagedHere
      ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
      : 1
  const currentPage = pagination ? pagination.page : Math.min(localPage, totalPages)
  const changePage = pagination ? pagination.onPageChange : setLocalPage
  const visible = pagedHere
    ? filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : filtered
  const selectable = Boolean(bulkActions?.length)
  const columnCount = columns.length + (selectable ? 1 : 0)
  const selectableRows = isSelectable ? visible.filter(isSelectable) : visible
  const selectedItems = selectable ? selectableRows.filter((item) => selected.has(getKey(item))) : []
  const allSelected = selectableRows.length > 0 && selectedItems.length === selectableRows.length
  const applicable = (action: AdminBulkAction<T>) =>
    selectedItems.filter((item) => action.appliesTo?.(item) ?? true)

  // With rows selected, their actions slide in as icons; the name shows on hover. On a phone they
  // sit beside the create button (under search and filter); otherwise beside the filter.
  const belowSm = useBelowSm()
  const actionsBesideCreate = belowSm && Boolean(addAction)
  const bulkButtons = bulkActions && (
    <BulkActionButtons
      active={selectedItems.length > 0}
      actions={bulkActions.map((action) => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        destructive: action.destructive,
        disabled: applicable(action).length === 0,
      }))}
      onChoose={(id) => {
        const action = bulkActions.find((candidate) => candidate.id === id)
        if (action) {
          const items = applicable(action)
          setPending({ action, items, skipped: selectedItems.length - items.length })
        }
      }}
    />
  )

  // A selection belongs to the rows on screen: a new page or a reload starts empty.
  useEffect(() => {
    setSelected(new Set())
  }, [currentPage, loadState])

  const toggleRow = (key: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(selectableRows.map(getKey)) : new Set())

  const rowHelpers: AdminRowHelpers<T> = {
    runAction: (actionId, item) => {
      const action = bulkActions?.find((candidate) => candidate.id === actionId)
      if (action) setPending({ action, items: [item], skipped: 0 })
    },
  }

  // The dialog closes at once and the outcome shows at once (`optimistic`); the request and the reload
  // run in a transition, so the screen settles on the real data when they finish, success or not.
  const runPendingAction = () => {
    if (!pending) return
    const { action, items } = pending
    setPending(null)
    setSelected(new Set())
    startTransition(async () => {
      action.optimistic?.(items)
      try {
        const { done, failed } = await action.run(items)
        if (done > 0) toast.success(`${done.toLocaleString('fa-IR')} مورد انجام شد.`)
        if (failed > 0) toast.error(`${failed.toLocaleString('fa-IR')} مورد انجام نشد.`)
      } catch {
        toast.error('انجام عملیات ممکن نشد. دوباره تلاش کنید.')
      }
      await onRetry?.()
    })
  }
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10" dir="rtl">
      <Typography variant="h3" color="neutral-900" className="max-sm:text-xl max-sm:leading-8">
        {title}
      </Typography>
      {notice}
      {/* Search and filter on the right, the create and bulk actions on the left; on a phone the
          create action sits under search and filter, full width. */}
      <ListToolbar
        search={
          toolbar ??
          (!serverFiltered && (
            <SearchField
              value={searchValue}
              onChange={(event) => {
                if (onQueryChange) onQueryChange(event.target.value)
                else {
                  setLocalQuery(event.target.value)
                  setLocalPage(1)
                }
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          ))
        }
        filter={
          <>
            {toolbar ? null : filter}
            {actionsBesideCreate ? null : bulkButtons}
          </>
        }
        actions={
          addAction ? (
            <>
              {actionsBesideCreate ? bulkButtons : null}
              {addAction}
            </>
          ) : undefined
        }
      />
      <ListTableFrame
        aria-busy={refreshing || undefined}
        className={`transition-opacity ${refreshing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <table className="w-full min-w-[900px] border-collapse">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="h-11 border-b border-neutral-200">
              {selectable && (
                <th className="w-12 px-4 text-right">
                  <Checkbox
                    aria-label="انتخاب همه ردیف‌ها"
                    checked={allSelected}
                    disabled={loadState !== 'ready' || selectableRows.length === 0}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th key={column.id} className="px-4 text-right">
                  <Typography variant="14/semibold" color="secondary" className="whitespace-nowrap max-sm:text-[13px]">
                    {column.header || <span className="sr-only">عملیات</span>}
                  </Typography>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadState === 'ready' && visible.map((item) => (
              <ListRow
                key={getKey(item)}
                href={getRowHref?.(item)}
                data-state={selected.has(getKey(item)) ? 'selected' : undefined}
              >
                {selectable && (
                  <td className="w-12 px-4" data-row-ignore="">
                    <Checkbox
                      aria-label="انتخاب ردیف"
                      checked={selected.has(getKey(item))}
                      disabled={isSelectable ? !isSelectable(item) : undefined}
                      onCheckedChange={() => toggleRow(getKey(item))}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td className="px-4 whitespace-nowrap" key={column.id}>
                    {column.render(item, rowHelpers)}
                  </td>
                ))}
              </ListRow>
            ))}
            {loadState !== 'ready' && (
              <tr>
                <td colSpan={columnCount} className="h-60 text-center">
                  {/* Pinned to the visible width: the table is wider than a phone and scrolls sideways. */}
                  <div className="sticky right-0 flex w-[calc(100vw-2rem)] max-w-full flex-col items-center justify-center gap-3 px-4">
                    {loadState === 'loading' && (
                      <Typography role="status" aria-live="polite" variant="16/regular" color="muted">
                        در حال دریافت اطلاعات...
                      </Typography>
                    )}
                    {loadState === 'unauthenticated' && (
                      <>
                        <Typography role="alert" variant="16/regular" color="neutral-700">
                          نشست شما پایان یافته است. برای ادامه دوباره وارد شوید.
                        </Typography>
                        <Button asChild size="36">
                          <Link href={getLoginUrl(returnUrl, { expired: true })}>ورود دوباره</Link>
                        </Button>
                      </>
                    )}
                    {loadState === 'denied' && (
                      <>
                        <Typography role="alert" variant="16/regular" color="neutral-700">
                          دسترسی به این اطلاعات مجاز نیست.
                        </Typography>
                        <Button asChild size="36" variant="outline-gray">
                          <Link href="/dashboard">بازگشت به پیشخوان</Link>
                        </Button>
                      </>
                    )}
                    {loadState === 'error' && (
                      <>
                        <Typography role="alert" variant="16/regular" color="neutral-700">
                          دریافت اطلاعات انجام نشد. ارتباط را بررسی و دوباره تلاش کنید.
                        </Typography>
                        <Button onClick={onRetry} size="36" variant="outline-gray">
                          تلاش دوباره
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
            {loadState === 'ready' && filtered.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="h-60 text-center">
                  <div className="sticky right-0 w-[calc(100vw-2rem)] max-w-full px-4">
                    <Typography variant="16/regular" color="muted">
                      {items.length === 0 && !searchValue ? 'هنوز موردی برای نمایش وجود ندارد' : 'موردی پیدا نشد'}
                    </Typography>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ListTableFrame>
      {loadState === 'ready' && (
        <ListPagination page={currentPage} totalPages={totalPages} onPageChange={changePage} />
      )}
      {pending && (
        <DecisionDialog
          title={pending.action.title}
          description={pending.action.describe(pending.items.length, pending.skipped)}
          onClose={() => setPending(null)}
          actions={
            <>
              <Button
                type="button"
                size="40"
                variant={pending.action.destructive ? 'destructive' : 'default'}
                onClick={runPendingAction}
              >
                {pending.action.confirmLabel}
              </Button>
              <Button
                type="button"
                size="40"
                variant="outline-gray"
                onClick={() => setPending(null)}
              >
                انصراف
              </Button>
            </>
          }
        />
      )}
    </main>
  )
}
