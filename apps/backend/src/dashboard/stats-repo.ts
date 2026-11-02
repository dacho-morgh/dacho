import type { Pool } from 'pg'

import type { RequestScope } from '../access/policy.js'
import type { OperationalRole } from '../access/roles.js'
import { requestFilterClauses, requestScopeClause, type RequestFilters } from './request-repo.js'
import { REQUEST_WORK_QUEUES, requestWorkQueueClause, type RequestWorkQueue } from './work-queues.js'

export interface RequestStats {
  total: number
  in_review: number
  approved: number
  action_needed: number
  rejected: number
}

interface StatsRow {
  total: number
  in_review: number
  approved: number
  action_needed: number
  rejected: number
}

/** Requests submitted on one Tehran calendar day, and how many of those are approved now. */
export interface RequestTrendDay {
  day: string
  submitted: number
  approved: number
}

export interface RequestOverview {
  counts: RequestStats
  queues: { key: RequestWorkQueue; count: number }[]
  /** Events that have a case in the actor's scope: the options of the list's event filter. */
  events: { id: string; title: string }[]
}

export class StatsRepository {
  constructor(private readonly pool: Pool) {}

  async forOwner(ownerId: string): Promise<RequestStats> {
    return this.forScope({ kind: 'owner', userId: ownerId })
  }

  async forScope(scope: RequestScope, filters: RequestFilters = {}): Promise<RequestStats> {
    const params: unknown[] = []
    const whereSql = [requestScopeClause(scope, params, 'r'), ...requestFilterClauses(filters, params)].join(' AND ')
    const { rows } = await this.pool.query<StatsRow>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE r.status = 'in_review')::int AS in_review,
              COUNT(*) FILTER (WHERE r.status = 'approved')::int AS approved,
              COUNT(*) FILTER (WHERE r.status = 'action_needed')::int AS action_needed,
              COUNT(*) FILTER (WHERE r.status = 'rejected')::int AS rejected
       FROM dashboard.requests r
       WHERE ${whereSql}`,
      params,
    )
    const row = rows[0]
    return {
      total: row?.total ?? 0,
      in_review: row?.in_review ?? 0,
      approved: row?.approved ?? 0,
      action_needed: row?.action_needed ?? 0,
      rejected: row?.rejected ?? 0,
    }
  }

  /** The role's queues counted inside its row scope, with the same predicates the list filters by. */
  async overview(scope: RequestScope, actor: { id: string; role: OperationalRole }): Promise<RequestOverview> {
    const keys: readonly RequestWorkQueue[] = REQUEST_WORK_QUEUES[actor.role]
    const params: unknown[] = []
    const scopeSql = requestScopeClause(scope, params, 'r')
    const columns = keys.map((key, index) => {
      const clause = requestWorkQueueClause({ key, actorId: actor.id, role: actor.role }, params)
      return `COUNT(*) FILTER (WHERE ${clause})::int AS q${index}`
    })
    const [counts, queues, events] = await Promise.all([
      this.forScope(scope),
      this.pool.query<Record<string, number>>(
        `SELECT ${columns.join(', ')} FROM dashboard.requests r WHERE ${scopeSql}`,
        params,
      ),
      this.scopedEvents(scope),
    ])
    return {
      counts,
      queues: keys.map((key, index) => ({ key, count: queues.rows[0]?.[`q${index}`] ?? 0 })),
      events,
    }
  }

  /**
   * Submissions per Tehran calendar day over the last `days` days, inside the actor's row
   * scope. Days stay Gregorian here; the dashboard buckets them into Jalali months.
   */
  async trend(scope: RequestScope, days: number): Promise<RequestTrendDay[]> {
    const params: unknown[] = []
    const scopeSql = requestScopeClause(scope, params, 'r')
    params.push(days)
    const { rows } = await this.pool.query<RequestTrendDay>(
      `SELECT to_char(r.submission_date AT TIME ZONE 'Asia/Tehran', 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS submitted,
              COUNT(*) FILTER (WHERE r.status = 'approved')::int AS approved
       FROM dashboard.requests r
       WHERE ${scopeSql}
         AND r.submission_date IS NOT NULL
         AND r.submission_date >= now() - ($${params.length}::int * interval '1 day')
       GROUP BY 1
       ORDER BY 1`,
      params,
    )
    return rows.map((row) => ({ day: row.day, submitted: row.submitted, approved: row.approved }))
  }

  private async scopedEvents(scope: RequestScope): Promise<RequestOverview['events']> {
    const params: unknown[] = []
    const scopeSql = requestScopeClause(scope, params, 'r')
    const { rows } = await this.pool.query<{ id: string; title: string }>(
      `SELECT DISTINCT e.id, e.title
       FROM dashboard.requests r
       JOIN dashboard.request_rfps rfp ON rfp.request_id = r.id
       JOIN dashboard.events e ON e.id = rfp.event_id
       WHERE ${scopeSql}
       ORDER BY e.title, e.id`,
      params,
    )
    return rows
  }
}
