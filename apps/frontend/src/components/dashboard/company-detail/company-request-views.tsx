import Link from 'next/link'
import { CalendarBulkIcon, TickCircleIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import type { CompanyDetailResponse } from '@/components/dashboard/company-detail-view'
import type { RequestFormField } from '@/components/dashboard/request-form-field'
import { REQUEST_STATUS_LABELS, formatDate, type RequestDetail } from '@/utilities/dashboard-api'
import { cn } from '@/utilities/ui'
import { CollapsibleCard, InfoField, ReadonlyField } from './company-detail-parts'
import { CompanyDetailShell } from './company-detail-shell'
import { EvaluationScoreCard } from './evaluation-score-card'

interface RequestViewProps {
  companyId: string
  company: CompanyDetailResponse
  detail: RequestDetail
  fields: RequestFormField[]
}

const answerText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(answerText).join('، ')
  return JSON.stringify(value)
}

/** The request's stored answers, labelled by the service's form when the CMS still has it. */
function requestAnswers({ detail, fields }: Pick<RequestViewProps, 'detail' | 'fields'>): { label: string; value: string }[] {
  const answers = detail.request.answers ?? {}
  const known = fields
    .filter((field) => field.name in answers)
    .map((field) => ({ label: field.label || field.name, value: answerText(answers[field.name]) }))
  const knownNames = new Set(fields.map((field) => field.name))
  const extra = Object.entries(answers)
    .filter(([name]) => !knownNames.has(name))
    .map(([name, value]) => ({ label: name, value: answerText(value) }))
  return [...known, ...extra]
}

function companyEntries(company: CompanyDetailResponse): { label: string; value: string }[] {
  const info = company.company
  return [
    { label: 'نام شرکت', value: info?.name ?? '' },
    { label: 'نوع شرکت', value: info?.type ?? '' },
    { label: 'وضعیت شرکت', value: info?.status ?? '' },
    { label: 'شماره ثبت', value: info?.registrationNumber ?? '' },
    { label: 'کد اقتصادی', value: info?.economicCode ?? '' },
    { label: 'شناسه ملی', value: info?.nationalId ?? '' },
  ]
}

type StepState = 'done' | 'current' | 'upcoming'

