'use client'

import {
  OPERATIONAL_ROLES,
  OPERATIONAL_ROLE_LABELS,
  type OperationalRole,
} from '@cms-core/access/roles'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { DecisionDialog } from '@/components/dashboard/decision-dialog'
import { SearchField } from '@/components/dashboard/search-field'
import {
  DashboardAddIcon,
  DashboardEditIcon,
  DashboardEyeIcon,
  DashboardFilterIcon,
  DashboardMoreVerticalIcon,
  DashboardTrashIcon,
  EmptyInboxIllustration,
  TickCircleIcon,
} from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'
import { roleTag, setEmployeeActive, type Employee } from './employees/employee-data'
import { RequestError, adminErrorMessage, adminRequest, loadPeople } from './owner-admin'

const SAVED_NOTICES: Record<string, string> = {
  created: 'کارمند جدید ثبت شد.',
  updated: 'اطلاعات کارمند ذخیره شد.',
}

const searchText = (person: Employee) =>
  [
    person.name,
    person.phone,
    person.degree,
    person.activityField,
    person.operationalRole ? OPERATIONAL_ROLE_LABELS[person.operationalRole] : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('fa')

/* Header cell — Figma "Table header cell" (32:8429): 44px, 14/SemiBold grey-400. */
function HeaderCell({ label, className }: { label?: string; className?: string }) {
  return (
    <th className={cn('h-11 border-b border-neutral-100 px-4 py-3 text-right', className)}>
      {label ? (
        <Typography
          as="span"
          variant="14/semibold"
          color="neutral-400"
          className="whitespace-nowrap"
        >
          {label}
        </Typography>
      ) : (
        <span className="sr-only">عملیات</span>
      )}
    </th>
  )
}

function Tag({ label, variant }: ReturnType<typeof roleTag>) {
  return (
    <Badge variant={variant} size="md">
      <Typography as="span" variant="14/regular" className="text-inherit">
        {label}
      </Typography>
    </Badge>
  )
}

/* Lead avatar cell — Figma 32:8690: 40px round avatar, 12px gap, 16/Regular grey-600. */
function NameCell({ person }: { person: Employee }) {
  const name = person.name || 'بدون نام'
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100"
      >
        <Typography as="span" variant="16/semibold" color="brand-600">
          {name.trim().charAt(0)}
        </Typography>
      </span>
      <Link
        href={`/dashboard/employees/${encodeURIComponent(person.id)}`}
        className="min-w-0 truncate rounded-sm focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        <Typography
          as="span"
          variant="16/regular"
          color="neutral-600"
          className="whitespace-nowrap"
        >
          {name}
        </Typography>
      </Link>
      {!person.isActive && <Tag label="غیرفعال" variant="error" />}
    </div>
  )
}

const menuItemClass =
  'flex h-8 w-full cursor-pointer items-center justify-start gap-2 rounded-[10px] px-1.5 py-2 text-neutral-700 focus:bg-neutral-100 data-[highlighted]:bg-neutral-100'

