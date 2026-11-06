'use client'

import {
  OPERATIONAL_ROLES,
  OPERATIONAL_ROLE_LABELS,
  type OperationalRole,
} from '@cms-core/access/roles'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import {
  AdminListView,
  AdminRowActions,
  type AdminBulkAction,
  type AdminColumn,
  type AdminListLoadState,
} from '@/components/dashboard/admin-list-view'
import { ListFilterButton } from '@/components/dashboard/list-filter-button'
import {
  DashboardAddIcon,
  DashboardEditIcon,
  DashboardTrashIcon,
  TickCircleIcon,
} from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { AdminError } from './owner-admin'
import { loadEmployees, roleTag, setEmployeeActive, type Employee } from './employees/employee-data'

const SAVED_NOTICES: Record<string, string> = {
  created: 'کارمند جدید ثبت شد.',
  updated: 'اطلاعات کارمند ذخیره شد.',
}

const SEARCH_DEBOUNCE_MS = 300
const PAGE_SIZE = 10
const ROLE_OPTIONS = OPERATIONAL_ROLES.filter((role) => role !== 'representative')

const faNumber = (value: number) => value.toLocaleString('fa-IR')
const keyOf = (person: Employee) => String(person.id)
const hrefOf = (person: Employee) => `/dashboard/employees/${encodeURIComponent(person.id)}`

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

/** The URL's `role`, `page` and `search`, read the same way on every render. */
function employeeParams(params: { role?: string | null; page?: string | null; search?: string | null }) {
  return {
    role: ROLE_OPTIONS.find((role) => role === params.role) ?? 'all',
    page: Math.max(1, Number.parseInt(params.page ?? '', 10) || 1),
    search: (params.search ?? '').trim(),
  } as { role: OperationalRole | 'all'; page: number; search: string }
}

/** What an action does to the list once the server agrees; shown before it answers. */
type ListChange = { ids: ReadonlySet<string>; isActive: boolean }

function applyChange(people: Employee[], change: ListChange): Employee[] {
  return people.map((person) =>
    change.ids.has(keyOf(person)) ? { ...person, isActive: change.isActive } : person,
  )
}

/** Each account is switched through the same command as its dossier: nothing is erased. */
async function switchEmployees(items: Employee[], isActive: boolean) {
  const results = await Promise.allSettled(
    items.map(async (item) => {
      if (!item.updatedAt) throw new Error('missing_version')
      await setEmployeeActive(item, isActive)
    }),
  )
  const done = results.filter((result) => result.status === 'fulfilled').length
  return { done, failed: results.length - done }
}

const deactivateAction: AdminBulkAction<Employee> = {
  id: 'deactivate',
  label: 'حذف کارمند',
  icon: <DashboardTrashIcon aria-hidden="true" />,
  destructive: true,
  appliesTo: (item) => item.isActive,
  title: 'حذف کارمند',
  describe: (count, skipped) =>
    `حساب ${faNumber(count)} کارمند غیرفعال می‌شود و دیگر نمی‌تواند وارد سامانه شود. سوابق و تاریخچه کارهای او حذف نمی‌شود.` +
    (skipped > 0 ? ` ${faNumber(skipped)} کارمند انتخاب‌شده از قبل غیرفعال است و نادیده گرفته می‌شود.` : ''),
  confirmLabel: 'حذف کارمند',
  run: (items) => switchEmployees(items, false),
}

const activateAction: AdminBulkAction<Employee> = {
  id: 'activate',
  label: 'فعال‌سازی کارمند',
  icon: <TickCircleIcon aria-hidden="true" />,
  appliesTo: (item) => !item.isActive,
  title: 'فعال‌سازی کارمند',
  describe: (count, skipped) =>
    `حساب ${faNumber(count)} کارمند دوباره فعال می‌شود و می‌تواند با نقش فعلی وارد سامانه شود.` +
    (skipped > 0 ? ` ${faNumber(skipped)} کارمند انتخاب‌شده فعال است و نادیده گرفته می‌شود.` : ''),
  confirmLabel: 'فعال‌سازی',
  run: (items) => switchEmployees(items, true),
}

