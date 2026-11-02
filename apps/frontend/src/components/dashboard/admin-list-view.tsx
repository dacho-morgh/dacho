'use client'
import { SearchField } from '@/components/dashboard/search-field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DashboardMoreIcon } from '@/components/icons'
import { getLoginUrl } from '@/utilities/auth-return-url'
export type AdminColumn<T> = { id: string; header?: string; render: (item: T) => React.ReactNode }
export type AdminListLoadState = 'loading' | 'ready' | 'unauthenticated' | 'denied' | 'error'
export function AdminRowActions({
  viewHref,
}: {
  viewHref?: string
}) {
  if (!viewHref) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="text-gray" size="icon-sm" aria-label="عملیات">
          <DashboardMoreIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {viewHref ? (
          <DropdownMenuItem asChild>
            <Link href={viewHref}>
              <Typography variant="14/regular">مشاهده</Typography>
            </Link>
          </DropdownMenuItem>
        ) : null}
        {viewHref && <DropdownMenuItem disabled>
          <Typography variant="14/regular" color="muted">ویرایش از این بخش فعال نیست</Typography>
        </DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
export function AdminListView<T>({
  title,
  addAction,
  searchPlaceholder = 'جستجو',
  items,
  getSearchText,
  getKey,
  columns,
  loadState = 'ready',
  onRetry,
  filter,
  toolbar,
  serverFiltered = false,
}: {
  title: string
  /** The page's create action, shown only to whoever may create (e.g. the owner's «شرکت جدید»). */
  addAction?: React.ReactNode
  searchPlaceholder?: string
  items: T[]
  getSearchText: (item: T) => string
  getKey: (item: T) => string
  columns: AdminColumn<T>[]
  loadState?: AdminListLoadState
  onRetry?: () => void
  /** The list's ListFilterButton (FE35); every filter lives inside it. */
  filter?: React.ReactNode
  /** Replaces search and filter when the caller filters through the API (it brings its own). */
  toolbar?: React.ReactNode
  /** The caller filters through the API: a search over one page would misreport the list. */
  serverFiltered?: boolean
}) {
  const [query, setQuery] = useState('')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnUrl = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ''}`
  const filtered = useMemo(
    () => items.filter((item) => getSearchText(item).includes(query)),
    [items, query, getSearchText],
  )
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10" dir="rtl">
      <Typography variant="h3" color="neutral-900">
        {title}
      </Typography>
      <div className="flex flex-row-reverse flex-wrap items-center justify-between gap-3">
        {addAction}
        {toolbar}
        {!serverFiltered && !toolbar && (
          <div className="flex flex-row-reverse gap-2">
            {filter}
            <SearchField
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>
        )}
      </div>
      <ScrollArea className="min-h-0 min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="h-11 border-b border-neutral-200">
              {columns.map((column) => (
                <th key={column.id} className="px-4 text-right">
                  <Typography variant="14/semibold" color="secondary">
                    {column.header || <span className="sr-only">عملیات</span>}
                  </Typography>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadState === 'ready' && filtered.map((item) => (
              <tr key={getKey(item)} className="h-[72px] border-b border-neutral-100 last:border-0">
                {columns.map((column) => (
                  <td className="px-4" key={column.id}>
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
            {loadState !== 'ready' && (
              <tr>
                <td colSpan={columns.length} className="h-60 text-center">
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
                <td colSpan={columns.length} className="h-60 text-center">
                  <div className="sticky right-0 w-[calc(100vw-2rem)] max-w-full px-4">
                    <Typography variant="16/regular" color="muted">
                      {items.length === 0 ? 'هنوز موردی برای نمایش وجود ندارد' : 'موردی پیدا نشد'}
                    </Typography>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </main>
  )
}
