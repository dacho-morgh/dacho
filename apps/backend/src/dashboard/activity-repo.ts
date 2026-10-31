import type { Pool } from 'pg'

import type { RequestScope } from '../access/policy.js'
import { requestScopeClause } from './request-repo.js'

export interface ActivityDto {
  id: string
  ownerId: string
  requestId: string | null
  letterId: string | null
  type: string
  title: string
  description: string | null
  at: string
  actorId: string | null
  action: string | null
  reason: string | null
  fromState: string | null
  toState: string | null
  revision: number | null
}

interface ActivityRow {
  id: string
  owner_id: string
  request_id: string | null
  letter_id: string | null
  type: string
  title: string
  description: string | null
  at: Date
  actor_id: string | null
  action: string | null
  reason: string | null
  from_state: string | null
  to_state: string | null
  revision: number | null
}

const ACTIVITY_COLUMNS = `id, owner_id, request_id, letter_id, type, title, description, at,
  actor_id, action, reason, from_state, to_state, revision`

const ACTIVITY_COLUMNS_ALIASED = `a.id, a.owner_id, a.request_id, a.letter_id, a.type, a.title,
  a.description, a.at, a.actor_id, a.action, a.reason, a.from_state, a.to_state, a.revision`

function mapActivity(row: ActivityRow): ActivityDto {
  return {
    id: row.id,
    ownerId: row.owner_id,
    requestId: row.request_id,
    letterId: row.letter_id,
    type: row.type,
    title: row.title,
    description: row.description,
    at: row.at.toISOString(),
    actorId: row.actor_id,
    action: row.action,
    reason: row.reason,
    fromState: row.from_state,
    toState: row.to_state,
    revision: row.revision,
  }
}

export interface ActivityList {
  items: ActivityDto[]
  total: number
  page: number
  totalPages: number
}

/**
 * Changes to the review panel (T26), their reasons and the round's completion
 * (T27) are oversight history: only the owner, Secretariat and the case's chief
 * see them, never the company or an assigned reviewer/employer/investment person.
 */
export const OVERSIGHT_ONLY_ACTIONS = [
  'chief_replace_reviewer',
  'owner_replace_employer',
  'review_round_complete',
] as const

/** A draft of the result text stays with the Secretariat and the owner until it is published (T33). */
const RESULT_DRAFT_ACTIONS = ['result_save'] as const

/** The handoff, the memo and the delivery are internal: the company sees its own submission, not what follows it (T31-T33). */
const INTERNAL_FINANCIAL_ACTIONS = [
  'investment_handoff',
  'investment_memo_save',
  'investment_memo_send',
  'supplementary_delivery',
] as const

/** Package status and follow-up belong to the financial audience: chiefs, reviewers and employers do not see them (T31, T33). */
export const FINANCIAL_ONLY_ACTIONS = ['financial_package_submit', 'supplementary_request', ...INTERNAL_FINANCIAL_ACTIONS] as const

function hiddenActions(scope: RequestScope): readonly string[] {
  if (scope.kind === 'all') return []
  if (scope.kind === 'assigned') {
    if (scope.role === 'chief-reviewer') return [...RESULT_DRAFT_ACTIONS, ...FINANCIAL_ONLY_ACTIONS]
    if (scope.role === 'investment-reviewer') return [...RESULT_DRAFT_ACTIONS, ...OVERSIGHT_ONLY_ACTIONS]
    return [...RESULT_DRAFT_ACTIONS, ...OVERSIGHT_ONLY_ACTIONS, ...FINANCIAL_ONLY_ACTIONS]
  }
  return [...RESULT_DRAFT_ACTIONS, ...OVERSIGHT_ONLY_ACTIONS, ...INTERNAL_FINANCIAL_ACTIONS]
}

function oversightOnlyClause(scope: RequestScope): string {
  const hidden = hiddenActions(scope)
  if (hidden.length === 0) return 'TRUE'
  const actions = hidden.map((action) => `'${action}'`).join(', ')
  return `(a.action IS NULL OR a.action NOT IN (${actions}))`
}

export class ActivityRepository {
  constructor(private readonly pool: Pool) {}

  async listScoped(scope: RequestScope, page: number, limit: number): Promise<ActivityList> {
    const params: unknown[] = []
    let whereSql: string
    switch (scope.kind) {
      case 'all':
        whereSql = 'TRUE'
        break
      case 'none':
        whereSql = 'FALSE'
        break
      case 'owner':
        params.push(scope.userId)
        whereSql = `a.owner_id = $${params.length}`
        break
      case 'company': {
        params.push(scope.companyId)
        const compParam = params.length
        if (scope.userId) {
          params.push(scope.userId)
          whereSql = `a.request_id IN (
            SELECT r.id FROM dashboard.requests r
            WHERE r.company_id = $${compParam} OR (r.company_id IS NULL AND r.owner_id = $${params.length})
          )`
        } else {
          whereSql = `a.request_id IN (
            SELECT r.id FROM dashboard.requests r
            WHERE r.company_id = $${compParam}
          )`
        }
        break
      }
      case 'assigned':
        params.push(scope.userId)
        const userParam = params.length
        params.push(scope.role)
        whereSql = `a.request_id IN (
          SELECT ca.request_id FROM dashboard.case_assignments ca
          WHERE ca.user_id = $${userParam} AND ca.role = $${params.length} AND ca.active
        )`
        break
    }
    whereSql = `(${whereSql}) AND ${oversightOnlyClause(scope)}`

    const { rows: countRows } = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM dashboard.activities a WHERE ${whereSql}`,
      params,
    )
    const total = Number(countRows[0]?.total ?? 0)
    const offset = (page - 1) * limit
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT ${ACTIVITY_COLUMNS_ALIASED}
       FROM dashboard.activities a
       WHERE ${whereSql}
       ORDER BY a.at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    )
    return {
      items: rows.map(mapActivity),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  }

  async list(ownerId: string, page: number, limit: number): Promise<ActivityList> {
    const { rows: countRows } = await this.pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM dashboard.activities WHERE owner_id = $1',
      [ownerId],
    )
    const total = Number(countRows[0]?.total ?? 0)

    const offset = (page - 1) * limit
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT ${ACTIVITY_COLUMNS} FROM dashboard.activities
       WHERE owner_id = $1
       ORDER BY at DESC
       LIMIT $2 OFFSET $3`,
      [ownerId, limit, offset],
    )

    return {
      items: rows.map(mapActivity),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  }

  /** Chronological history for a single request, using the shared request scope. */
  async listForRequestScoped(requestId: string, scope: RequestScope): Promise<ActivityDto[]> {
    const params: unknown[] = [requestId]
    const scopeSql = requestScopeClause(scope, params, 'r')
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT ${ACTIVITY_COLUMNS_ALIASED}
       FROM dashboard.activities a
       JOIN dashboard.requests r ON r.id = a.request_id
       WHERE a.request_id = $1 AND ${scopeSql} AND ${oversightOnlyClause(scope)}
       ORDER BY a.at ASC`,
      params,
    )
    return rows.map(mapActivity)
  }
}