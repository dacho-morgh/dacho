/**
 * Independent event applications (FE12). One application belongs to one event
 * subtopic; the server enforces uniqueness, RFP freshness, required fields and
 * consent versions. These helpers only find the company's existing drafts,
 * shape the fixed answers and explain the server's refusals in Persian.
 */
import {
  DashboardApiError,
  getRequestRfp,
  listRequests,
  type RequestDto,
} from './dashboard-api'

export interface TeamMember {
  name: string
  role: string
  relation: string
}

/** An existing application of the company, bound by the server to one subtopic and RFP version. */
export interface ExistingApplication {
  request: RequestDto
  subtopicId: string
  rfpVersionId: string
}

const PAGE_SIZE = 50
const MAX_PAGES = 10

/**
 * The company's applications to this event, keyed by subtopic. The subtopic of
 * each request comes from its server-pinned RFP context, never from answers.
 */
export async function loadExistingApplications(eventId: string): Promise<Map<string, ExistingApplication>> {
  const requests: RequestDto[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await listRequests({ eventId, page, limit: PAGE_SIZE })
    requests.push(...(result.items ?? []))
    if (page >= (result.totalPages ?? 1)) break
  }
  const contexts = await Promise.all(
    requests.map(async (request): Promise<ExistingApplication | null> => {
      try {
        const { version } = await getRequestRfp(request.id)
        return { request, subtopicId: version.subtopicId, rfpVersionId: version.id }
      } catch (cause) {
        // A request without an RFP context is not an event application.
        if (cause instanceof DashboardApiError && cause.status === 404) return null
        throw cause
      }
    }),
  )
  // Server order is newest first; keep the first application seen per subtopic.
  const bySubtopic = new Map<string, ExistingApplication>()
  for (const application of contexts) {
    if (application && !bySubtopic.has(application.subtopicId)) bySubtopic.set(application.subtopicId, application)
  }
  return bySubtopic
}

export function emptyTeamMember(): TeamMember {
  return { name: '', role: '', relation: '' }
}

/** The saved team as editable rows; at least one empty row to start from. */
export function teamFromAnswers(value: unknown): TeamMember[] {
  if (!Array.isArray(value)) return [emptyTeamMember()]
  const rows = value.flatMap((member): TeamMember[] => {
    if (!member || typeof member !== 'object') return []
    const { name, role, relation } = member as Record<string, unknown>
    return [{
      name: typeof name === 'string' ? name : '',
      role: typeof role === 'string' ? role : '',
      relation: typeof relation === 'string' ? relation : '',
    }]
  })
  return rows.length > 0 ? rows : [emptyTeamMember()]
}

/** Rows the person actually filled in; the server re-validates the team at submit. */
export function teamForAnswers(team: readonly TeamMember[]): Array<{ name: string; role: string; relation?: string }> {
  return team
    .map((member) => ({ name: member.name.trim(), role: member.role.trim(), relation: member.relation.trim() }))
    .filter((member) => member.name || member.role || member.relation)
    .map(({ name, role, relation }) => (relation ? { name, role, relation } : { name, role }))
}

/** A hint only: a nonempty team whose every listed member has a name and role. */
export function isTeamComplete(team: readonly TeamMember[]): boolean {
  const filled = teamForAnswers(team)
  return filled.length > 0 && filled.every((member) => member.name && member.role)
}

const FIXED_FIELD_LABELS: Record<string, string> = {
  applicationTeam: 'اعضای کلیدی تیم',
  proposalDocuments: 'فایل پروپوزال',
  nonCompeteAcceptance: 'پذیرش توافق‌نامه عدم رقابت',
  eventRulesAcceptance: 'پذیرش قوانین رویداد',
}

/** Persian names of the fields the server reported missing, using the form's own labels where known. */
export function missingFieldLabels(missing: readonly string[], fieldLabels: Record<string, string>): string[] {
  return missing.map((key) => FIXED_FIELD_LABELS[key] ?? fieldLabels[key] ?? key)
}

export function applicationTitle(serviceTitle: string, subtopicTitle: string): string {
  return `${serviceTitle} — ${subtopicTitle}`.slice(0, 250)
}

/** What a failed load of the application workspace means to the representative. */
export function describeWorkspaceLoadFailure(cause: unknown): { kind: 'denied' | 'error'; message: string } {
  if (cause instanceof TypeError) {
    return { kind: 'error', message: 'ارتباط با سرور برقرار نشد. اتصال را بررسی کنید و دوباره تلاش کنید.' }
  }
  if (cause instanceof DashboardApiError) {
    if (cause.status === 401) {
      return { kind: 'error', message: 'نشست شما پایان یافته است. دوباره وارد شوید و سپس همین صفحه را باز کنید.' }
    }
    if (cause.status === 403 || cause.status === 404) {
      return {
        kind: 'denied',
        message: 'ثبت درخواست برای این رویداد فقط برای نماینده شرکت ثبت‌شده امکان‌پذیر است یا رویداد در دسترس حساب شما نیست.',
      }
    }
  }
  return { kind: 'error', message: 'دریافت اطلاعات ثبت‌نام انجام نشد. دوباره تلاش کنید.' }
}