const text = (value: string) => (
  <Typography variant="14/regular" color="secondary" className="max-sm:text-[13px]">
    {value}
  </Typography>
)

function Tag({ label, variant }: ReturnType<typeof roleTag>) {
  return (
    <Badge variant={variant} size="sm">
      {label}
    </Badge>
  )
}

/** Lead avatar cell: the name opens the dossier; an inactive account carries its own tag. */
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
        href={hrefOf(person)}
        className="min-w-0 truncate rounded-sm focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {text(name)}
      </Link>
      {!person.isActive && <Tag label="غیرفعال" variant="error" />}
    </div>
  )
}

function buildColumns(canManage: boolean, edit: (person: Employee) => void): AdminColumn<Employee>[] {
  return [
    { id: 'name', header: 'نام کارمند', render: (person) => <NameCell person={person} /> },
    { id: 'role', header: 'نقش', render: (person) => <Tag {...roleTag(person.operationalRole)} /> },
    {
      id: 'activityField',
      header: 'زمینه فعالیت',
      render: (person) =>
        person.activityField ? <Tag label={person.activityField} variant="primary" /> : text('—'),
    },
    { id: 'degree', header: 'مدرک دانشگاهی', render: (person) => text(person.degree || '—') },
    {
      id: 'actions',
      header: '',
      render: (person, { runAction }) => {
        const toggle = person.isActive ? deactivateAction : activateAction
        return (
          <AdminRowActions
            viewHref={hrefOf(person)}
            actions={
              canManage
                ? [
                    {
                      id: 'edit',
                      label: 'ویرایش',
                      icon: <DashboardEditIcon aria-hidden="true" className="size-5" />,
                      onSelect: () => edit(person),
                    },
                    {
                      id: toggle.id,
                      label: toggle.label,
                      icon: toggle.icon,
                      destructive: toggle.destructive,
                      onSelect: () => runAction(toggle.id, person),
                    },
                  ]
                : []
            }
          />
        )
      },
    },
  ]
}

const failureState = (cause: unknown): AdminListLoadState =>
  cause instanceof AdminError && cause.status === 401
    ? 'unauthenticated'
    : cause instanceof AdminError && cause.status === 403
      ? 'denied'
      : 'error'

/**
 * Staff list on the shared admin table, like the companies list. The role, page and search live in
 * the URL (back, refresh and sharing reopen the same view); the owner may add, edit and switch
 * accounts, one by one or selected together.
 * `initial`: the list as the server read it, so the table opens with its rows.
 */
