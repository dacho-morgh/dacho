import type { Pool } from 'pg'

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
    const { rows } = await this.pool.query<StatsRow>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'in_review')::int AS in_review,
              COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
              COUNT(*) FILTER (WHERE status = 'action_needed')::int AS action_needed,
              COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
       FROM dashboard.requests
       WHERE owner_id = $1`,
      [ownerId],
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