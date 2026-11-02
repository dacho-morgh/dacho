import { ActivityCard } from '@/components/dashboard/owner-overview/activity-card'
import { KpiCard } from '@/components/dashboard/owner-overview/kpi-card'
import {
  DashboardMessageTextIcon,
  DashboardRequestsIcon,
  DashboardUserTagIcon,
  TickCircleIcon,
} from '@/components/icons'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Typography } from '@/components/ui/typography'
import type { ActivityDto, DashboardOverviewDto, Paginated } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { DataTableCard, RowAction } from './data-table-card'
import { KpiGrid, OverviewShell } from './overview-shell'
import { READ_FAILED, countText, fa, greeting, queueCount } from './shared'

interface VerificationCompany {
  id: string
  name: string | null
  phone: string
  companyName: string | null
  companyType: string | null
  companyCity: string | null
  verificationStatus: string
  verificationRevision: number
}

const STATUS: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  pending: { label: 'در انتظار بررسی', variant: 'secondary' },
  returned: { label: 'برگشت داده شده', variant: 'yellow' },
  approved: { label: 'تأیید شده', variant: 'green' },
  rejected: { label: 'رد شده', variant: 'red' },
}

/** Central Secretariat: verification, support and follow-up work, and the company queue. */
export async function SecretariatOverview({ userName }: { userName?: string | null }) {
  const now = new Date()
  const [overview, activities, companies] = await Promise.all([
    serverDashboardFetchResult<DashboardOverviewDto>('/stats/overview'),
    serverDashboardFetchResult<Paginated<ActivityDto>>('/activities?limit=4'),
    serverDashboardFetchResult<{ items: VerificationCompany[] }>(
      '/admin/companies?verificationStatus=pending',
    ),
  ])
  const queues = overview.kind === 'ok' ? overview.data.queues : undefined
  const counts = overview.kind === 'ok' ? overview.data.counts : undefined
  const undelivered = queueCount(queues, 'supplementary_undelivered')

  return (
    <OverviewShell greeting={greeting(userName, now)}>
      <KpiGrid>
        <KpiCard
          label="احراز هویت در انتظار"
          tone="warning"
          value={countText(queueCount(queues, 'verification_pending'))}
          icon={<DashboardUserTagIcon />}
          meta={queues ? 'نسخه ارسال‌شده هر شرکت بررسی می‌شود' : READ_FAILED}
        />
        <KpiCard
          label="تیکت‌های باز"
          value={countText(queueCount(queues, 'support_open'))}
          icon={<DashboardMessageTextIcon />}
          meta={queues ? 'در انتظار پاسخ دبیرخانه' : READ_FAILED}
        />
        <KpiCard
          label="یادداشت بدون نتیجه منتشرشده"
          value={countText(queueCount(queues, 'follow_up_unpublished'))}
          icon={<DashboardRequestsIcon />}
          meta={
            undelivered === undefined ? READ_FAILED : `${fa(undelivered)} مدرک تکمیلی تحویل‌نشده`
          }
        />
        <KpiCard
          label="درخواست‌های در حال بررسی"
          tone="success"
          value={counts ? fa(counts.in_review) : '—'}
          unit={counts ? `از ${fa(counts.total)}` : undefined}
          icon={<TickCircleIcon />}
          meta={counts ? `${fa(counts.approved)} درخواست تأیید شده` : READ_FAILED}
        />
      </KpiGrid>

      <ActivityCard
        items={activities.kind === 'ok' ? activities.data.items : undefined}
        notice={unavailableReasonFor(activities)}
      />

      <DataTableCard
        title="صف احراز هویت شرکت‌ها"
        subtitle="نسخه ارسال‌شده هر شرکت بررسی می‌شود"
        href="/dashboard/companies"
        columns={['شرکت', 'نوع شرکت', 'شهر', 'نسخه', 'وضعیت', '']}
        notice={unavailableReasonFor(companies)}
        emptyText="شرکتی در انتظار احراز هویت نیست."
        rows={
          companies.kind === 'ok'
            ? companies.data.items.slice(0, 5).map((company) => {
                const status = STATUS[company.verificationStatus] ?? STATUS.pending
                return {
                  key: company.id,
                  cells: [
                    <span key="name" className="flex flex-col">
                      <Typography as="span" variant="14/semibold" color="neutral-800">
                        {company.companyName ?? company.name ?? '—'}
                      </Typography>
                      <Typography as="span" variant="12/regular" color="neutral-500">
                        {company.phone}
                      </Typography>
                    </span>,
                    company.companyType ?? '—',
                    company.companyCity ?? '—',
                    `نسخه ${fa(company.verificationRevision)}`,
                    <Badge key="status" variant={status.variant} size="sm" dot>
                      {status.label}
                    </Badge>,
                    <RowAction
                      key="action"
                      href={`/dashboard/companies/${encodeURIComponent(company.id)}`}
                      label="بررسی"
                      primary
                    />,
                  ],
                }
              })
            : undefined
        }
      />
    </OverviewShell>
  )
}
