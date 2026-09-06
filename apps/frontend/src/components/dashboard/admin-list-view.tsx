'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Typography } from '@/components/ui/typography'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  DashboardAddIcon,
  DashboardFilterIcon,
  DashboardMoreIcon,
  DashboardSearchIcon,
} from '@/components/icons'
export type AdminColumn<T> = { id: string; header?: string; render: (item: T) => React.ReactNode }
export function AdminRowActions({
  deleteLabel = 'حذف',
  viewHref,
}: {
  deleteLabel?: string
  viewHref?: string
}) {
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
        ) : (
          <DropdownMenuItem>
            <Typography variant="14/regular">مشاهده</Typography>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem>
          <Typography variant="14/regular">ویرایش</Typography>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Typography variant="14/regular" color="error">
            {deleteLabel}
          </Typography>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
export function AdminListView<T>({
  title,
  addLabel,
  searchPlaceholder = 'جستجو',
  items,
  getSearchText,
  getKey,
  columns,
}: {
  title: string
  addLabel: string
  searchPlaceholder?: string
  items: T[]
  getSearchText: (item: T) => string
  getKey: (item: T) => string
  columns: AdminColumn<T>[]
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => items.filter((item) => getSearchText(item).includes(query)),
    [items, query, getSearchText],
  )
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10" dir="rtl">
      <Typography variant="h3" color="neutral-900">
        {title}
      </Typography>
      <div className="flex flex-row-reverse flex-wrap items-center justify-between gap-3">
        <Button size="48" icon={<DashboardAddIcon className="size-6" />}>
          <Typography variant="16/regular" color="white">
            {addLabel}
          </Typography>
        </Button>
        <div className="flex flex-row-reverse gap-2">
          <Button
            variant="outline-gray"
            size="48"
            icon={<DashboardFilterIcon className="size-6" />}
            aria-label="فیلتر"
          />
          <div className="relative">
            <DashboardSearchIcon className="absolute right-3 top-3 size-6 text-neutral-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 w-[400px] max-w-[70vw] rounded-xl pr-11"
              placeholder={searchPlaceholder}
            />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto rounded-xl border border-neutral-200 bg-white lg:min-h-[848px]">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
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
            {filtered.map((item) => (
              <tr key={getKey(item)} className="h-[72px] border-b border-neutral-100 last:border-0">
                {columns.map((column) => (
                  <td className="px-4" key={column.id}>
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="h-60 text-center">
                  <Typography variant="16/regular" color="muted">
                    موردی پیدا نشد
                  </Typography>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
