import type { Pool, PoolClient } from 'pg'

import { isUuid } from '../db/uuid.js'
import { appendTransition } from './transition-history.js'

export type ReviewSlot = 'employer' | 'ordinary'

export interface ReviewRoundSlotDto {
  assignmentId: string
  userId: string
  role: 'employer-reviewer' | 'reviewer'
  slot: ReviewSlot
  active: boolean
  assignedAt: string
  revokedAt: string | null
  revokeReason: string | null
}

export interface ReviewRoundDto {
  id: string
  requestId: string
  requestRevision: number
  proposalRevision: number
  employerId: string
  startedBy: string
  startedAt: string
  supersededAt: string | null
  slots: ReviewRoundSlotDto[]
}

interface RoundRow {
  id: string
  request_id: string
  request_revision: number
  proposal_revision: number
  employer_id: string
  started_by: string
  started_at: Date
  superseded_at: Date | null
}

interface SlotRow {
  id: string
  round_id: string
  user_id: string
  role: 'employer-reviewer' | 'reviewer'
  slot: ReviewSlot
  active: boolean
  assigned_at: Date
  revoked_at: Date | null
  revoke_reason: string | null
}

const ROUND_COLUMNS =
  'id, request_id, request_revision, proposal_revision, employer_id, started_by, started_at, superseded_at'

function mapSlot(row: SlotRow): ReviewRoundSlotDto {
  return {
    assignmentId: row.id,
    userId: row.user_id,
    role: row.role,
    slot: row.slot,
    active: row.active,
    assignedAt: row.assigned_at.toISOString(),
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
    revokeReason: row.revoke_reason,
  }
}

function mapRound(row: RoundRow, slots: SlotRow[]): ReviewRoundDto {
  return {
    id: row.id,
    requestId: row.request_id,
    requestRevision: row.request_revision,
    proposalRevision: row.proposal_revision,
    employerId: row.employer_id,
    startedBy: row.started_by,
    startedAt: row.started_at.toISOString(),
    supersededAt: row.superseded_at ? row.superseded_at.toISOString() : null,
    slots: slots.filter((slot) => slot.round_id === row.id).map(mapSlot),
  }
}

/** The facts the router needs before it validates people; re-read under lock when starting. */
export interface RoundStartContext {
  requestId: string
  status: string
  reviewStage: string | null
  revision: number
  responsibleChiefId: string
  employerId: string
}

export type StartRoundResult =
  | { round: ReviewRoundDto }
  | 'not_found'
  | 'forbidden'
  | 'invalid_state'
  | 'stale_revision'
  | 'round_exists'
  | 'employer_changed'
  | 'existing_assignments'
  | 'already_assigned'

export class ReviewRoundRepository {
  constructor(private readonly pool: Pool) {}

  async findStartContext(requestId: string): Promise<RoundStartContext | null> {
    if (!isUuid(requestId)) return null
    const { rows } = await this.pool.query<{
      status: string
      review_stage: string | null
      revision: number
      chief_id: string
      employer_id: string
    }>(
      `SELECT r.status, r.review_stage, r.revision, e.responsible_chief_id AS chief_id, s.employer_id
       FROM dashboard.requests r
       JOIN dashboard.request_rfps rfp ON rfp.request_id = r.id
       JOIN dashboard.events e ON e.id = rfp.event_id
       JOIN dashboard.event_subtopics s ON s.id = rfp.subtopic_id
       WHERE r.id = $1`,
      [requestId],
    )
    const row = rows[0]
    if (!row) return null
    return {
      requestId,
      status: row.status,
      reviewStage: row.review_stage,
      revision: row.revision,
      responsibleChiefId: row.chief_id,
      employerId: row.employer_id,
    }
  }

  /** Request ids (out of the given cases) that already have a round for their current revision. */
  async requestsWithCurrentRound(requestIds: string[]): Promise<Set<string>> {
    const valid = requestIds.filter(isUuid)
    if (valid.length === 0) return new Set()
    const { rows } = await this.pool.query<{ request_id: string }>(
      `SELECT rr.request_id
       FROM dashboard.review_rounds rr
       JOIN dashboard.requests r ON r.id = rr.request_id AND r.revision = rr.request_revision
       WHERE rr.request_id = ANY($1::uuid[])`,
      [valid],
    )
    return new Set(rows.map((row) => row.request_id))
  }

  async hasCurrentRound(requestId: string): Promise<boolean> {
    return (await this.requestsWithCurrentRound([requestId])).has(requestId)
  }

  /** The round for the request's current revision, or the latest earlier one. */
  async findLatest(requestId: string): Promise<ReviewRoundDto | null> {
    if (!isUuid(requestId)) return null
    const { rows } = await this.pool.query<RoundRow>(
      `SELECT ${ROUND_COLUMNS} FROM dashboard.review_rounds
       WHERE request_id = $1 ORDER BY request_revision DESC LIMIT 1`,
      [requestId],
    )
    const round = rows[0]
    if (!round) return null
    const slots = await this.pool.query<SlotRow>(
      `SELECT id, round_id, user_id, role, slot, active, assigned_at, revoked_at, revoke_reason
       FROM dashboard.case_assignments WHERE round_id = $1 ORDER BY slot DESC, assigned_at ASC, user_id ASC`,
      [round.id],
    )
    return mapRound(round, slots.rows)
  }

