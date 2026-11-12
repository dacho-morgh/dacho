import Link from 'next/link'
import { ActivityCard } from '@/components/dashboard/owner-overview/activity-card'
import { KpiCard } from '@/components/dashboard/owner-overview/kpi-card'
import { EditIcon, LettersIcon, RequestsIcon, ClockBulkIcon } from '@/components/icons'
import { VERIFICATION_HREF } from '@/components/dashboard/requests/verification-item'
import { Badge } from '@/components/ui/badge'
import { Typography } from '@/components/ui/typography'
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
import { STATUS_VARIANT } from './case-list'
import { CompanyOnboardingCard, openEvents, type OpenEventDto } from './company-onboarding-card'
import { CaseCell, DataTableCard, RowAction, type DataTableRow } from './data-table-card'
import { KpiGrid, OverviewShell } from './overview-shell'
import {
  READ_FAILED,
  countText,
  fa,
  greeting,
  queueCount,
  type RoleOverviewDto,
} from './shared'

const VERIFICATION_BADGE: Record<
  CompanyVerificationDto['status'],
  { label: string; variant: 'green' | 'yellow' | 'red' | 'secondary' | 'gray' }
> = {
  unsubmitted: { label: 'ارسال نشده', variant: 'gray' },
  pending: { label: 'در انتظار بررسی', variant: 'secondary' },
  returned: { label: 'برگشت داده شده', variant: 'yellow' },
  rejected: { label: 'رد شده', variant: 'red' },
  approved: { label: 'تأیید شده', variant: 'green' },
}

/** The verification leads the company's requests: its own case, followed on its own page. */
function verificationTableRow(verification: CompanyVerificationDto): DataTableRow {
  const badge = VERIFICATION_BADGE[verification.status]
  const needsAction = verification.status === 'unsubmitted' || verification.status === 'returned'
  return {
    key: 'company-verification',
    cells: [
      <Link
        key="case"
        href={VERIFICATION_HREF}
        className="flex flex-col rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
      >
        <Typography as="span" variant="14/semibold" color="neutral-800">
          درخواست احراز هویت شرکت
        </Typography>
        <Typography as="span" variant="12/regular" color="neutral-500">
          پیگیری روند بررسی دبیرخانه
        </Typography>
      </Link>,
      'احراز هویت',
      'بررسی دبیرخانه',
      <Badge key="status" variant={badge.variant} size="sm" dot>
        {badge.label}
      </Badge>,
      verification.submittedAt ? formatDate(verification.submittedAt) : '—',
      <RowAction
        key="action"
        href={VERIFICATION_HREF}
        label={needsAction ? 'تکمیل و ارسال' : 'مشاهده'}
        primary={needsAction}
      />,
    ],
  }
}

/** The request's next move for the company, from the state the server reports. */
function nextAction(item: RequestDto): { label: string; primary: boolean } {
  if (item.status === 'draft') return { label: 'ادامه ویرایش', primary: true }
  if (item.status === 'action_needed') return { label: 'اصلاح', primary: true }
  return { label: 'مشاهده', primary: false }
}

/** Company representative: own requests, what needs action and letters. */
export async function CompanyOverview({ userName }: { userName?: string | null }) {
  const now = new Date()
  const [overview, requests, activities, letters, unreadTickets, verification, dossier, events] =
    await Promise.all([
      serverDashboardFetchResult<RoleOverviewDto>('/stats/overview'),
      serverDashboardFetchResult<Paginated<RequestDto>>('/requests?limit=5&page=1'),
      serverDashboardFetchResult<Paginated<ActivityDto>>('/activities?limit=4'),
      serverDashboardFetchResult<{ total: number }>('/letters?read=false&limit=1'),
      serverDashboardFetchResult<{ total: number }>('/support?unread=true&limit=1'),
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
  // The profile's gaps come from the dossier; without them an unsent profile reads as ready to send.
  const eligibility =
    verification.kind === 'ok'
      ? deriveEligibility(
          verification.data,
          dossier.kind === 'ok' ? dossier.data.missing : undefined,
        )
      : undefined

  const verificationRow: DataTableRow | undefined =
    verification.kind === 'ok' ? verificationTableRow(verification.data) : undefined

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
          // A support answer is mail too; a failed ticket read only drops its share, the letters still count.
          value={letters.kind === 'ok' ? fa(letters.data.total + (unreadTickets.kind === 'ok' ? unreadTickets.data.total : 0)) : '—'}
          icon={<LettersIcon />}
          meta={letters.kind === 'ok' ? 'نامه‌ها و پاسخ‌های پشتیبانی' : READ_FAILED}
        />
      </KpiGrid>

      <ActivityCard
        items={activities.kind === 'ok' ? activities.data.items : undefined}
        notice={unavailableReasonFor(activities)}
      />

      <DataTableCard
        title="درخواست‌های شرکت"
        subtitle="هر زیرموضوع یک درخواست مستقل دارد"
        href="/dashboard/requests"
        columns={['درخواست', 'خدمت', 'مرحله', 'وضعیت', 'تاریخ ثبت', '']}
        notice={unavailableReasonFor(requests)}
        emptyText="هنوز درخواستی ثبت نکرده‌اید."
        rows={
          requests.kind === 'ok'
            ? [...(verificationRow ? [verificationRow] : []), ...requests.data.items.map((item) => {
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
              })]
            : undefined
        }
      />
    </OverviewShell>
  )
}
