import type { Pool } from 'pg'

import type { CaseAssignmentRole } from '../access/roles.js'

export interface CaseAssignmentDto {
  id: string
  requestId: string
  userId: string
  role: CaseAssignmentRole
  active: boolean
  assignedBy: string
  assignedAt: string
  revokedBy: string | null
  revokedAt: string | null
  revokeReason: string | null
  /** Set when a review round created the assignment (T22); null for manual grants. */
  roundId: string | null
  slot: 'employer' | 'ordinary' | null
}

interface AssignmentRow {
  id: string
  request_id: string
  user_id: string
  role: CaseAssignmentRole
  active: boolean
  assigned_by: string
  assigned_at: Date
  revoked_by: string | null
  revoked_at: Date | null
  revoke_reason: string | null
  round_id: string | null
  slot: 'employer' | 'ordinary' | null
}

const ASSIGNMENT_COLUMNS = `
  id, request_id, user_id, role, active, assigned_by, assigned_at,
  revoked_by, revoked_at, revoke_reason, round_id, slot
`

function mapRow(row: AssignmentRow): CaseAssignmentDto {
  return {
    id: row.id,
    requestId: row.request_id,
    userId: row.user_id,
    role: row.role,
    active: row.active,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at.toISOString(),
    revokedBy: row.revoked_by,
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
    revokeReason: row.revoke_reason,
    roundId: row.round_id,
    slot: row.slot,
  }
}

export type CreateAssignmentResult =
  | { ok: true; assignment: CaseAssignmentDto }
  | { ok: false; reason: 'already_assigned' | 'managed_by_review_round' | 'investment_person_assigned' }

export class AssignmentRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: {
    requestId: string
    userId: string
    role: CaseAssignmentRole
    assignedBy: string
  }): Promise<CreateAssignmentResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      if (input.role === 'reviewer' || input.role === 'employer-reviewer') {
        // A review round starts under the request row lock (T22). Holding it in
        // share mode here means a hand-made reviewer grant either commits first
        // (and the start refuses it) or sees the round and stays out of it. The
        // round is read in a later statement so its snapshot follows the lock wait.
        const { rows: locked } = await client.query<{ revision: number }>(
          'SELECT revision FROM dashboard.requests WHERE id = $1 FOR SHARE',
          [input.requestId],
        )
        const round = await client.query(
          'SELECT 1 FROM dashboard.review_rounds WHERE request_id = $1 AND request_revision = $2',
          [input.requestId, locked[0]?.revision ?? 0],
        )
        if ((round.rowCount ?? 0) > 0) {
          await client.query('ROLLBACK')
          return { ok: false, reason: 'managed_by_review_round' }
        }
      }
      if (input.role === 'investment-reviewer') {
        // One investment person per case. The exclusive lock orders this with another
        // grant and with the handoff, which takes the same row lock (T31).
        await client.query('SELECT 1 FROM dashboard.requests WHERE id = $1 FOR UPDATE', [input.requestId])
        const held = await client.query<{ user_id: string }>(
          `SELECT user_id FROM dashboard.case_assignments
           WHERE request_id = $1 AND role = 'investment-reviewer' AND active AND user_id <> $2`,
          [input.requestId, input.userId],
        )
        if ((held.rowCount ?? 0) > 0) {
          await client.query('ROLLBACK')
          return { ok: false, reason: 'investment_person_assigned' }
        }
      }
      const { rows } = await client.query<AssignmentRow>(
        `INSERT INTO dashboard.case_assignments (request_id, user_id, role, assigned_by)
         VALUES ($1, $2, $3, $4)
         RETURNING ${ASSIGNMENT_COLUMNS}`,
        [input.requestId, input.userId, input.role, input.assignedBy],
      )
      const row = rows[0]
      if (!row) throw new Error('INSERT case_assignments returned no row')
      await client.query('COMMIT')
      return { ok: true, assignment: mapRow(row) }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      if ((error as { code?: string }).code === '23505') {
        return { ok: false, reason: 'already_assigned' }
      }
      throw error
    } finally {
      client.release()
    }
  }

  async listForRequest(requestId: string): Promise<CaseAssignmentDto[]> {
    const { rows } = await this.pool.query<AssignmentRow>(
      `SELECT ${ASSIGNMENT_COLUMNS} FROM dashboard.case_assignments
       WHERE request_id = $1 ORDER BY assigned_at ASC`,
      [requestId],
    )
    return rows.map(mapRow)
  }

  /** Revokes hand-made grants only; review round slots change through their own commands. */
  async revoke(input: {
    requestId: string
    userId: string
    revokedBy: string
    reason: string | null
  }): Promise<CaseAssignmentDto | undefined> {
    const { rows } = await this.pool.query<AssignmentRow>(
      `UPDATE dashboard.case_assignments
       SET active = false, revoked_by = $3, revoked_at = now(), revoke_reason = $4
       WHERE request_id = $1 AND user_id = $2 AND active AND round_id IS NULL
       RETURNING ${ASSIGNMENT_COLUMNS}`,
      [input.requestId, input.userId, input.revokedBy, input.reason],
    )
    const row = rows[0]
    return row ? mapRow(row) : undefined
  }

  async activeFor(requestId: string, userId: string, role: CaseAssignmentRole): Promise<boolean> {
    const { rows } = await this.pool.query<{ present: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM dashboard.case_assignments
         WHERE request_id = $1 AND user_id = $2 AND role = $3 AND active
       ) AS present`,
      [requestId, userId, role],
    )
    return rows[0]?.present === true
  }

  async listForUser(userId: string): Promise<CaseAssignmentDto[]> {
    const { rows } = await this.pool.query<AssignmentRow>(
      `SELECT ${ASSIGNMENT_COLUMNS} FROM dashboard.case_assignments
       WHERE user_id = $1 AND active ORDER BY assigned_at ASC`,
      [userId],
    )
    return rows.map(mapRow)
  }
}