/* Row actions — Figma dropdown 30722:2447 (مشاهده / ویرایش / حذف کارمند). */
function RowActions({
  person,
  canManage,
  onToggleActive,
}: {
  person: Employee
  canManage: boolean
  onToggleActive: (person: Employee) => void
}) {
  const name = person.name || 'بدون نام'
  const href = `/dashboard/employees/${encodeURIComponent(person.id)}`
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="text-gray" size="icon-32" aria-label={`عملیات ${name}`}>
          <DashboardMoreVerticalIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="flex w-[164px] min-w-[164px] flex-col gap-1 rounded-xl border-0 bg-white p-1 shadow-[0px_2px_4px_rgba(21,21,21,0.1)] ring-0"
      >
        <DropdownMenuItem asChild className={menuItemClass}>
          <Link href={href}>
            <DashboardEyeIcon className="size-5 text-neutral-700" />
            <Typography as="span" variant="14/regular" className="text-inherit">
              مشاهده
            </Typography>
          </Link>
        </DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuItem asChild className={menuItemClass}>
              <Link href={`${href}/edit`}>
                <DashboardEditIcon className="size-5 text-neutral-700" />
                <Typography as="span" variant="14/regular" className="text-inherit">
                  ویرایش
                </Typography>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className={cn(menuItemClass, person.isActive && 'text-error-500')}
              onSelect={() => onToggleActive(person)}
            >
              {person.isActive ? (
                <DashboardTrashIcon className="size-5 text-error-500" />
              ) : (
                <TickCircleIcon className="size-5" />
              )}
              <Typography as="span" variant="14/regular" className="text-inherit">
                {person.isActive ? 'حذف کارمند' : 'فعال‌سازی کارمند'}
              </Typography>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* Loading — Figma frame 33 (30722:2548): 4 columns × 5 bars, 40px high, 16px gaps. */
function EmployeesSkeleton() {
  return (
    <div role="status" aria-label="در حال دریافت کارکنان" className="flex w-full gap-4">
      {[0, 1, 2, 3].map((column) => (
        <div key={column} className="flex min-w-0 flex-1 flex-col gap-4">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton
              key={row}
              className="h-10 w-full rounded-lg bg-neutral-100 motion-reduce:animate-none"
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/* Empty — Figma frame 32 (30722:2525). */
function EmptyState({ canManage, noMatch }: { canManage: boolean; noMatch: boolean }) {
  return (
    <div className="flex w-[265px] max-w-full flex-col items-center gap-2 text-center">
      <div className="flex flex-col items-center gap-1">
        <EmptyInboxIllustration className="size-20" aria-hidden="true" />
        <Typography variant="14/semibold" color="neutral-600">
          {noMatch ? 'کارمندی با این مشخصات پیدا نشد' : 'کارمندی در این صفحه موجود نیست'}
        </Typography>
        <Typography variant="12/regular" color="neutral-500">
          {noMatch
            ? 'عبارت جستجو یا فیلتر نقش را تغییر دهید'
            : canManage
              ? 'اولین کارمند را اضافه کنید'
              : 'هنوز کارمندی ثبت نشده است'}
        </Typography>
      </div>
      {canManage && !noMatch && (
        <Button asChild variant="text" size="40">
          <Link href="/dashboard/employees/new">
            <Typography as="span" variant="16/semibold" className="text-inherit">
              کارمند جدید
            </Typography>
            <DashboardAddIcon className="size-6" />
          </Link>
        </Button>
      )}
    </div>
  )
}

export function EmployeeList({ canManage = false }: { canManage?: boolean }) {
  const searchParams = useSearchParams()
  const [people, setPeople] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<OperationalRole | 'all'>('all')
  const [pending, setPending] = useState<Employee | null>(null)
  const [toggling, setToggling] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)
  const [notice, setNotice] = useState<string | null>(
    () => SAVED_NOTICES[searchParams?.get('saved') ?? ''] ?? null,
  )

  useEffect(() => {
    let current = true
    const request = canManage
      ? loadPeople()
      : adminRequest('/api/dashboard/admin/employees?limit=100').then(
          (data) => data.items as Employee[],
        )
    request
      .then((items) => {
        // Company representatives are applicants, not staff.
        if (current) setPeople(items.filter((item) => item.operationalRole !== 'representative'))
      })
      .catch((cause) => {
        if (current) setError(cause)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [attempt, canManage])

  function refresh() {
    setLoading(true)
    setError(null)
    setAttempt((value) => value + 1)
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fa')
    return people.filter(
      (person) =>
        (roleFilter === 'all' || person.operationalRole === roleFilter) &&
        (!needle || searchText(person).includes(needle)),
    )
  }, [people, query, roleFilter])

  async function confirmToggle() {
    if (!pending || toggling) return
    setToggling(true)
    setActionError(null)
    try {
      const updated = await setEmployeeActive(pending, !pending.isActive)
      setPeople((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setNotice(
        updated.isActive
          ? `حساب «${updated.name || 'بدون نام'}» دوباره فعال شد.`
          : `«${updated.name || 'بدون نام'}» از کارکنان فعال حذف شد.`,
      )
      setPending(null)
    } catch (cause) {
      setActionError(cause)
    } finally {
      setToggling(false)
    }
  }

  const roleOptions = OPERATIONAL_ROLES.filter((role) => role !== 'representative')
  const ready = !loading && error === null

  return (
    <main dir="rtl" className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10">
      <Typography as="h1" variant="24/bold" color="neutral-700">
        کارکنان
      </Typography>

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* Toolbar — Figma frame 30722:2455 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <SearchField
              aria-label="جستجوی کارمند"
              placeholder="کارمند مورد نظر را جست و جو کنید"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="sm:w-[400px]"
            />
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button
                  variant="filter"
                  size="icon-48"
                  aria-label="فیلتر نقش"
                  data-active={roleFilter !== 'all'}
                >
                  <DashboardFilterIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-xl border border-neutral-100 bg-white p-1.5 shadow-md"
              >
                {(['all', ...roleOptions] as const).map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onSelect={() => setRoleFilter(role)}
                    className={cn(
                      'flex h-9 cursor-pointer items-center justify-between rounded-lg px-2.5',
                      roleFilter === role ? 'bg-brand-50 text-brand-600' : 'text-neutral-700',
                    )}
                  >
                    <Typography as="span" variant="14/regular" className="text-inherit">
                      {role === 'all' ? 'همه نقش‌ها' : OPERATIONAL_ROLE_LABELS[role]}
                    </Typography>
                    {roleFilter === role && (
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-500" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {canManage && (
            <Button asChild size="48">
              <Link href="/dashboard/employees/new">
                <Typography as="span" variant="20/regular" className="text-inherit">
                  کارمند جدید
                </Typography>
                <DashboardAddIcon className="size-[26px]" />
              </Link>
            </Button>
          )}
        </div>

        {notice && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-success-50 bg-success-50 px-3 py-2"
          >
            <Typography variant="14/regular" color="success">
              {notice}
            </Typography>
            <Button
              variant="text-gray"
              size="icon-32"
              aria-label="بستن پیام"
              onClick={() => setNotice(null)}
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ×
              </span>
            </Button>
          </div>
        )}

        {/* Table card — Figma frame 30722:2460 */}
        <div className="relative flex min-h-[420px] flex-1 flex-col rounded-2xl border border-neutral-200 bg-white p-4">
          {loading ? (
            <EmployeesSkeleton />
          ) : error !== null ? (
            <div className="flex flex-1 items-center justify-center">
              <RequestError error={error} returnTo="/dashboard/employees" retry={refresh} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState canManage={canManage} noMatch={people.length > 0} />
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <table className="w-full min-w-[860px] border-collapse text-right">
                <thead>
                  <tr>
                    <HeaderCell label="نام کارمند" />
                    <HeaderCell label="نقش" className="w-[200px]" />
                    <HeaderCell label="زمینه فعالیت" className="w-[200px]" />
                    <HeaderCell label="مدرک دانشگاهی" className="w-[248px]" />
                    <HeaderCell className="w-[52px]" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((person) => (
                    <tr
                      key={person.id}
                      className="h-[72px] border-b border-neutral-100 transition-colors hover:bg-neutral-100 has-[[data-state=open]]:bg-neutral-100"
                    >
                      <td className="px-4">
                        <NameCell person={person} />
                      </td>
                      <td className="px-4">
                        <Tag {...roleTag(person.operationalRole)} />
                      </td>
                      <td className="px-4">
                        {person.activityField ? (
                          <Tag label={person.activityField} variant="primary" />
                        ) : (
                          <Typography as="span" variant="16/regular" color="neutral-400">
                            —
                          </Typography>
                        )}
                      </td>
                      <td className="px-4">
                        <Typography
                          as="span"
                          variant="16/regular"
                          color={person.degree ? 'neutral-600' : 'neutral-400'}
                          className="whitespace-nowrap"
                        >
                          {person.degree || '—'}
                        </Typography>
                      </td>
                      <td className="px-2.5">
                        <RowActions
                          person={person}
                          canManage={canManage}
                          onToggleActive={(target) => {
                            setActionError(null)
                            setPending(target)
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </div>
      </div>

      {pending && ready && (
        <DecisionDialog
          title={pending.isActive ? 'حذف کارمند' : 'فعال‌سازی کارمند'}
          description={
            pending.isActive
              ? `حساب «${pending.name || 'بدون نام'}» غیرفعال می‌شود و دیگر نمی‌تواند وارد سامانه شود. سوابق و تاریخچه کارهای او حذف نمی‌شود.`
              : `حساب «${pending.name || 'بدون نام'}» دوباره فعال می‌شود و می‌تواند با نقش فعلی وارد سامانه شود.`
          }
          onClose={() => {
            if (!toggling) setPending(null)
          }}
          actions={
            <>
              <Button
                type="button"
                size="40"
                variant={pending.isActive ? 'destructive' : 'default'}
                loading={toggling}
                onClick={() => void confirmToggle()}
              >
                {pending.isActive ? 'حذف کارمند' : 'فعال‌سازی'}
              </Button>
              <Button
                type="button"
                size="40"
                variant="outline-gray"
                disabled={toggling}
                onClick={() => setPending(null)}
              >
                انصراف
              </Button>
            </>
          }
        >
          {actionError !== null && (
            <div className="flex flex-col gap-2">
              <Typography role="alert" variant="14/regular" color="error">
                {adminErrorMessage(actionError)}
              </Typography>
              <Button
                type="button"
                size="32"
                variant="outline-gray"
                onClick={() => {
                  setPending(null)
                  refresh()
                }}
              >
                دریافت دوباره فهرست
              </Button>
            </div>
          )}
        </DecisionDialog>
      )}
    </main>
  )
}