export function EmployeeList({
  canManage = false,
  initial,
}: {
  canManage?: boolean
  initial?: Employee[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { role, page: requestedPage, search: urlSearch } = employeeParams({
    role: searchParams?.get('role'),
    page: searchParams?.get('page'),
    search: searchParams?.get('search'),
  })

  const [people, setPeople] = useState<Employee[]>(initial ?? [])
  const [loadState, setLoadState] = useState<AdminListLoadState>(initial ? 'ready' : 'loading')
  // Switching accounts shows its outcome at once; the screen returns to the server's rows (with the same
  // change if it succeeded, without it if it failed) when the transition ends.
  const [shown, showChange] = useOptimistic(people, applyChange)
  const [query, setQuery] = useState(urlSearch)
  const latestLoad = useRef(0)
  const lastWrittenSearch = useRef(urlSearch)
  const hasRows = useRef(Boolean(initial))
  const [refreshing, setRefreshing] = useState(false)

  // A save on the employee form redirects here with ?saved=…; confirm it once.
  const savedNotice = SAVED_NOTICES[searchParams?.get('saved') ?? '']
  useEffect(() => {
    if (savedNotice) toast.success(savedNotice)
  }, [savedNotice])

  const writeUrl = useCallback(
    (changes: Record<string, string | undefined>, mode: 'push' | 'replace' = 'push') => {
      const next = new URLSearchParams(searchParams?.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      const search = next.toString()
      router[mode](search ? `${pathname}?${search}` : pathname)
    },
    [pathname, router, searchParams],
  )

  // `silent`: a reload after an action, which keeps the table as it is (no dimming) until the rows arrive.
  const load = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const current = ++latestLoad.current
      if (!silent) {
        if (hasRows.current) setRefreshing(true)
        else setLoadState('loading')
      }
      try {
        const items = await loadEmployees(canManage)
        if (current !== latestLoad.current) return
        hasRows.current = true
        // In a transition, so the real rows land together with the end of an action's optimistic state.
        startTransition(() => {
          setPeople(items)
          setRefreshing(false)
          setLoadState('ready')
        })
      } catch (cause) {
        if (current !== latestLoad.current) return
        hasRows.current = false
        setRefreshing(false)
        setLoadState(failureState(cause))
      }
    },
    [canManage],
  )

  useEffect(() => {
    // The server already answered the first load.
    if (initial) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load])

  // Typing filters at once; the URL follows after a pause and starts again from page 1.
  useEffect(() => {
    if (query.trim() === urlSearch) return
    const timer = setTimeout(() => {
      lastWrittenSearch.current = query
      writeUrl({ search: query.trim() || undefined, page: undefined }, 'replace')
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, urlSearch, writeUrl])

  // Back and forward change the URL without typing: show the search it holds.
  useEffect(() => {
    if (urlSearch !== lastWrittenSearch.current) {
      lastWrittenSearch.current = urlSearch
      setQuery(urlSearch)
    }
  }, [urlSearch])

  const needle = query.trim().toLocaleLowerCase('fa')
  const filtered = useMemo(
    () =>
      shown.filter(
        (person) =>
          (role === 'all' || person.operationalRole === role) &&
          (!needle || searchText(person).includes(needle)),
      ),
    [shown, role, needle],
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const counts = useMemo(
    () =>
      shown.reduce<Record<string, number>>(
        (acc, person) => {
          acc.all += 1
          if (person.operationalRole) acc[person.operationalRole] = (acc[person.operationalRole] ?? 0) + 1
          return acc
        },
        { all: 0 },
      ),
    [shown],
  )

  const filter = (
    <ListFilterButton
      label="فیلتر نقش"
      groups={[
        {
          key: 'role',
          label: 'نقش',
          value: role === 'all' ? undefined : role,
          options: [
            { value: '', label: 'همه نقش‌ها', count: counts.all },
            ...ROLE_OPTIONS.map((option) => ({
              value: option,
              label: OPERATIONAL_ROLE_LABELS[option],
              count: counts[option] ?? 0,
            })),
          ],
        },
      ]}
    />
  )

  const bulkActions = useMemo(() => {
    if (!canManage) return undefined
    const idsOf = (items: Employee[]) => new Set(items.map(keyOf))
    return [
      { ...deactivateAction, optimistic: (items: Employee[]) => showChange({ ids: idsOf(items), isActive: false }) },
      { ...activateAction, optimistic: (items: Employee[]) => showChange({ ids: idsOf(items), isActive: true }) },
    ]
  }, [canManage, showChange])
  const columns = useMemo(
    () => buildColumns(canManage, (person) => router.push(`${hrefOf(person)}/edit`)),
    [canManage, router],
  )

  return (
    <AdminListView
      title="کارکنان"
      addAction={
        canManage ? (
          <Button asChild size="48" className="w-full min-w-0 shrink sm:w-auto sm:shrink-0">
            <Link href="/dashboard/employees/new">
              <DashboardAddIcon className="size-5 sm:size-6" />
              <Typography as="span" variant="16/regular" color="white" className="max-sm:text-sm">
                کارمند جدید
              </Typography>
            </Link>
          </Button>
        ) : undefined
      }
      searchPlaceholder="جستجوی کارمند"
      items={visible}
      getSearchText={() => ''}
      query={query}
      onQueryChange={setQuery}
      pagination={{
        page,
        totalPages,
        onPageChange: (next) => writeUrl({ page: next > 1 ? String(next) : undefined }),
      }}
      bulkActions={bulkActions}
      getKey={keyOf}
      columns={columns}
      loadState={loadState}
      refreshing={refreshing}
      filter={filter}
      onRetry={() => load({ silent: true })}
    />
  )
}
