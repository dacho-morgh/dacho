import { ActivityCard } from '@/components/dashboard/owner-overview/activity-card'
import { KpiCard, Sparkline } from '@/components/dashboard/owner-overview/kpi-card'
import { EyeIcon, RequestsIcon, PeopleIcon, TickCircleIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import {
  REQUEST_STATUS_LABELS,
  formatDate,
  type ActivityDto,
  type DashboardOverviewDto,
  type Paginated,
  type RequestAction,
  type RequestStats,
  type RequestStatus,
} from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { monthlyTrend, type TrendDayDto } from '@/utilities/dashboard-trend'
import { STATUS_VARIANT, STAGE_LABELS, type CaseListItem } from './case-list'
import { CaseCell, DataTableCard, RowAction } from './data-table-card'
import { FunnelCard } from './funnel-card'
import { NextTasksCard } from './next-tasks-card'
import { KpiGrid, OverviewShell } from './overview-shell'
import { READ_FAILED, countText, fa, greeting, queueCount } from './shared'

/** First command the chief can run on a case, most specific first. */
const CHIEF_ACTIONS: { action: RequestAction; label: string }[] = [
  { action: 'triage', label: 'بررسی اولیه' },
  { action: 'startReview', label: 'تعیین داوران' },
  { action: 'decideReview', label: 'تصمیم' },
]

/** Chief reviewer: triage, round start and decision work, and how the event's cases progress. */
export async function ChiefOverview({ userName }: { userName?: string | null }) {
  const now = new Date()
  const [overview, trend, triaged, advanced, activities, requests] = await Promise.all([
    serverDashboardFetchResult<DashboardOverviewDto>('/stats/overview'),
    serverDashboardFetchResult<{ days: TrendDayDto[] }>('/stats/trend'),
    serverDashboardFetchResult<RequestStats>('/stats?stage=triaged'),
    serverDashboardFetchResult<RequestStats>('/stats?stage=advanced'),
    serverDashboardFetchResult<Paginated<ActivityDto>>('/activities?limit=4'),
    serverDashboardFetchResult<Paginated<CaseListItem>>('/admin/requests?limit=5&page=1'),
  ])
  const queues = overview.kind === 'ok' ? overview.data.queues : undefined
  const counts = overview.kind === 'ok' ? overview.data.counts : undefined
  const months = trend.kind === 'ok' ? monthlyTrend(trend.data.days, now) : undefined
  const thisWeek = months?.at(-1)
  const submitted = counts
    ? counts.in_review + counts.approved + counts.action_needed + counts.rejected
    : undefined
  const funnelReady = submitted !== undefined && triaged.kind === 'ok' && advanced.kind === 'ok'

  return (
    <OverviewShell greeting={greeting(userName, now)}>
      <KpiGrid>
        <KpiCard
          label="در انتظار بررسی اولیه"
          tone="warning"
          value={countText(queueCount(queues, 'chief_triage'))}
          icon={<EyeIcon />}
          meta={queues ? 'پرونده‌های رویدادهای شما' : READ_FAILED}
        />
        <KpiCard
          label="در انتظار تعیین داوران"
          value={countText(queueCount(queues, 'chief_start_review'))}
          icon={<PeopleIcon />}
          meta={queues ? 'هر پرونده سه داور و یک کارفرما' : READ_FAILED}
        />
        <KpiCard
          label="داوری کامل، در انتظار تصمیم"
          tone="success"
          value={countText(queueCount(queues, 'chief_decide'))}
          icon={<TickCircleIcon />}
          meta={queues ? 'تصمیم پیشروی یا رد با شماست' : READ_FAILED}
        />
        <KpiCard
          label="پرونده‌های رویداد"
          value={counts ? fa(counts.total) : '—'}
          icon={<RequestsIcon />}
          accessory={months ? <Sparkline values={months.map((month) => month.submitted)} /> : null}
          meta={thisWeek ? `${fa(thisWeek.submitted)} پرونده در ${thisWeek.label}` : READ_FAILED}
        />
      </KpiGrid>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <FunnelCard
          title="مسیر درخواست‌ها در رویداد"
          subtitle="تعداد پرونده‌هایی که به هر مرحله رسیده‌اند"
          steps={
            funnelReady
              ? [
                  { label: 'ثبت‌شده', value: submitted },
                  { label: 'پذیرفته در بررسی اولیه', value: triaged.data.total },
                  { label: 'تصمیم به پیشروی', value: advanced.data.total },
                ]
              : undefined
          }
        />
        <NextTasksCard queues={queues} notice={unavailableReasonFor(overview)} />
      </div>

      <ActivityCard
        items={activities.kind === 'ok' ? activities.data.items : undefined}
        notice={unavailableReasonFor(activities)}
      />

      <DataTableCard
        title="لیست درخواست‌های در جریان"
        subtitle="رویدادهایی که سردبیری آن‌ها با شماست"
        href="/dashboard/requests"
        columns={['پرونده', 'شرکت', 'مرحله', 'وضعیت', 'تاریخ ثبت', '']}
        notice={unavailableReasonFor(requests)}
        emptyText="پرونده‌ای در جریان نیست."
        rows={
          requests.kind === 'ok'
            ? requests.data.items.map((item) => {
                const next = CHIEF_ACTIONS.find((candidate) =>
                  item.allowedActions?.includes(candidate.action),
                )
                return {
                  key: item.id,
                  cells: [
                    <CaseCell
                      key="case"
                      id={item.id}
                      title={item.title}
                      trackingCode={item.trackingCode}
                    />,
                    item.owner?.companyName || item.owner?.name || '—',
                    (item.reviewStage && STAGE_LABELS[item.reviewStage]) || '—',
                    <Badge key="status" variant={STATUS_VARIANT[item.status]} size="sm" dot>
                      {REQUEST_STATUS_LABELS[item.status as RequestStatus]}
                    </Badge>,
                    formatDate(item.submissionDate ?? item.createdAt),
                    <RowAction
                      key="action"
                      href={`/dashboard/requests/${encodeURIComponent(item.id)}`}
                      label={next?.label ?? 'مشاهده'}
                      primary={Boolean(next)}
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
