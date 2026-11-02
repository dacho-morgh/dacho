import { ActivityCard } from '@/components/dashboard/owner-overview/activity-card'
import { KpiCard } from '@/components/dashboard/owner-overview/kpi-card'
import { EditIcon, RequestsIcon, LettersIcon, TickCircleIcon } from '@/components/icons'
import {
  formatDate,
  type ActivityDto,
  type DashboardOverviewDto,
  type Paginated,
} from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { CaseCell, DataTableCard, RowAction } from './data-table-card'
import { KpiGrid, OverviewShell } from './overview-shell'
import { READ_FAILED, countText, fa, greeting, queueCount } from './shared'

interface InvestmentQueueItem {
  requestId: string
  trackingCode: string
  title: string
  companyName: string | null
  assignedAt: string
  package: { packageVersion: number; submittedAt: string }
}

interface InvestmentQueueDto {
  items: InvestmentQueueItem[]
  total: number
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Investment expert: cases whose financial package reached them, and the memos still owed. */
export async function InvestmentOverview({ userName }: { userName?: string | null }) {
  const now = new Date()
  const [queue, overview, activities] = await Promise.all([
    serverDashboardFetchResult<InvestmentQueueDto>('/investment/queue?page=1&limit=100'),
    serverDashboardFetchResult<DashboardOverviewDto>('/stats/overview'),
    serverDashboardFetchResult<Paginated<ActivityDto>>('/activities?limit=4'),
  ])
  const total = queue.kind === 'ok' ? queue.data.total : undefined
  const pending = queueCount(
    overview.kind === 'ok' ? overview.data.queues : undefined,
    'memo_pending',
  )
  const fresh =
    queue.kind === 'ok'
      ? queue.data.items.filter(
          (item) => now.getTime() - Date.parse(item.package.submittedAt) < WEEK_MS,
        ).length
      : undefined
  const written =
    total !== undefined && pending !== undefined ? Math.max(0, total - pending) : undefined

  return (
    <OverviewShell
      greeting={
        total
          ? `${greeting(userName, now)} ${fa(total)} پرونده در اختیار شماست.`
          : greeting(userName, now)
      }
    >
      <KpiGrid>
        <KpiCard
          label="پرونده‌های در اختیار"
          value={countText(total)}
          icon={<RequestsIcon />}
          meta={total === undefined ? READ_FAILED : 'همه با بسته مالی کامل'}
        />
        <KpiCard
          label="در انتظار یادداشت"
          tone="warning"
          value={countText(pending)}
          icon={<EditIcon />}
          meta={pending === undefined ? READ_FAILED : 'پرونده‌هایی که یادداشتشان ارسال نشده'}
        />
        <KpiCard
          label="بسته‌های مالی تازه"
          value={countText(fresh)}
          icon={<LettersIcon />}
          meta={fresh === undefined ? READ_FAILED : 'رسیده در هفت روز اخیر'}
        />
        <KpiCard
          label="یادداشت‌های ارسال‌شده"
          tone="success"
          value={countText(written)}
          icon={<TickCircleIcon />}
          meta={written === undefined ? READ_FAILED : 'از میان پرونده‌های در اختیار'}
        />
      </KpiGrid>

      <ActivityCard
        items={activities.kind === 'ok' ? activities.data.items : undefined}
        notice={unavailableReasonFor(activities)}
      />

      <DataTableCard
        title="پرونده‌های در اختیار شما"
        subtitle="پرونده‌های رسیده پس از تکمیل بسته مالی"
        href="/dashboard/requests"
        columns={['پرونده', 'شرکت', 'تاریخ سپردن', 'بسته مالی', '']}
        notice={unavailableReasonFor(queue)}
        emptyText="پرونده‌ای به شما سپرده نشده است."
        rows={
          queue.kind === 'ok'
            ? queue.data.items.slice(0, 5).map((item) => ({
                key: item.requestId,
                cells: [
                  <CaseCell
                    key="case"
                    id={item.requestId}
                    title={item.title}
                    trackingCode={item.trackingCode}
                  />,
                  item.companyName ?? '—',
                  formatDate(item.assignedAt),
                  `نسخه ${fa(item.package.packageVersion)}، ${formatDate(item.package.submittedAt)}`,
                  <RowAction
                    key="action"
                    href={`/dashboard/requests/${encodeURIComponent(item.requestId)}`}
                    label="مشاهده پرونده"
                    primary
                  />,
                ],
              }))
            : undefined
        }
      />
    </OverviewShell>
  )
}
