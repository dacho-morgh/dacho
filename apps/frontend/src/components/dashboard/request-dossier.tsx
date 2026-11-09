import type { OperationalRole } from '@cms-core/access/roles'

import { ChiefReviewSummary, type SummaryPart } from '@/components/dashboard/chief-review-summary'
import { CollapsibleCard, DetailCard, InfoField, ReadonlyField } from '@/components/dashboard/company-detail/company-detail-parts'
import { InvestmentDossierPanel } from '@/components/dashboard/investment-dossier-panel'
import { RequestActionsPanel } from '@/components/dashboard/request-actions-panel'
import { RequestAssignmentPanel } from '@/components/dashboard/request-assignment-panel'
import { RequestCompanyCard } from '@/components/dashboard/request-detail/request-company-card'
import { RequestDetailShell } from '@/components/dashboard/request-detail/request-detail-shell'
import { RequestCompanyProfileCard } from '@/components/dashboard/request-detail/request-company-profile-card'
import { RequestEventCard, RequestWorkflowStepper } from '@/components/dashboard/request-detail/request-event-card'
import { AnswerFields, RequestFormEmptyState, answerEntries, answerText } from '@/components/dashboard/request-detail/request-fields'
import { RequestCardRow, RequestHistoryCard } from '@/components/dashboard/request-detail/request-history-card'
import type { RequestFormField } from '@/components/dashboard/request-form-field'
import { ReviewAssignmentPanel } from '@/components/dashboard/review-assignment-panel'
import { SecretariatFollowUpPanel } from '@/components/dashboard/secretariat-follow-up-panel'
import { PrivateDocumentField } from '@/components/documents/private-document-field'
import { Typography } from '@/components/ui/typography'
import {
  formatDate,
  type EvaluationListDto,
  type RequestAction,
  type RequestDetail,
  type RequestProposalDetail,
  type RequestVerificationDto,
  type ReviewRoundDto,
  type ReviewRoundHistoryEntry,
} from '@/utilities/dashboard-api'
import { documentCategoryLabel, type DocumentCategory } from '@/utilities/document-categories'
import { companyRequestStage, companyRequestStageLabel, type CompanyRequestStage } from '@/utilities/company-request-stage'
import { companyNextAction } from '@/utilities/request-tracking'
import { formatEventDateRange } from '@/utilities/event-dates'

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
}

const REVIEW_STAGE_LABELS: Record<string, string> = {
  chief_triage: 'بررسی اولیه سردبیر',
  triaged: 'داوری',
  advanced: 'مالی و سرمایه‌گذاری',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'پیش‌نویس',
  in_review: 'در حال بررسی',
  action_needed: 'نیازمند اقدام',
  approved: 'تایید شده',
  rejected: 'رد شده',
}

/** The tag colour of each status, as the design's status tags use them. */
const STATUS_VARIANTS: Record<string, 'gray' | 'primary' | 'success' | 'warning' | 'error'> = {
  draft: 'gray',
  in_review: 'primary',
  action_needed: 'warning',
  approved: 'success',
  rejected: 'error',
}

/** The company's tag colour of each stage (design QA #280), as the list's stage badge. */
const COMPANY_STAGE_VARIANTS: Record<CompanyRequestStage, 'gray' | 'primary'> = {
  verification: 'gray',
  reviewing: 'primary',
  finished: 'gray',
}

/** The event's own status tag, as the events list draws it (design QA #281). */
const EVENT_STATUS: Record<'upcoming' | 'ongoing' | 'past', { label: string; variant: 'secondary' | 'primary' | 'gray' }> = {
  upcoming: { label: 'پیش‌رو', variant: 'secondary' },
  ongoing: { label: 'در حال برگزاری', variant: 'primary' },
  past: { label: 'تمام شده', variant: 'gray' },
}

const fa = (value: number) => value.toLocaleString('fa-IR')

const plainText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** Each optional read: null when this role has no such read, `failed` when it did not arrive. */
export type DossierPart<T> = T | null | 'failed'

export interface RequestDossierProps {
  role: OperationalRole
  detail: RequestDetail
  proposal: DossierPart<RequestProposalDetail>
  round: DossierPart<{ round: ReviewRoundDto | null }>
  evaluations: DossierPart<EvaluationListDto>
  /** Earlier review rounds with their evaluations; oversight roles only. */
  roundHistory?: SummaryPart<ReviewRoundHistoryEntry[]>
  /** The company profile pinned at submission; oversight roles only. */
  profile?: DossierPart<RequestVerificationDto>
  /** Display names of the round's people, resolved on the server for oversight only. */
  people?: Record<string, string>
  /** The employer a new round would take, from the chief's candidate read. */
  roundEmployerId?: string | null
  /** Company-only sections, rendered above the request details. */
  companySections?: React.ReactNode
  /** The company sections include the FE13 correction form, which owns the proposal upload while correcting. */
  correctionHandled?: boolean
  /** The service's form fields, so stored answers show their labels; without them an answer shows its key. */
  formFields?: RequestFormField[]
}

