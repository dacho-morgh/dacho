import type { Pool } from 'pg'

import type { RequestScope } from '../access/policy.js'
import { requestScopeClause } from './request-repo.js'

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

export class StatsRepository {
  constructor(private readonly pool: Pool) {}

  async forOwner(ownerId: string): Promise<RequestStats> {
    return this.forScope({ kind: 'owner', userId: ownerId })
  }

  async forScope(scope: RequestScope): Promise<RequestStats> {
    const params: unknown[] = []
    const whereSql = requestScopeClause(scope, params, 'r')
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
}