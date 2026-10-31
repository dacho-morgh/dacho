import type { OperationalRole } from '@cms-core/access/roles'
import Link from 'next/link'

import { InvestmentMemoPanel } from '@/components/dashboard/investment-memo-panel'
import { RequestActionsPanel } from '@/components/dashboard/request-actions-panel'
import { RequestAssignmentPanel } from '@/components/dashboard/request-assignment-panel'
import { SecretariatFollowUpPanel } from '@/components/dashboard/secretariat-follow-up-panel'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  formatDate,
  type EvaluationListDto,
  type RequestAction,
  type RequestDetail,
  type RequestProposalDetail,
  type ReviewRoundDto,
} from '@/utilities/dashboard-api'
import { documentCategoryLabel, type DocumentCategory } from '@/utilities/document-api'

const FINANCIAL_CATEGORIES: DocumentCategory[] = [
  'financialStatements',
  'debtFacilityEvidence',
  'taxInsuranceRecords',
  'contractsOrdersMousCommitments',
  'projectEstimateUseOfFunds',
  'guaranteeCollateral',
]

/** The server already withholds these files; the chief and reviewers also never see their slots. */
const FINANCIAL_AUDIENCE: OperationalRole[] = [
  'system-owner',
  'central-secretariat',
  'investment-reviewer',
  'representative',
]

/** Most specific first; the upload, delete and assign actions are standing rights, not a next step. */
const NEXT_ACTION_LABELS: [RequestAction, string][] = [
  ['triage', 'بررسی اولیه پرونده'],
  ['startReview', 'شروع دور داوری'],
  ['decideReview', 'تصمیم پس از چهار ارزیابی'],
  ['replaceReviewer', 'پیگیری ارزیابی داوران'],
  ['reopen', 'در صورت لزوم، بازگشایی پرونده'],
  ['submit', 'ثبت/ارسال نهایی درخواست'],
  ['correct', 'اصلاح و ارسال دوباره پرونده'],
  ['submitFinancialPackage', 'بارگذاری و ارسال بسته مالی'],
  ['read', 'مشاهده؛ اقدام فعالی برای شما ثبت نشده است'],
]

/** Actions the server allows whose screen has not been built, so they get no button yet. */
const UNBUILT_ACTION_NOTES: Partial<Record<RequestAction, string>> = {
  submit: 'ارسال نهایی این پیش‌نویس از این صفحه هنوز فعال نیست.',
  correct: 'مدارک را می‌توانید جایگزین کنید. ارسال دوباره از این صفحه هنوز فعال نیست و به متن تأییدشده توافق‌نامه‌ها نیاز دارد.',
  submitFinancialPackage: 'ارسال نهایی بسته مالی از این صفحه هنوز فعال نیست.',
  replaceReviewer: 'جایگزینی داور از این صفحه هنوز فعال نیست.',
  replaceEmployer: 'جایگزینی کارفرما از این صفحه هنوز فعال نیست.',
}

const REVIEW_STAGE_LABELS: Record<string, string> = {
  chief_triage: 'بررسی اولیه سردبیر',
  triaged: 'داوری',
  advanced: 'مالی و سرمایه‌گذاری',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'پیش‌نویس',
  in_review: 'در حال بررسی',
  action_needed: 'نیازمند اصلاح',
  approved: 'تایید شده',
  rejected: 'رد شده',
}

const DECISION_LABELS: Record<string, string> = {
  advance: 'انتقال به مرحله مالی',
  return: 'بازگشت برای اصلاح',
  reject: 'رد نهایی',
}

/** Each optional read: null when this role has no such read, `failed` when it did not arrive. */
export type DossierPart<T> = T | null | 'failed'

export interface RequestDossierProps {
  role: OperationalRole
  detail: RequestDetail
  proposal: DossierPart<RequestProposalDetail>
  round: DossierPart<{ round: ReviewRoundDto | null }>
  evaluations: DossierPart<EvaluationListDto>
  /** Company-only sections, rendered above the request details. */
  companySections?: React.ReactNode
}

/**
 * One case for all seven roles. Every value is what the API returned for this person,
 * so a reviewer's response has no owner and an unauthorized file never reaches the page.
 * The role here only chooses which sections and controls exist.
 */