/**
 * One case for all seven roles. Every value is what the API returned for this person,
 * so a reviewer's response has no owner and an unauthorized file never reaches the page.
 * The role here only chooses which sections and controls exist.
 */
export function RequestDossier({
  role,
  detail,
  proposal,
  round,
  evaluations,
  roundHistory = null,
  profile = null,
  people = {},
  roundEmployerId = null,
  companySections,
  correctionHandled = false,
  formFields = [],
}: RequestDossierProps) {
  const { request, timeline, workflow, event, company, companyProfile } = detail
  const id = request.id
  const actions = request.allowedActions ?? []
  const isCompany = role === 'representative'
  const seesFinancial = FINANCIAL_AUDIENCE.includes(role)
  const canUpload = actions.includes('uploadDocument')
  const canDelete = actions.includes('deleteDocument')
  // The chief's advancement opens the financial files and closes the proposal for the company.
  const financialStageOpen = request.reviewStage === 'advanced'
  const proposalWritable = !isCompany || !financialStageOpen
  const nextAction = isCompany
    ? companyNextAction(request)
    : NEXT_ACTION_LABELS.find(([action]) => actions.includes(action))?.[1]
  const correcting = correctionHandled && isCompany && actions.includes('correct')
  const unbuiltNotes = actions.flatMap((action) =>
    correcting && action === 'correct' ? [] : (UNBUILT_ACTION_NOTES[action] ?? []),
  )
  if (role === 'reviewer' || role === 'employer-reviewer') {
    unbuiltNotes.push('فرم ارزیابی از این صفحه هنوز فعال نیست.')
  }
  const proposalDetail = proposal === 'failed' ? null : proposal?.proposal
  const followUp = role === 'system-owner' || role === 'central-secretariat' ? (
    <SecretariatFollowUpPanel id={id} trackingCode={request.trackingCode} />
  ) : null

  const oversight = role === 'system-owner' || role === 'central-secretariat'
  const snapshotCompany = profile && profile !== 'failed' ? profile.verification?.snapshot.company : null
  // The company's own name, never the name of the representative who filed the request: reviewers and the
  // employer are not told who that is, and the card is the company's.
  const companyName = plainText(company?.name) || plainText(snapshotCompany?.name)
  const profileHref = oversight && request.ownerId ? `/dashboard/companies/${encodeURIComponent(request.ownerId)}` : null
  const showsCompanyCard = !isCompany && Boolean(companyName || profileHref)
  // The company and the admin pages open with the application card and its stepper; the others keep the stepper in a fold below.
  const showsEventCard = isCompany || oversight
  const pageTitle = !isCompany && companyName ? `درخواست ${companyName}` : request.title
  // A company reads its three stages only, never the internal status; staff keep the real one.
  const statusLabel = isCompany ? companyRequestStageLabel(request) : (STATUS_LABELS[request.status] ?? request.status)
  const statusVariant = isCompany ? COMPANY_STAGE_VARIANTS[companyRequestStage(request)] : (STATUS_VARIANTS[request.status] ?? 'gray')
  // The event card's tag is the event's own, as in the design; a request whose event the CMS did not answer keeps the case status.
  const eventStatus = event?.status ? EVENT_STATUS[event.status] : null
  const companyType = plainText(company?.type) || plainText(snapshotCompany?.type)
  const companyStatus = plainText(company?.status) || (company?.active === true ? 'فعال' : company?.active === false ? 'غیرفعال' : '')
  const companyAge = typeof company?.ageYears === 'number' ? `${fa(company.ageYears)} سال` : ''
  // «فعال | نوع | سن» (Figma 49:7968); a reader who gets no status or age (reviewer, employer) sees the type and place.
  const companyFacts =
    companyStatus || companyAge
      ? [companyStatus, companyType, companyAge]
      : [...new Set([companyType, plainText(company?.province) || plainText(snapshotCompany?.province), plainText(company?.city) || plainText(snapshotCompany?.city)])]
  const submitted = formatDate(request.submissionDate)
  const heldDates = formatEventDateRange(event?.startDate, event?.endDate)
  const eventFacts = [
    ...(heldDates ? [{ icon: 'calendar' as const, text: heldDates }] : []),
    ...(event?.location ? [{ icon: 'location' as const, text: event.location }] : []),
    { icon: 'document' as const, text: `کد پیگیری: ${request.trackingCode}` },
    ...(submitted ? [{ icon: 'calendar' as const, text: `تاریخ ثبت: ${submitted}` }] : []),
  ]
  // Names of the round's people come with the slots (#288); the account lookup only fills what a slot lacks.
  const roundNames = slotNames(round, roundHistory)
  const names = { ...people, ...roundNames }
  const answers = answerEntries(request.answers, formFields)
  const team = proposalDetail?.applicationTeam ?? []
  const FormCard = isCompany ? CollapsibleCard : DetailCard

  return (
    <RequestDetailShell title={pageTitle}>
      {showsCompanyCard ? (
        <RequestCompanyCard
          name={companyName || 'شرکت متقاضی'}
          logoUrl={company?.logo?.url ?? null}
          facts={companyFacts}
          profileHref={profileHref}
        />
      ) : null}

      {showsEventCard ? (
        <RequestEventCard
          title={event?.title || request.title}
          titleAsHeading={!isCompany}
          statusLabel={eventStatus?.label ?? statusLabel}
          statusVariant={eventStatus?.variant ?? statusVariant}
          image={event?.image ?? null}
          facts={eventFacts}
          workflow={workflow}
          currentStep={request.currentStep}
        />
      ) : null}

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
      {role === 'investment-reviewer' ? <InvestmentDossierPanel id={id} /> : null}
      {/* At the financial stage the follow-up is the Secretariat's main work (Figma 03, 04), so it leads. */}
      {followUp && financialStageOpen ? followUp : null}

      {companySections}

      {/* The history and the people of the round side by side (Figma 31885:6726); either one alone takes the row. */}
      <RequestCardRow>
        <RequestHistoryCard
          timeline={timeline}
          statusLabel={statusLabel}
          statusVariant={statusVariant}
          staffLabel={isCompany ? 'کارکنان صندوق' : null}
        />
        <ReviewAssignmentPanel
          id={id}
          actions={actions}
          revision={request.revision}
          proposalRevision={proposalDetail?.revision ?? null}
          round={round}
          evaluations={evaluations}
          people={names}
          employerId={roundEmployerId}
        />
      </RequestCardRow>
      {round !== null || evaluations !== null ? (
        <ChiefReviewSummary
          round={round}
          evaluations={evaluations}
          history={roundHistory}
          people={names}
          canDecide={actions.includes('decideReview')}
        />
      ) : null}

      {followUp && !financialStageOpen ? followUp : null}
      {actions.includes('assign') ? <RequestAssignmentPanel id={id} /> : null}

      <DetailCard title="خلاصه پرونده">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {showsEventCard ? null : <InfoField label="کد پیگیری" value={<bdi className="font-mono">{request.trackingCode}</bdi>} />}
          <InfoField label="وضعیت" value={statusLabel} />
          {isCompany ? null : <InfoField label="مرحله" value={stageLabel(request.reviewStage, request.currentStep)} />}
          <InfoField label="نسخه پرونده" value={request.revision ? request.revision.toLocaleString('fa-IR') : '—'} />
          <InfoField label="اقدام بعدی شما" value={nextAction ?? 'اقدامی برای شما تعریف نشده است'} />
          {showsEventCard ? null : <InfoField label="تاریخ ثبت" value={submitted || 'ثبت نشده'} />}
          <InfoField label="آخرین به‌روزرسانی" value={formatDate(request.updatedAt)} />
        </div>
      </DetailCard>

      {profile !== null ? <ProfileSnapshot profile={profile} /> : null}

      <FormCard title="اطلاعات و فرم رویداد">
        {proposal === 'failed' ? (
          <Typography role="alert" variant="14/regular" color="error">
            دریافت نسخه پروپوزال انجام نشد. صفحه را دوباره بارگذاری کنید.
          </Typography>
        ) : proposalDetail ? (
          <div className="flex flex-col gap-1">
            <Typography variant="14/regular" color="neutral-500">
              نسخه پروپوزال: {proposalDetail.revision.toLocaleString('fa-IR')}
            </Typography>
            {!isCompany ? (
              <Typography variant="14/regular" color="neutral-500">
                نسخه ثبت‌شده در {formatDate(proposalDetail.createdAt)}
                {proposalDetail.proposalDocuments.length
                  ? ` · فایل پروپوزال: ${proposalDetail.proposalDocuments.map((file) => file.filename).join('، ')}`
                  : ''}
              </Typography>
            ) : null}
          </div>
        ) : null}
        {answers.length ? <AnswerFields entries={answers} tone={isCompany ? 'input' : 'readonly'} /> : null}
        {team.length ? (
          <div className="flex flex-col gap-3">
            <Typography as="h3" variant="16/semibold" color="neutral-800">تیم متقاضی</Typography>
            <ul className="flex flex-col gap-2">
              {team.map((member, index) => (
                <li key={`${index}-${member.name}`} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                  <Typography variant="14/regular" color="neutral-800">
                    {member.name} · {member.role}{member.relation ? ` · ${member.relation}` : ''}
                  </Typography>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {!answers.length && !team.length && proposal !== 'failed' ? (
          <RequestFormEmptyState audience={!isCompany ? 'staff' : request.status === 'draft' ? 'company-draft' : 'company'} />
        ) : null}
      </FormCard>

      {isCompany && companyProfile ? <RequestCompanyProfileCard profile={companyProfile} /> : null}

      <DetailCard title="مدارک درخواست">
        {seesFinancial ? (
          <Typography variant="14/regular" color="neutral-500">
            مدارک مالی فقط برای شرکت، دبیرخانه، صاحب سیستم و مسئول سرمایه‌گذاریِ منتسب قابل مشاهده است.
          </Typography>
        ) : null}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {correcting ? null : (
            <PrivateDocumentField
              category="proposal"
              label={documentCategoryLabel('proposal')}
              requestId={id}
              readOnly={!canUpload}
              canUpload={canUpload && proposalWritable}
              canDelete={canDelete && proposalWritable}
            />
          )}
          {/* The company uploads in the package form and the investment person reads the frozen package (S6). */}
          {seesFinancial && !isCompany && role !== 'investment-reviewer'
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
      </DetailCard>

      {showsEventCard ? null : (
        <CollapsibleCard title="روند بررسی" defaultOpen={false}>
          <RequestWorkflowStepper workflow={workflow} currentStep={request.currentStep} />
        </CollapsibleCard>
      )}
    </RequestDetailShell>
  )
}

const PROFILE_FIELDS: [section: 'company' | 'dossier', key: string, label: string][] = [
  ['company', 'name', 'نام شرکت'],
  ['company', 'nationalId', 'شناسه ملی'],
  ['company', 'type', 'نوع شرکت'],
  ['company', 'province', 'استان'],
  ['company', 'city', 'شهر'],
  ['dossier', 'legalEntityType', 'نوع شخصیت حقوقی'],
  ['dossier', 'classification', 'طبقه‌بندی شرکت'],
  ['dossier', 'activityDomain', 'حوزه فعالیت اصلی'],
  ['dossier', 'productsServices', 'محصولات و خدمات'],
]

/**
 * The profile as it was when the company submitted, not the live profile: only the
 * fields every reviewing role may see, whatever the snapshot holds for this reader.
 */
function ProfileSnapshot({ profile }: { profile: DossierPart<RequestVerificationDto> }) {
  return (
    <DetailCard title="اطلاعات شرکت">
      {profile === 'failed' ? (
        <Typography role="alert" variant="14/regular" color="error">
          دریافت پروفایل ثبت‌شده شرکت انجام نشد. صفحه را دوباره بارگذاری کنید.
        </Typography>
      ) : profile?.verification ? (
        <>
          <Typography variant="14/regular" color="neutral-500">
            اطلاعات در زمان ثبت · نسخه {profile.verification.revision.toLocaleString('fa-IR')} پروفایل تأییدشده · ثبت در {formatDate(profile.verification.createdAt)}
          </Typography>
          <div className="grid gap-4 sm:grid-cols-2">
            {PROFILE_FIELDS.map(([section, key, label]) => (
              <ReadonlyField key={`${section}.${key}`} label={label} value={answerText(profile.verification?.snapshot[section]?.[key])} />
            ))}
          </div>
        </>
      ) : (
        <Typography variant="14/regular" color="neutral-500">پروفایلی همراه این درخواست ثبت نشده است.</Typography>
      )}
    </DetailCard>
  )
}

function stageLabel(stage: string | null | undefined, step: string | null | undefined): string {
  return (stage && REVIEW_STAGE_LABELS[stage]) || step || 'ثبت نشده'
}

/** Display names the round responses carry on their slots (#288), current round and earlier ones. */
function slotNames(
  round: DossierPart<{ round: ReviewRoundDto | null }>,
  history: SummaryPart<ReviewRoundHistoryEntry[]>,
): Record<string, string> {
  const slots = [
    ...(round && round !== 'failed' ? (round.round?.slots ?? []) : []),
    ...(history && typeof history === 'object' ? history.flatMap((entry) => entry.round.slots ?? []) : []),
  ]
  return Object.fromEntries(slots.flatMap((slot) => (slot.name?.trim() ? [[slot.userId, slot.name.trim()]] : [])))
}