/** Where each workflow step stands, from the step the server says the request is on. */
function RequestStepper({ detail }: { detail: RequestDetail }) {
  const steps = [...detail.workflow].sort((a, b) => a.order - b.order)
  const { currentStepIndex, status } = detail.request
  const stateOf = (index: number): StepState =>
    status === 'approved' || index < currentStepIndex ? 'done' : index === currentStepIndex ? 'current' : 'upcoming'

  if (steps.length === 0) {
    return (
      <Typography variant="14/regular" color="muted">
        مراحل این درخواست هنوز تعریف نشده است.
      </Typography>
    )
  }

  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const state = stateOf(index)
        return (
          <li key={`${step.order}-${step.title}`} className="flex items-stretch gap-4">
            <div className="flex w-6 shrink-0 flex-col items-center">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full',
                  state === 'done' && 'bg-success-500 text-white',
                  state === 'current' && 'bg-brand-500 text-white',
                  state === 'upcoming' && 'bg-neutral-200 text-neutral-500',
                )}
              >
                {state === 'done' ? (
                  <TickCircleIcon className="size-6" aria-hidden="true" />
                ) : (
                  <Typography as="span" variant="14/semibold" className="text-inherit">
                    {(index + 1).toLocaleString('fa-IR')}
                  </Typography>
                )}
              </span>
              {index < steps.length - 1 ? (
                <span aria-hidden="true" className={cn('w-px flex-1', state === 'done' ? 'bg-success-500' : 'bg-neutral-200')} />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 pb-8">
              <Typography as="span" variant="16/semibold" color="secondary" aria-current={state === 'current' ? 'step' : undefined}>
                {step.title}
              </Typography>
              <Typography as="span" variant="14/regular" color="muted">
                مسئول مرحله: {step.roleName}
              </Typography>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function EventInfoCard({ detail }: { detail: RequestDetail }) {
  const { request } = detail
  return (
    <CollapsibleCard title="اطلاعات رویداد">
      <div className="flex flex-col gap-4">
        <Badge variant={request.status === 'in_review' ? 'primary' : 'gray'}>
          {REQUEST_STATUS_LABELS[request.status]}
        </Badge>
        <Typography as="h3" variant="20/bold" color="neutral-700">
          {request.title}
        </Typography>
      </div>
      <div className="flex items-center gap-2">
        <CalendarBulkIcon className="size-7 shrink-0 text-neutral-400" aria-hidden="true" />
        <Typography as="span" variant="16/semibold" color="secondary">
          تاریخ ثبت: {formatDate(request.submissionDate ?? request.createdAt) || '—'} | سررسید:{' '}
          {formatDate(request.dueDate) || '—'}
        </Typography>
      </div>
    </CollapsibleCard>
  )
}

/** The company's view of one request (Figma 30950:9992 and 30950:17783). */
export function CompanyRequestView({ companyId, company, detail, fields }: RequestViewProps) {
  const { request } = detail
  const companyName = company.company?.name
  const canEvaluate = request.allowedActions?.some((action) => action === 'triage' || action === 'decideReview') ?? false
  const answers = requestAnswers({ detail, fields })

  return (
    <CompanyDetailShell id={companyId} companyName={companyName} active="requests">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Typography as="h2" variant="24/bold" color="neutral-700" className="min-w-0 flex-1 break-words">
          درخواست {companyName || '—'}
        </Typography>
        {canEvaluate ? (
          <Button asChild variant="primary" size="40" className="px-4">
            <Link
              href={`/dashboard/companies/${encodeURIComponent(companyId)}/requests/${encodeURIComponent(request.id)}/evaluation`}
            >
              ارزیابی درخواست
            </Link>
          </Button>
        ) : null}
      </div>

      <EventInfoCard detail={detail} />

      <CollapsibleCard title="وضعیت درخواست">
        <RequestStepper detail={detail} />
      </CollapsibleCard>

      <CollapsibleCard title="اطلاعات و فرم رویداد">
        {answers.length > 0 ? (
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            {answers.map((answer) => (
              <ReadonlyField key={answer.label} label={answer.label} value={answer.value} />
            ))}
          </div>
        ) : (
          <Typography variant="14/regular" color="muted">
            پاسخی برای این درخواست ثبت نشده است.
          </Typography>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="رزومه و اطلاعات شرکت">
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          {companyEntries(company).map((entry) => (
            <ReadonlyField key={entry.label} label={entry.label} value={entry.value} />
          ))}
        </div>
      </CollapsibleCard>
    </CompanyDetailShell>
  )
}

/** The evaluation form of one request (Figma 30584:21543). */
export function CompanyEvaluationView({ companyId, company, detail, fields }: RequestViewProps) {
  const { request } = detail
  const answers = requestAnswers({ detail, fields })
  const requestHref = `/dashboard/companies/${encodeURIComponent(companyId)}/requests/${encodeURIComponent(request.id)}`

  return (
    <CompanyDetailShell id={companyId} companyName={company.company?.name} active="requests">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Typography as="h2" variant="24/bold" color="neutral-700">
            فرم ارزیابی
          </Typography>
          <Typography as="span" variant="16/regular" color="muted" aria-hidden="true">
            /
          </Typography>
          <Link href={requestHref}>
            <Typography as="span" variant="16/regular" color="muted">
              صفحه درخواست
            </Typography>
          </Link>
        </div>
        <Typography as="h3" variant="20/bold" color="neutral-700">
          {request.title}
        </Typography>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <CollapsibleCard title="اطلاعات و فرم رویداد" className="gap-5">
            {answers.length > 0 ? (
              answers.map((answer) => <InfoField key={answer.label} label={answer.label} value={answer.value || '—'} />)
            ) : (
              <Typography variant="14/regular" color="muted">
                پاسخی برای این درخواست ثبت نشده است.
              </Typography>
            )}
          </CollapsibleCard>
          <CollapsibleCard title="رزومه و اطلاعات شرکت" className="gap-5">
            {companyEntries(company).map((entry) => (
              <InfoField key={entry.label} label={entry.label} value={entry.value || '—'} />
            ))}
          </CollapsibleCard>
        </div>
        <EvaluationScoreCard
          requestId={request.id}
          revision={request.revision}
          allowedActions={request.allowedActions ?? []}
          requestHref={requestHref}
        />
      </div>
    </CompanyDetailShell>
  )
}
