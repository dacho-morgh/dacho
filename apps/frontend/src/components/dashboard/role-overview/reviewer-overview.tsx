import { ActivityCard } from '@/components/dashboard/owner-overview/activity-card'
import { KpiCard } from '@/components/dashboard/owner-overview/kpi-card'
import {
  DashboardEditIcon,
  DashboardRequestsIcon,
  EventsTimerIcon,
  TickCircleIcon,
} from '@/components/icons'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { formatDate, type ActivityDto, type Paginated } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import {
  ownEvaluationLabel,
  reviewWorkState,
  type ReviewQueueDto,
  type ReviewQueueItemDto,
} from '@/utilities/reviewer-case'
import { CaseCell, DataTableCard, RowAction } from './data-table-card'
import { KpiGrid, OverviewShell } from './overview-shell'
import { READ_FAILED, fa, greeting } from './shared'

function evaluationBadge(item: ReviewQueueItemDto): {
  label: string
  variant: BadgeProps['variant']
} {
  if (!item.evaluation) return { label: ownEvaluationLabel(null), variant: 'secondary' }
  return item.evaluation.state === 'final'
    ? { label: 'نهایی', variant: 'green' }
    : { label: 'پیش‌نویس', variant: 'gray' }
}

/** Open work first, then the most recently assigned. */
function byPriority(a: ReviewQueueItemDto, b: ReviewQueueItemDto): number {
  if (a.actionable !== b.actionable) return a.actionable ? -1 : 1
  return Date.parse(b.assignment.assignedAt) - Date.parse(a.assignment.assignedAt)
}

/** Reviewer and employer: the assigned cases and how far the person's own evaluations are. */
export async function ReviewerOverview({
  userName,
  role,
}: {
  userName?: string | null
  role: 'reviewer' | 'employer-reviewer'
}) {
  const now = new Date()
  const [queue, activities] = await Promise.all([
    serverDashboardFetchResult<ReviewQueueDto>('/review/queue?view=all&page=1&limit=100'),
    serverDashboardFetchResult<Paginated<ActivityDto>>('/activities?limit=4'),
  ])
  const items = queue.kind === 'ok' ? queue.data.items : undefined
  const counts = queue.kind === 'ok' ? queue.data.counts : undefined
  const actionable = items?.filter((item) => item.actionable) ?? []
  const drafts = actionable.filter((item) => item.evaluation?.state === 'draft').length
  const finalized = items?.filter((item) => item.evaluation?.state === 'final').length
  const superseded = items?.filter((item) => reviewWorkState(item) === 'superseded').length
  const waiting = counts?.open
  const roleLabel = role === 'employer-reviewer' ? 'کارفرما' : 'داور'

  return (
    <OverviewShell
      greeting={
        waiting
          ? `${greeting(userName, now)} ${fa(waiting)} ارزیابی منتظر ثبت نهایی شماست.`
          : greeting(userName, now)
      }
    >
      <KpiGrid>
        <KpiCard
          label="در انتظار ثبت نهایی"
          tone="warning"
          value={waiting === undefined ? '—' : fa(waiting)}
          icon={<EventsTimerIcon />}
          meta={
            items
              ? `${fa(drafts)} پیش‌نویس، ${fa(actionable.length - drafts)} شروع‌نشده`
              : READ_FAILED
          }
        />
        <KpiCard
          label="ارزیابی‌های نهایی‌شده"
          tone="success"
          value={finalized === undefined ? '—' : fa(finalized)}
          icon={<TickCircleIcon />}
          meta={items ? `نقش شما: ${roleLabel}` : READ_FAILED}
        />
        <KpiCard
          label="پرونده‌های بسته‌شده"
          value={counts ? fa(counts.closed) : '—'}
          icon={<DashboardRequestsIcon />}
          meta={counts ? `از ${fa(counts.all)} پرونده ارجاع‌شده` : READ_FAILED}
        />
        <KpiCard
          label="نسخه جدیدتر ثبت‌شده"
          value={superseded === undefined ? '—' : fa(superseded)}
          icon={<DashboardEditIcon />}
          meta={items ? 'ارزیابی پیشین در دور جدید شمرده نمی‌شود' : READ_FAILED}
        />
      </KpiGrid>

      <ActivityCard
        items={activities.kind === 'ok' ? activities.data.items : undefined}
        notice={unavailableReasonFor(activities)}
      />

      <DataTableCard
        title="درخواست‌های ارجاع‌شده به شما"
        subtitle="دور داوری جاری هر پرونده"
        href="/dashboard/requests"
        columns={['پرونده', 'شرکت', 'زیرموضوع', 'تاریخ ارجاع', 'ارزیابی من', '']}
        notice={unavailableReasonFor(queue)}
        emptyText="پرونده‌ای به شما ارجاع نشده است."
        rows={items
          ?.slice()
          .sort(byPriority)
          .slice(0, 5)
          .map((item) => {
            const badge = evaluationBadge(item)
            return {
              key: item.requestId,
              cells: [
                <CaseCell
                  key="case"
                  id={item.requestId}
                  title={item.title}
                  trackingCode={item.trackingCode}
                />,
                item.companyName ?? '—',
                item.subtopic?.title ?? '—',
                formatDate(item.assignment.assignedAt),
                <Badge key="status" variant={badge.variant} size="sm" dot>
                  {badge.label}
                </Badge>,
                <RowAction
                  key="action"
                  href={`/dashboard/requests/${encodeURIComponent(item.requestId)}`}
                  label={!item.actionable ? 'مشاهده' : item.evaluation ? 'ادامه' : 'شروع ارزیابی'}
                  primary={item.actionable}
                />,
              ],
            }
          })}
      />
    </OverviewShell>
  )
}
