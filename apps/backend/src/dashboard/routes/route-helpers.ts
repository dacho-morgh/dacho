import { allowedEventActions } from '../../access/events.js'
import { allowedRequestActions } from '../../access/policy.js'
import { operationalRoleOf, type OperationalRole } from '../../access/roles.js'
import type { ServiceDefinition } from '../../catalog/service-catalog.js'
import type { ReviewCaseFile } from '../review-case-repo.js'
import type { EventConfiguration, EventInput } from '../event-repo.js'
import { RequestRepository, type RequestFilters, type ReviewStage } from '../request-repo.js'
import { isRequestWorkQueueOf } from '../work-queues.js'
import type { User, UserStore } from '../../auth/user-store.js'
import { isUuid } from '../../exhibitions/catalogue.js'

export const MAX_REQUEST_SEARCH_LENGTH = 100
export const REVIEW_STAGES: readonly unknown[] = ['chief_triage', 'triaged', 'advanced']

/** The list and count filters, or the error code of the first invalid one. A queue of another role is invalid. */
export function parseRequestFilters(
  query: Record<string, unknown>,
  actor: { id: string; operationalRole: OperationalRole },
): RequestFilters | string {
  const filters: RequestFilters = {}
  if (query.search !== undefined) {
    const search = typeof query.search === 'string' ? query.search.trim() : null
    if (search === null || search.length > MAX_REQUEST_SEARCH_LENGTH) return 'invalid_search'
    if (search) filters.search = search
  }
  if (query.eventId !== undefined) {
    if (typeof query.eventId !== 'string' || !isUuid(query.eventId)) return 'invalid_event_id'
    filters.eventId = query.eventId
  }
  if (query.ownerId !== undefined) {
    if (typeof query.ownerId !== 'string' || !/^\d{1,10}$/.test(query.ownerId)) return 'invalid_owner_id'
    filters.ownerId = query.ownerId
  }
  if (query.stage !== undefined) {
    if (!REVIEW_STAGES.includes(query.stage)) return 'invalid_stage'
    filters.reviewStage = query.stage as ReviewStage
  }
  if (query.queue !== undefined) {
    if (!isRequestWorkQueueOf(actor.operationalRole, query.queue)) return 'invalid_queue'
    filters.queue = { key: query.queue, actorId: actor.id, role: actor.operationalRole }
  }
  return filters
}

export function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return n
}

/** Nine digits at most, so the value always fits the integer revision column. */
export function parseRevisionQuery(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,8}$/.test(value)) return null
  return Number(value)
}

/** Consent counts only when the submit itself accepts the exact current text. */
export function acceptsAgreementVersion(value: unknown, currentVersion: string): boolean {
  if (!value || typeof value !== 'object') return false
  const { accepted, textVersionId } = value as { accepted?: unknown; textVersionId?: unknown }
  return accepted === true && textVersionId === currentVersion
}

export function parseBoolean(value: unknown): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

export function eventUpdateBody(body: unknown): Record<string, unknown> | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  return body as Record<string, unknown>
}

export function parseEventRevision(body: unknown): number | null {
  const revision = eventUpdateBody(body)?.revision
  return typeof revision === 'number' && Number.isInteger(revision) && revision > 0
    ? revision
    : null
}

export function parseEventReason(body: unknown): string | null {
  const reason = eventUpdateBody(body)?.reason
  if (typeof reason !== 'string') return null
  const trimmed = reason.trim()
  return trimmed ? trimmed : null
}

export function isRepresentative(role: string): boolean {
  return role === 'representative'
}

export function isCompanyAdministrator(role: string): boolean {
  return role === 'system-owner' || role === 'central-secretariat'
}

export function requesterDisplayName(user: Awaited<ReturnType<UserStore['findById']>>): string {
  return user?.name || 'شرکت متقاضی'
}

export function safeOwner(user: User | undefined | null) {
  return user ? { id: user.id, name: user.name ?? null } : null
}

/** Adds the download routes to a case file's proposal and RFP; each route still authorizes its reader. */
export function withDownloadUrls(requestId: string, found: Pick<ReviewCaseFile, 'proposal' | 'rfp'>) {
  return {
    proposal: found.proposal && {
      ...found.proposal,
      documents: found.proposal.documents.map((document) => ({
        ...document,
        downloadUrl: `/api/dashboard/documents/${document.id}/download`,
      })),
    },
    rfp: found.rfp && {
      ...found.rfp,
      files: found.rfp.files.map((file) => ({
        ...file,
        downloadUrl: `/api/dashboard/requests/${requestId}/rfp/files/${file.id}`,
      })),
    },
  }
}

export function requestWithActions(
  role: Parameters<typeof allowedRequestActions>[0],
  actorId: string,
  request: Awaited<ReturnType<RequestRepository['findByIdAny']>>,
  companyId?: string | null,
  actorIsResponsibleChief = false,
  reviewRoundStarted = false,
  reviewRoundComplete = false,
  financialPackageSubmitted = false,
) {
  if (!request) return request
  return {
    ...request,
    allowedActions: allowedRequestActions(
      role,
      { ...request, actorIsResponsibleChief, reviewRoundStarted, reviewRoundComplete, financialPackageSubmitted },
      actorId,
      companyId,
    ),
  }
}