export function RequestDossier({ role, detail, proposal, round, evaluations, companySections }: RequestDossierProps) {
  const { request, owner, timeline, workflow } = detail
  const id = request.id
  const actions = request.allowedActions ?? []
  const isCompany = role === 'representative'
  const seesFinancial = FINANCIAL_AUDIENCE.includes(role)
  const canUpload = actions.includes('uploadDocument')
  const canDelete = actions.includes('deleteDocument')
  // The chief's advancement opens the financial files and closes the proposal for the company.
  const financialStageOpen = request.reviewStage === 'advanced'
  const proposalWritable = !isCompany || !financialStageOpen
  const nextAction = NEXT_ACTION_LABELS.find(([action]) => actions.includes(action))?.[1]
  const unbuiltNotes = actions.flatMap((action) => UNBUILT_ACTION_NOTES[action] ?? [])
  if (role === 'reviewer' || role === 'employer-reviewer') {
    unbuiltNotes.push('فرم ارزیابی از این صفحه هنوز فعال نیست.')
  }
  const proposalDetail = proposal === 'failed' ? null : proposal?.proposal

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-10" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Typography as="h1" variant="24/bold" color="neutral-900">{request.title}</Typography>
          {!isCompany && owner?.name ? (
            <Typography variant="14/regular" color="neutral-500">شرکت: {owner.name}</Typography>
          ) : null}
        </div>
        {(role === 'system-owner' || role === 'central-secretariat') && request.ownerId ? (
          <Button asChild variant="outline" size="40">
            <Link href={`/dashboard/companies/${encodeURIComponent(request.ownerId)}`}>
              <Typography variant="14/regular" className="text-inherit">مشاهده پروفایل شرکت</Typography>
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-3">
        <Field label="کد پیگیری" value={request.trackingCode} mono />
        <Field label="وضعیت" value={STATUS_LABELS[request.status] ?? request.status} />
        <Field label="مرحله" value={stageLabel(request.reviewStage, request.currentStep)} />
        <Field label="نسخه پرونده" value={request.revision ? request.revision.toLocaleString('fa-IR') : '—'} />
        <Field label="اقدام بعدی شما" value={nextAction ?? 'اقدامی برای شما تعریف نشده است'} />
        <Field label="تاریخ ثبت" value={formatDate(request.submissionDate) || 'ثبت نشده'} />
        <Field label="آخرین به‌روزرسانی" value={formatDate(request.updatedAt)} />
      </div>

      <RequestActionsPanel id={id} actions={actions} revision={request.revision} />
      {unbuiltNotes.length ? (
        <ul className="flex flex-col gap-1 rounded-2xl bg-neutral-50 p-4">
          {unbuiltNotes.map((note) => (
            <li key={note}>
              <Typography variant="14/regular" color="neutral-600">{note}</Typography>
            </li>
          ))}
        </ul>
      ) : null}
      {role === 'investment-reviewer' ? <InvestmentMemoPanel id={id} /> : null}

      {companySections}

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <Typography as="h2" variant="20/bold" color="neutral-900">اطلاعات درخواست</Typography>
        {proposal === 'failed' ? (
          <Typography role="alert" variant="14/regular" color="error" className="mt-2">
            دریافت نسخه پروپوزال انجام نشد. صفحه را دوباره بارگذاری کنید.
          </Typography>
        ) : proposalDetail ? (
          <Typography variant="14/regular" color="neutral-500" className="mt-2">
            نسخه پروپوزال: {proposalDetail.revision.toLocaleString('fa-IR')}
          </Typography>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(request.answers ?? {})
            .filter(([key]) => key !== 'applicationTeam')
            .map(([key, value]) => (
              <div key={key} className="rounded-lg bg-neutral-50 p-3">
                <Typography variant="12/regular" color="neutral-500">{key}</Typography>
                <Typography variant="16/regular" color="neutral-800" className="mt-1 break-words">{answerText(value)}</Typography>
              </div>
            ))}
        </div>
        {proposalDetail?.applicationTeam?.length ? (
          <>
            <Typography as="h3" variant="16/semibold" color="neutral-900" className="mt-6">تیم متقاضی</Typography>
            <ul className="mt-2 flex flex-col gap-2">
              {proposalDetail.applicationTeam.map((member, index) => (
                <li key={`${index}-${member.name}`} className="rounded-lg bg-neutral-50 p-3">
                  <Typography variant="14/regular" color="neutral-800">
                    {member.name} · {member.role}{member.relation ? ` · ${member.relation}` : ''}
                  </Typography>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <Typography as="h2" variant="20/bold" color="neutral-900">مدارک درخواست</Typography>
        {seesFinancial ? (
          <Typography variant="14/regular" color="neutral-500">
            مدارک مالی فقط برای شرکت، دبیرخانه، صاحب سیستم و مسئول سرمایه‌گذاریِ منتسب قابل مشاهده است.
          </Typography>
        ) : null}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <PrivateDocumentField
            category="proposal"
            label={documentCategoryLabel('proposal')}
            requestId={id}
            readOnly={!canUpload}
            canUpload={canUpload && proposalWritable}
            canDelete={canDelete && proposalWritable}
          />
          {seesFinancial
            ? FINANCIAL_CATEGORIES.map((category) => (
                <PrivateDocumentField
                  key={category}
                  category={category}
                  label={documentCategoryLabel(category)}
                  requestId={id}
                  readOnly={!canUpload}
                  canUpload={canUpload && (!isCompany || financialStageOpen)}
                  canDelete={canDelete}
                />
              ))
            : null}
        </div>
      </section>

      {round !== null || evaluations !== null ? <ReviewProgress round={round} evaluations={evaluations} /> : null}

      {role === 'system-owner' || role === 'central-secretariat' ? <SecretariatFollowUpPanel id={id} /> : null}
      {actions.includes('assign') ? <RequestAssignmentPanel id={id} /> : null}

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <Typography as="h2" variant="20/bold" color="neutral-900">روند بررسی</Typography>
        {workflow.length ? (
          <ol className="mt-4 space-y-3">
            {workflow.map((step) => {
              const isCurrent = step.title === request.currentStep
              return (
                <li
                  key={`${step.order}-${step.title}`}
                  className={`rounded-lg p-3 ${isCurrent ? 'bg-brand-50' : 'bg-neutral-50'}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <Typography variant="16/regular" className={isCurrent ? 'text-brand-700' : 'text-neutral-800'}>
                    {step.order}. {step.title}
                    {step.roleName ? ` · ${step.roleName}` : ''}
                  </Typography>
                </li>
              )
            })}
          </ol>
        ) : (
          <Typography variant="14/regular" color="neutral-500" className="mt-4">روندی برای این خدمت ثبت نشده است.</Typography>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <Typography as="h2" variant="20/bold" color="neutral-900">تاریخچه</Typography>
        {timeline.length ? (
          <ol className="mt-4 space-y-3">
            {timeline.map((event) => (
              <li key={event.id} className="rounded-lg border border-neutral-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Typography variant="16/regular" color="neutral-800">{event.title}</Typography>
                  <Typography variant="12/regular" color="neutral-400" className="font-mono">{formatDate(event.at)}</Typography>
                </div>
                {event.description ? (
                  <Typography variant="14/regular" color="neutral-600" className="mt-1 whitespace-pre-wrap">{event.description}</Typography>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <Typography variant="14/regular" color="neutral-500" className="mt-4">هنوز رویدادی ثبت نشده است.</Typography>
        )}
      </section>
    </main>
  )
}

/** Oversight only: how far the round is, each final evaluation's scores and the decision taken. */
function ReviewProgress({
  round,
  evaluations,
}: {
  round: DossierPart<{ round: ReviewRoundDto | null }>
  evaluations: DossierPart<EvaluationListDto>
}) {
  const failed = round === 'failed' || evaluations === 'failed'
  const current = round === 'failed' ? null : round?.round
  const finals = evaluations === 'failed' ? [] : (evaluations?.items ?? []).filter((item) => item.state === 'final')
  if (!failed && !current) return null

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-6">
      <Typography as="h2" variant="20/bold" color="neutral-900">دور داوری</Typography>
      {failed ? (
        <Typography role="alert" variant="14/regular" color="error">دریافت اطلاعات داوری انجام نشد. صفحه را دوباره بارگذاری کنید.</Typography>
      ) : null}
      {current ? (
        <>
          <Typography variant="14/regular" color="neutral-700">
            ارزیابی نهایی: {current.completion.finalized.toLocaleString('fa-IR')} از {current.completion.required.toLocaleString('fa-IR')} · نسخه پروپوزال {current.proposalRevision.toLocaleString('fa-IR')}
          </Typography>
          {finals.length ? (
            <ul className="flex flex-col gap-2">
              {finals.map((item) => (
                <li key={item.id} className="rounded-lg bg-neutral-50 p-3">
                  <Typography variant="14/semibold" color="neutral-800">
                    {item.variant === 'employer' ? 'ارزیابی کارفرما' : 'ارزیابی داور'}
                    {' · '}
                    امتیاز {((item.weightedHundredths ?? 0) / 100).toLocaleString('fa-IR')}
                  </Typography>
                  <Typography variant="12/regular" color="neutral-500">نهایی‌شده در {formatDate(item.finalizedAt)}</Typography>
                </li>
              ))}
            </ul>
          ) : null}
          {current.decision ? (
            <Typography variant="14/regular" color="neutral-700" className="whitespace-pre-wrap">
              تصمیم: {DECISION_LABELS[current.decision.action] ?? current.decision.action} · {formatDate(current.decision.decidedAt)}
              {current.decision.reason ? `\n${current.decision.reason}` : ''}
            </Typography>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-3">
      <Typography variant="12/regular" color="neutral-500">{label}</Typography>
      <Typography variant="16/regular" color="neutral-800" className={`mt-1 ${mono ? 'font-mono' : ''}`}>{value}</Typography>
    </div>
  )
}

function stageLabel(stage: string | null | undefined, step: string | null | undefined): string {
  return (stage && REVIEW_STAGE_LABELS[stage]) || step || 'ثبت نشده'
}

function answerText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر'
  if (Array.isArray(value) && value.every((item) => typeof item !== 'object')) return value.join('، ')
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
