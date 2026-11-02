import {
  DashboardEventsIcon,
  DashboardRequestsIcon,
  PeopleIcon,
  TickCircleIcon,
} from '@/components/icons'
import { Typography } from '@/components/ui/typography'
import type {
  ActivityDto,
  DashboardOverviewDto,
  Paginated,
  RequestStatus,
} from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { monthlyTrend, percentChange, type TrendDayDto } from '@/utilities/dashboard-trend'
import { ActivityCard } from './activity-card'
import {
  activeEmployees,
  companyVerification,
  openEvents,
  type CompanyRow,
  type EmployeeRow,
  type EventRow,
} from './derive'
import { KpiCard, Sparkline } from './kpi-card'
import { QueueNotices } from './queue-notices'
import { RecentRequestsCard, type RecentRequestRow } from './recent-requests-card'
import { StatusBreakdown } from './status-breakdown'
import { TrendChart } from './trend-chart'

const fa = (value: number) => value.toLocaleString('fa-IR')
const UNAVAILABLE = '—'

const todayFormat = new Intl.DateTimeFormat('fa-IR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Tehran',
})

const STAGE_LABELS: Record<string, string> = {
  chief_triage: 'بررسی اولیه سردبیر',
  triaged: 'داوری',
  advanced: 'مالی و سرمایه‌گذاری',
}

interface AdminRequestItem {
  id: string
  title: string
  trackingCode: string
  status: RequestStatus
  reviewStage?: string | null
  createdAt: string
  submissionDate?: string | null
  owner?: { companyName?: string; name?: string }
}

/** The system owner's overview: every number is read from the dashboard API on each visit. */
export async function OwnerOverview({ userName }: { userName?: string | null }) {
  const now = new Date()
  const [overview, trend, requests, activities, companies, employees, events] = await Promise.all([
    serverDashboardFetchResult<DashboardOverviewDto>('/stats/overview'),
    serverDashboardFetchResult<{ days: TrendDayDto[] }>('/stats/trend'),
    serverDashboardFetchResult<Paginated<AdminRequestItem>>('/admin/requests?limit=5&page=1'),
    serverDashboardFetchResult<Paginated<ActivityDto>>('/activities?limit=4'),
    serverDashboardFetchResult<{ items: CompanyRow[] }>('/admin/companies'),
    serverDashboardFetchResult<{ items: EmployeeRow[] }>('/admin/employees'),
    serverDashboardFetchResult<{ items: EventRow[] }>('/admin/events'),
  ])

  const counts = overview.kind === 'ok' ? overview.data.counts : undefined
  const months = trend.kind === 'ok' ? monthlyTrend(trend.data.days, now) : undefined
  const thisMonth = months?.at(-1)
  const lastMonth = months?.at(-2)
  const change =
    thisMonth && lastMonth ? percentChange(thisMonth.submitted, lastMonth.submitted) : undefined

  const company = companies.kind === 'ok' ? companyVerification(companies.data.items) : undefined
  const staff = employees.kind === 'ok' ? activeEmployees(employees.data.items) : undefined
  const open = events.kind === 'ok' ? openEvents(events.data.items, now) : undefined

  const rows: RecentRequestRow[] | undefined =
    requests.kind === 'ok'
      ? requests.data.items.map((item) => ({
          id: item.id,
          title: item.title,
          trackingCode: item.trackingCode,
          company: item.owner?.companyName || item.owner?.name || '—',
          stage: (item.reviewStage && STAGE_LABELS[item.reviewStage]) || '—',
          status: item.status,
          date: item.submissionDate ?? item.createdAt,
        }))
      : undefined

  return (
    <div className="flex flex-col gap-6 p-4 pb-10 sm:px-8 sm:pt-6">
      <header className="flex flex-col gap-1 ps-14 md:ps-0">
        <Typography as="h1" variant="24/bold" color="neutral-800">
          داشبورد
        </Typography>
        <Typography as="p" variant="14/regular" color="neutral-500">
          {userName ? `سلام ${userName}، ` : 'سلام، '}امروز {todayFormat.format(now)} است.
        </Typography>
      </header>

      <QueueNotices
        queues={overview.kind === 'ok' ? overview.data.queues : undefined}
        notice={unavailableReasonFor(overview)}
      />

      <section
        aria-label="شاخص‌های کلیدی"
        className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4"
      >
        <KpiCard
          label="کل درخواست‌ها"
          value={counts ? fa(counts.total) : UNAVAILABLE}
          icon={<DashboardRequestsIcon />}
          accessory={months ? <Sparkline values={months.map((month) => month.submitted)} /> : null}
          meta={
            change !== undefined && lastMonth ? (
              <>
                <span
                  className={
                    change >= 0 ? 'font-semibold text-success-700' : 'font-semibold text-error-600'
                  }
                >
                  {fa(Math.abs(change))}٪{change >= 0 ? '+' : '−'}
                </span>{' '}
                نسبت به {lastMonth.label}
              </>
            ) : thisMonth ? (
              `${fa(thisMonth.submitted)} درخواست در ${thisMonth.label}`
            ) : (
              'دریافت اطلاعات انجام نشد'
            )
          }
        />
        <KpiCard
          label="شرکت‌های تأییدشده"
          tone="success"
          value={company ? fa(company.approved) : UNAVAILABLE}
          unit={company ? `از ${fa(company.total)}` : undefined}
          icon={<TickCircleIcon />}
          meta={
            company ? `${fa(company.pending)} شرکت در انتظار احراز هویت` : 'دریافت اطلاعات انجام نشد'
          }
        />
        <KpiCard
          label="رویدادهای باز"
          tone="warning"
          value={open !== undefined ? fa(open) : UNAVAILABLE}
          unit={events.kind === 'ok' ? `از ${fa(events.data.items.length)}` : undefined}
          icon={<DashboardEventsIcon />}
          meta={open !== undefined ? 'ثبت درخواست برای آن‌ها باز است' : 'دریافت اطلاعات انجام نشد'}
        />
        <KpiCard
          label="کارکنان فعال"
          value={staff ? fa(staff.total) : UNAVAILABLE}
          icon={<PeopleIcon />}
          meta={
            staff
              ? `${fa(staff.reviewers)} داور، ${fa(staff.chiefs)} سردبیر، ${fa(staff.employersAndExperts)} کارفرما و کارشناس`
              : 'دریافت اطلاعات انجام نشد'
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {months ? <TrendChart points={months} /> : null}
        <ActivityCard
          items={activities.kind === 'ok' ? activities.data.items : undefined}
          notice={unavailableReasonFor(activities)}
        />
      </div>

      {counts ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
          <StatusBreakdown counts={counts} />
        </div>
      ) : null}

      <RecentRequestsCard rows={rows} notice={unavailableReasonFor(requests)} />
    </div>
  )
}
