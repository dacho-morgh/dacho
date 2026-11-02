import { ActivityCard } from '@/components/dashboard/owner-overview/activity-card'
import { KpiCard } from '@/components/dashboard/owner-overview/kpi-card'
import {
  DashboardMessageTextIcon,
  RequestsIcon,
  DashboardUserTagIcon,
  TickCircleIcon,
} from '@/components/icons'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Typography } from '@/components/ui/typography'
import type { ActivityDto, Paginated } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { BreakdownCard } from './breakdown-card'
import { BOOTH_ROWS, VERIFICATION_ROWS } from './chart-rows'
import { DataTableCard, RowAction } from './data-table-card'
import { NextTasksCard } from './next-tasks-card'
import { KpiGrid, OverviewShell } from './overview-shell'
import {
  READ_FAILED,
  chartOf,
  countText,
  fa,
  greeting,
  queueCount,
  sectionFailed,
  type RoleOverviewDto,
} from './shared'

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

/** Central Secretariat: verification, booth, support and follow-up work, and the company queue. */
export async function SecretariatOverview({ userName }: { userName?: string | null }) {
  const now = new Date()
  const [overview, activities, companies] = await Promise.all([
    serverDashboardFetchResult<RoleOverviewDto>('/stats/overview'),
    serverDashboardFetchResult<Paginated<ActivityDto>>('/activities?limit=4'),
    serverDashboardFetchResult<{ items: VerificationCompany[] }>(
      '/admin/companies?verificationStatus=pending',
    ),
  ])
  const data = overview.kind === 'ok' ? overview.data : undefined
  const queues = data?.queues
  const undelivered = queueCount(queues, 'supplementary_undelivered')
  const boothFailed = sectionFailed(data, 'booth_requests')
  const receipts = boothFailed ? undefined : queueCount(queues, 'booth_receipt_pending')
  const attendance = boothFailed ? undefined : queueCount(queues, 'booth_attendance_pending')

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
          icon={<RequestsIcon />}
          meta={
            undelivered === undefined ? READ_FAILED : `${fa(undelivered)} مدرک تکمیلی تحویل‌نشده`
          }
        />
        <KpiCard
          label="فیش‌های غرفه در انتظار بررسی"
          tone="success"
          value={countText(receipts)}
          icon={<TickCircleIcon />}
          meta={
            attendance === undefined
              ? READ_FAILED
              : `${fa(attendance)} درخواست غرفه در انتظار تأیید حضور`
          }
        />
      </KpiGrid>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <BreakdownCard
          title="وضعیت احراز هویت شرکت‌ها"
          subtitle="آخرین نسخه ارسال‌شده هر شرکت"
          rows={VERIFICATION_ROWS}
          values={chartOf(data, 'company_verification')}
          notice={unavailableReasonFor(overview)}
          emptyText="هنوز شرکتی برای احراز هویت ارسال نکرده است."
        />
        <BreakdownCard
          title="درخواست‌های غرفه نمایشگاه‌ها"
          subtitle="همه نمایشگاه‌ها، به تفکیک مرحله"
          rows={BOOTH_ROWS}
          values={chartOf(data, 'booth_requests')}
          notice={unavailableReasonFor(overview)}
          emptyText="هنوز درخواست غرفه‌ای ثبت نشده است."
        />
        <NextTasksCard
          queues={queues}
          notice={unavailableReasonFor(overview)}
          failed={data?.unavailable}
        />
      </div>

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
