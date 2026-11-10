import { ActivityCard } from '@/components/dashboard/owner-overview/activity-card'
import { KpiCard } from '@/components/dashboard/owner-overview/kpi-card'
import { EditIcon, LettersIcon, RequestsIcon, ClockBulkIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import {
  REQUEST_STATUS_LABELS,
  formatDate,
  type ActivityDto,
  type CompanyVerificationDto,
  type MissingDossierItemsDto,
  type Paginated,
  type RequestDto,
} from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { deriveEligibility } from '@/utilities/participation-eligibility'
import { BreakdownCard } from './breakdown-card'
import { STATUS_VARIANT } from './case-list'
import { BOOTH_ROWS, REQUEST_ROWS, requestValues } from './chart-rows'
import { CompanyOnboardingCard, openEvents, type OpenEventDto } from './company-onboarding-card'
import { CaseCell, DataTableCard, RowAction } from './data-table-card'
import { NextTasksCard } from './next-tasks-card'
import { KpiGrid, OverviewShell } from './overview-shell'
import {
  READ_FAILED,
  chartOf,
  countText,
  fa,
  greeting,
  queueCount,
  type RoleOverviewDto,
} from './shared'
import { StepperCard } from './stepper-card'

type VerificationStatus = CompanyVerificationDto['status']

const MEMBERSHIP_STEPS = [
  { title: 'ثبت‌نام اولیه', description: 'اطلاعات پایه شرکت' },
  { title: 'تکمیل اطلاعات', description: 'مدارک و سوابق' },
  { title: 'احراز هویت', description: 'بررسی دبیرخانه' },
  { title: 'شرکت در رویداد', description: 'ثبت درخواست' },
]

/** Where the company stands in joining: the step it is on, and what the Secretariat said. */
function membership(status: VerificationStatus): {
  current: number
  label: string
  variant: 'green' | 'yellow' | 'red' | 'secondary' | 'gray'
} {
  switch (status) {
    case 'approved':
      return { current: 3, label: 'تأیید شده', variant: 'green' }
    case 'pending':
      return { current: 2, label: 'در انتظار بررسی', variant: 'secondary' }
    case 'returned':
      return { current: 1, label: 'برگشت داده شده', variant: 'yellow' }
    case 'rejected':
      return { current: 1, label: 'رد شده', variant: 'red' }
    default:
      return { current: 1, label: 'ارسال نشده', variant: 'gray' }
  }
}

/** The request's next move for the company, from the state the server reports. */
function nextAction(item: RequestDto): { label: string; primary: boolean } {
  if (item.status === 'draft') return { label: 'ادامه ویرایش', primary: true }
  if (item.status === 'action_needed') return { label: 'اصلاح', primary: true }
  return { label: 'مشاهده', primary: false }
}

/** Company representative: own requests, what needs action, letters and the joining steps. */
export async function CompanyOverview({ userName }: { userName?: string | null }) {
  const now = new Date()
  const [overview, requests, activities, letters, verification, dossier, events] =
    await Promise.all([
      serverDashboardFetchResult<RoleOverviewDto>('/stats/overview'),
      serverDashboardFetchResult<Paginated<RequestDto>>('/requests?limit=5&page=1'),
      serverDashboardFetchResult<Paginated<ActivityDto>>('/activities?limit=4'),
      serverDashboardFetchResult<{ total: number }>('/letters?read=false&limit=1'),
      serverDashboardFetchResult<CompanyVerificationDto>('/profile/verification'),
      serverDashboardFetchResult<{ missing?: MissingDossierItemsDto }>('/profile/dossier'),
      serverDashboardFetchResult<{ items?: OpenEventDto[] }>('/events'),
    ])
  const queues = overview.kind === 'ok' ? overview.data.queues : undefined
  const counts = overview.kind === 'ok' ? overview.data.counts : undefined
  const correction = queueCount(queues, 'company_correction')
  const financial = queueCount(queues, 'company_financial_package')
  const supplementary = queueCount(queues, 'company_supplementary')
  const needAction =
    correction === undefined || financial === undefined || supplementary === undefined
      ? undefined
      : correction + financial + supplementary
  const active = counts ? counts.in_review + counts.action_needed : undefined
  const member = verification.kind === 'ok' ? membership(verification.data.status) : undefined
  // The profile's gaps come from the dossier; without them an unsent profile reads as ready to send.
  const eligibility =
    verification.kind === 'ok'
      ? deriveEligibility(
          verification.data,
          dossier.kind === 'ok' ? dossier.data.missing : undefined,
        )
      : undefined

  return (
    <OverviewShell greeting={greeting(userName, now)}>
      {eligibility ? (
        <CompanyOnboardingCard
          eligibility={eligibility}
          events={events.kind === 'ok' ? openEvents(events.data.items ?? [], now) : undefined}
          eventsNotice={unavailableReasonFor(events)}
        />
      ) : null}

      <KpiGrid>
        <KpiCard
          label="درخواست‌های فعال"
          value={countText(active)}
          icon={<RequestsIcon />}
          meta={counts ? `از ${fa(counts.total)} درخواست شرکت` : READ_FAILED}
        />
        <KpiCard
          label="نیازمند اقدام شما"
          value={countText(needAction)}
          icon={<ClockBulkIcon />}
          meta={
            needAction === undefined
              ? READ_FAILED
              : `${fa(correction ?? 0)} اصلاح، ${fa(financial ?? 0)} مدارک مالی، ${fa(supplementary ?? 0)} مدارک تکمیلی`
          }
        />
        <KpiCard
          label="پیش‌نویس‌های ارسال‌نشده"
          value={countText(queueCount(queues, 'company_draft'))}
          icon={<EditIcon />}
          meta={queues ? 'هنوز برای بررسی فرستاده نشده‌اند' : READ_FAILED}
        />
        <KpiCard
          label="نامه‌های خوانده‌نشده"
          value={letters.kind === 'ok' ? fa(letters.data.total) : '—'}
          icon={<LettersIcon />}
          meta={letters.kind === 'ok' ? 'از دبیرخانه مرکزی' : READ_FAILED}
        />
      </KpiGrid>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <BreakdownCard
          title="وضعیت درخواست‌ها"
          subtitle={counts ? `${fa(counts.total)} درخواست` : 'همه درخواست‌های شرکت'}
          rows={REQUEST_ROWS}
          values={counts ? requestValues(counts) : undefined}
          notice={unavailableReasonFor(overview)}
          emptyText="هنوز درخواستی ثبت نکرده‌اید."
        />
        <BreakdownCard
          title="درخواست‌های غرفه شما"
          subtitle="همه نمایشگاه‌ها، به تفکیک مرحله"
          rows={BOOTH_ROWS}
          values={chartOf(overview.kind === 'ok' ? overview.data : undefined, 'booth_requests')}
          notice={unavailableReasonFor(overview)}
          emptyText="هنوز غرفه‌ای درخواست نکرده‌اید."
        />
        <NextTasksCard
          queues={queues}
          notice={unavailableReasonFor(overview)}
          failed={overview.kind === 'ok' ? overview.data.unavailable : undefined}
        />
      </div>

      <ActivityCard
        items={activities.kind === 'ok' ? activities.data.items : undefined}
        notice={unavailableReasonFor(activities)}
      />

      {member ? (
        <StepperCard
          title="مراحل عضویت شرکت"
          subtitle="وضعیت احراز هویت شرکت شما"
          badge={
            <Badge variant={member.variant} size="sm" dot>
              {member.label}
            </Badge>
          }
          steps={MEMBERSHIP_STEPS}
          current={member.current}
        />
      ) : null}

      <DataTableCard
        title="درخواست‌های شرکت"
        subtitle="هر زیرموضوع یک درخواست مستقل دارد"
        href="/dashboard/requests"
        columns={['درخواست', 'خدمت', 'مرحله', 'وضعیت', 'تاریخ ثبت', '']}
        notice={unavailableReasonFor(requests)}
        emptyText="هنوز درخواستی ثبت نکرده‌اید."
        rows={
          requests.kind === 'ok'
            ? requests.data.items.map((item) => {
                const next = nextAction(item)
                return {
                  key: item.id,
                  cells: [
                    <CaseCell
                      key="case"
                      id={item.id}
                      title={item.title}
                      trackingCode={item.trackingCode}
                    />,
                    item.serviceName,
                    item.currentStep ?? '—',
                    <Badge key="status" variant={STATUS_VARIANT[item.status]} size="sm" dot>
                      {REQUEST_STATUS_LABELS[item.status]}
                    </Badge>,
                    item.submissionDate ? formatDate(item.submissionDate) : '—',
                    <RowAction
                      key="action"
                      href={`/dashboard/requests/${encodeURIComponent(item.id)}`}
                      label={next.label}
                      primary={next.primary}
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
