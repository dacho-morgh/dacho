import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  ClipboardTextIcon,
  CompanyBuildingIcon,
  DocumentTextIcon,
  ProfileUserIcon,
} from '@/components/icons'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'
import { DeleteCompanyAccount } from './company-delete-account'

export type CompanyTab = 'profile' | 'resume' | 'account' | 'requests'

const TABS: { id: CompanyTab; label: string; shortLabel: string; query: string; Icon: typeof ProfileUserIcon }[] = [
  { id: 'profile', label: 'پروفایل شرکت', shortLabel: 'پروفایل', query: '', Icon: CompanyBuildingIcon },
  { id: 'resume', label: 'رزومه', shortLabel: 'رزومه', query: '?tab=resume', Icon: DocumentTextIcon },
  { id: 'account', label: 'اطلاعات حساب', shortLabel: 'حساب', query: '?tab=account', Icon: ProfileUserIcon },
  { id: 'requests', label: 'درخواست‌ها', shortLabel: 'درخواست‌ها', query: '?tab=requests', Icon: ClipboardTextIcon },
]

export function companyTabHref(id: string, tab: CompanyTab): string {
  const query = TABS.find((item) => item.id === tab)?.query ?? ''
  return `/dashboard/companies/${encodeURIComponent(id)}${query}`
}

/**
 * The frame every company detail screen shares (Figma 30537:18734 and siblings): the
 * company breadcrumb, a white card, the section tabs on the reading side and the
 * active section beside them.
 */
export function CompanyDetailShell({
  id,
  companyName,
  active,
  representativeUpdatedAt,
  canManageAccount = false,
  children,
}: {
  id: string
  companyName?: string
  active: CompanyTab
  /** The representative account's version, which the account commands are guarded by. */
  representativeUpdatedAt?: string | null
  canManageAccount?: boolean
  children: ReactNode
}) {
  return (
    <main
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pt-6 md:pt-10 lg:overflow-hidden"
      dir="rtl"
    >
      {/* Parent first, so in the right-to-left page the trail reads «شرکت ها / name» whatever language the name is in. */}
      {/* On small screens the breadcrumb shares the row of the menu button, which sits at the opposite edge. */}
      <nav aria-label="مسیر صفحه" className="flex min-h-10 flex-wrap items-center gap-2 pe-12 md:pe-0">
        <Link href="/dashboard/companies">
          <Typography as="span" variant="16/regular" color="muted">
            شرکت ها
          </Typography>
        </Link>
        <Typography as="span" variant="16/regular" color="muted" aria-hidden="true">
          /
        </Typography>
        <Typography as="h1" variant="24/bold" color="neutral-700" dir="auto" className="min-w-0 break-words">
          {companyName || '—'}
        </Typography>
      </nav>

      <div className="flex shrink-0 flex-col gap-4 rounded-2xl border border-neutral-200 bg-background p-4 lg:min-h-0 lg:flex-1 lg:flex-row">
        {/* Below lg the sections are a bottom navigation bar that floats at the foot of the screen. */}
        <nav
          aria-label="بخش‌های شرکت"
          className="sticky bottom-2 z-20 order-last grid grid-cols-5 gap-1 rounded-2xl border border-neutral-200 bg-background p-1 shadow-lg lg:static lg:order-first lg:flex lg:w-[200px] lg:shrink-0 lg:flex-col lg:gap-4 lg:self-stretch lg:rounded-none lg:border-y-0 lg:border-r-0 lg:bg-transparent lg:p-0 lg:pl-2 lg:shadow-none"
        >
          {TABS.map((tab) => {
            const isActive = tab.id === active
            return (
              <div key={tab.id} className="flex min-w-0 items-stretch gap-2 lg:w-full lg:items-center">
                <span
                  aria-hidden="true"
                  className={cn('hidden h-7 w-1 shrink-0 rounded-sm lg:block', isActive && 'bg-brand-500')}
                />
                <Link
                  href={companyTabHref(id, tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-colors lg:h-10 lg:flex-row lg:justify-start lg:gap-2 lg:p-2 lg:text-start',
                    isActive ? 'bg-brand-50 text-brand-600' : 'text-neutral-600 hover:bg-neutral-50',
                  )}
                >
                  <tab.Icon className="size-6 shrink-0" aria-hidden="true" />
                  {/* One line in the bottom bar: a short name there, the full one beside the icon from lg. */}
                  <Typography as="span" variant="12/regular" className="whitespace-nowrap text-inherit lg:hidden">
                    {tab.shortLabel}
                  </Typography>
                  <Typography as="span" variant="16/regular" className="hidden text-inherit lg:inline">
                    {tab.label}
                  </Typography>
                </Link>
              </div>
            )
          })}
          <div className="flex min-w-0 items-stretch gap-2 lg:w-full lg:items-center">
            <span aria-hidden="true" className="hidden h-7 w-1 shrink-0 lg:block" />
            <DeleteCompanyAccount
              userId={id}
              updatedAt={representativeUpdatedAt}
              companyName={companyName}
              canManage={canManageAccount}
            />
          </div>
        </nav>

        <ScrollArea className="min-w-0 flex-1 lg:min-h-0">
          <div className="flex flex-col gap-5">{children}</div>
        </ScrollArea>
      </div>
    </main>
  )
}