export function parseExpectedRevision(value: unknown): number | undefined | null {
  if (value === undefined) return undefined
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : null
}

/** Optional free-text reason: undefined/blank -> null, a non-string or over-long value -> false. */
export function parseOptionalReason(value: unknown): string | null | false {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length > 1000) return false
  return trimmed ? trimmed : null
}

export function parseDecisionReason(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export type EventValidation =
  | { ok: true; input: EventInput }
  | { ok: false; error: 'invalid_event'; fields: string[] }
  | { ok: false; error: 'invalid_registration_window' }

export function normalizeEventInput(body: unknown, existing?: EventConfiguration): EventValidation {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'invalid_event', fields: [] }
  }
  const source = body as Record<string, unknown>
  const valueOf = (key: keyof EventInput, fallback: unknown): unknown =>
    key in source ? source[key] : fallback

  const titleValue = valueOf('title', existing?.title)
  const title = typeof titleValue === 'string' ? titleValue.trim() : ''
  const descriptionValue = valueOf('description', existing?.description ?? '')
  const description = typeof descriptionValue === 'string' ? descriptionValue.trim() : null
  const openValue = valueOf('registrationOpenAt', existing?.registrationOpenAt)
  const openText = typeof openValue === 'string' ? openValue.trim() : ''
  const closeValue = valueOf('registrationCloseAt', existing?.registrationCloseAt)
  const closeText = typeof closeValue === 'string' ? closeValue.trim() : ''
  const chiefValue = valueOf('responsibleChiefId', existing?.responsibleChiefId)
  const chiefId = typeof chiefValue === 'string' ? chiefValue.trim() : ''
  const investmentValue = valueOf('responsibleInvestmentId', existing?.responsibleInvestmentId)
  const investmentId = typeof investmentValue === 'string' ? investmentValue.trim() : ''

  const fields: string[] = []
  if (!title) fields.push('title')
  if (description === null) fields.push('description')
  if (!openText) fields.push('registrationOpenAt')
  if (!closeText) fields.push('registrationCloseAt')
  if (!chiefId) fields.push('responsibleChiefId')
  if (!investmentId) fields.push('responsibleInvestmentId')
  if (fields.length > 0) return { ok: false, error: 'invalid_event', fields }

  const open = Date.parse(openText)
  const close = Date.parse(closeText)
  if (!Number.isFinite(open) || !Number.isFinite(close) || close <= open) {
    return { ok: false, error: 'invalid_registration_window' }
  }

  return {
    ok: true,
    input: {
      title,
      description: description ?? '',
      registrationOpenAt: new Date(open).toISOString(),
      registrationCloseAt: new Date(close).toISOString(),
      responsibleChiefId: chiefId,
      responsibleInvestmentId: investmentId,
    },
  }
}

export function eventWithActions(
  role: Parameters<typeof allowedEventActions>[0],
  actorId: string,
  event: EventConfiguration,
) {
  return {
    ...event,
    allowedActions: allowedEventActions(role, actorId, event),
  }
}

export async function ineligibleResponsibleField(
  userStore: UserStore,
  input: EventInput,
): Promise<'responsibleChiefId' | 'responsibleInvestmentId' | null> {
  const [chief, investment] = await Promise.all(
    [input.responsibleChiefId, input.responsibleInvestmentId].map(async (id) => {
      try {
        return await userStore.findById(id)
      } catch {
        return undefined
      }
    }),
  )
  if (!chief || operationalRoleOf(chief) !== 'chief-reviewer') return 'responsibleChiefId'
  if (!investment || operationalRoleOf(investment) !== 'investment-reviewer') {
    return 'responsibleInvestmentId'
  }
  return null
}

export async function resolveRequesterNames(userStore: UserStore, requesterIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(requesterIds)]
  const users = await Promise.all(ids.map(async (id) => {
    try {
      return [id, await userStore.findById(id)] as const
    } catch {
      return [id, undefined] as const
    }
  }))
  const byId = new Map(users)

  if (users.some(([, user]) => !user)) {
    try {
      for (const user of await userStore.list({ role: 'representative' })) {
        if (!byId.get(user.id)) byId.set(user.id, user)
      }
    } catch {
      // Ticket access must remain available when the optional CMS name lookup fails.
    }
  }

  return new Map(ids.map((id) => [id, requesterDisplayName(byId.get(id))]))
}

/** Returns the names of required form fields missing from `answers`, or null when complete. */
export function missingRequiredFields(service: ServiceDefinition, answers: Record<string, unknown>): string[] | null {
  const fields = service.formFields
  if (!fields || fields.length === 0) return null

  const missing: string[] = []
  for (const field of fields) {
    if (!field.required) continue
    const value = answers[field.name]
    const empty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    if (empty) missing.push(field.name)
  }
  return missing.length > 0 ? missing : null
}