  /**
   * Start the review round for a triaged case: the subtopic employer takes the
   * fixed slot, the chief's three distinct ordinary reviewers take the others,
   * and all four assignments plus the round and its history row commit together.
   * Authority, state and revision are re-read under lock.
   */
  async start(input: {
    requestId: string
    actorId: string
    employerId: string
    reviewerIds: string[]
    expectedRevision?: number
  }): Promise<StartRoundResult> {
    if (!isUuid(input.requestId)) return 'not_found'
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const locked = await client.query<{
        id: string
        owner_id: string
        status: string
        review_stage: string | null
        revision: number
        chief_id: string
        employer_id: string
      }>(
        `SELECT r.id, r.owner_id, r.status, r.review_stage, r.revision,
                e.responsible_chief_id AS chief_id, s.employer_id
         FROM dashboard.requests r
         JOIN dashboard.request_rfps rfp ON rfp.request_id = r.id
         JOIN dashboard.events e ON e.id = rfp.event_id
         JOIN dashboard.event_subtopics s ON s.id = rfp.subtopic_id
         WHERE r.id = $1
         FOR NO KEY UPDATE OF r FOR SHARE OF e, s`,
        [input.requestId],
      )
      const current = locked.rows[0]
      if (!current) return await this.abort(client, 'not_found')
      if (current.chief_id !== input.actorId) return await this.abort(client, 'forbidden')
      if (current.status !== 'in_review' || current.review_stage !== 'triaged') {
        return await this.abort(client, 'invalid_state')
      }
      if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision) {
        return await this.abort(client, 'stale_revision')
      }
      // The router validated this person; a changed subtopic employer must not
      // be silently replaced by the one it checked.
      if (current.employer_id !== input.employerId) return await this.abort(client, 'employer_changed')

      const existing = await client.query(
        'SELECT 1 FROM dashboard.review_rounds WHERE request_id = $1 AND request_revision = $2',
        [current.id, current.revision],
      )
      if ((existing.rowCount ?? 0) > 0) return await this.abort(client, 'round_exists')

      // A new revision supersedes the previous round: its slot assignments end
      // (history stays) so only the new four people hold active case access.
      await client.query(
        `UPDATE dashboard.case_assignments
         SET active = false, revoked_by = $2, revoked_at = now(), revoke_reason = 'superseded_by_new_round'
         WHERE request_id = $1 AND round_id IS NOT NULL AND active`,
        [current.id, input.actorId],
      )
      await client.query(
        'UPDATE dashboard.review_rounds SET superseded_at = now() WHERE request_id = $1 AND superseded_at IS NULL',
        [current.id],
      )
      // Hand-made reviewer/employer grants would make five or more active people.
      const manual = await client.query(
        `SELECT 1 FROM dashboard.case_assignments
         WHERE request_id = $1 AND active AND role IN ('reviewer', 'employer-reviewer')`,
        [current.id],
      )
      if ((manual.rowCount ?? 0) > 0) return await this.abort(client, 'existing_assignments')

      const proposal = await client.query<{ revision: number }>(
        'SELECT max(revision) AS revision FROM dashboard.request_proposals WHERE request_id = $1 AND revision <= $2',
        [current.id, current.revision],
      )
      const proposalRevision = proposal.rows[0]?.revision
      if (!proposalRevision) throw new Error(`Request ${current.id} has no proposal revision to review`)

      const inserted = await client.query<RoundRow>(
        `INSERT INTO dashboard.review_rounds
           (request_id, request_revision, proposal_revision, employer_id, started_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${ROUND_COLUMNS}`,
        [current.id, current.revision, proposalRevision, current.employer_id, input.actorId],
      )
      const round = inserted.rows[0]
      if (!round) throw new Error('INSERT review_rounds returned no row')

      const slots: SlotRow[] = []
      const people: { userId: string; role: 'employer-reviewer' | 'reviewer'; slot: ReviewSlot }[] = [
        { userId: current.employer_id, role: 'employer-reviewer', slot: 'employer' },
        ...input.reviewerIds.map((userId) => ({ userId, role: 'reviewer' as const, slot: 'ordinary' as const })),
      ]
      for (const person of people) {
        const row = await client.query<SlotRow>(
          `INSERT INTO dashboard.case_assignments (request_id, user_id, role, assigned_by, round_id, slot)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, round_id, user_id, role, slot, active, assigned_at, revoked_at, revoke_reason`,
          [current.id, person.userId, person.role, input.actorId, round.id, person.slot],
        )
        slots.push(row.rows[0]!)
      }
      await appendTransition(client, {
        requestId: current.id,
        ownerId: current.owner_id,
        actorId: input.actorId,
        action: 'review_round_start',
        fromState: current.status,
        toState: current.status,
        revision: current.revision,
      })
      await client.query('COMMIT')
      return { round: mapRound(round, slots) }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      if ((error as { code?: string }).code === '23505') return 'already_assigned'
      throw error
    } finally {
      client.release()
    }
  }

  private async abort<T extends StartRoundResult>(client: PoolClient, result: T): Promise<T> {
    await client.query('ROLLBACK')
    return result
  }
}
