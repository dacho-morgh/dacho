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

const TABS: { id: CompanyTab; label: string; query: string; Icon: typeof ProfileUserIcon }[] = [
  { id: 'profile', label: 'پروفایل شرکت', query: '', Icon: CompanyBuildingIcon },
  { id: 'resume', label: 'رزومه', query: '?tab=resume', Icon: DocumentTextIcon },
  { id: 'account', label: 'اطلاعات حساب', query: '?tab=account', Icon: ProfileUserIcon },
  { id: 'requests', label: 'درخواست‌ها', query: '?tab=requests', Icon: ClipboardTextIcon },
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
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pt-20 md:pt-10 lg:overflow-hidden"
      dir="rtl"
    >
      {/* Parent first, so in the right-to-left page the trail reads «شرکت ها / name» whatever language the name is in. */}
      <nav aria-label="مسیر صفحه" className="flex flex-wrap items-center gap-2">
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
        <nav
          aria-label="بخش‌های شرکت"
          className="flex w-full shrink-0 flex-row flex-wrap gap-2 border-b border-neutral-200 pb-4 lg:w-[200px] lg:flex-col lg:gap-4 lg:self-stretch lg:border-b-0 lg:border-l lg:pb-0 lg:pl-2"
        >
          {TABS.map((tab) => {
            const isActive = tab.id === active
            return (
              <div key={tab.id} className="flex items-center gap-2 lg:w-full">
                <span
                  aria-hidden="true"
                  className={cn('hidden h-7 w-1 shrink-0 rounded-sm lg:block', isActive && 'bg-brand-500')}
                />
                <Link
                  href={companyTabHref(id, tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex h-10 flex-1 items-center gap-2 rounded-xl p-2 transition-colors',
                    isActive ? 'bg-brand-50 text-brand-600' : 'text-neutral-600 hover:bg-neutral-50',
                  )}
                >
                  <tab.Icon className="size-6 shrink-0" aria-hidden="true" />
                  <Typography as="span" variant="16/regular" className="text-inherit">
                    {tab.label}
                  </Typography>
                </Link>
              </div>
            )
          })}
          <div className="flex items-center gap-2 lg:w-full">
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
