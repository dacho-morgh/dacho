import type { Pool, PoolClient } from 'pg'

import { isUuid } from '../db/uuid.js'
import { countRoundFinals, ROUND_REQUIRED_EVALUATIONS, syncRoundCompletion } from '../reviews/round-completion.js'
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

export interface ReviewReplacementDto {
  id: string
  slot: ReviewSlot
  oldUserId: string
  newUserId: string
  replacedBy: string
  reason: string | null
  replacedAt: string
}

/** Progress of a round; oversight only. `ready` only means the chief can now decide. */
export interface ReviewRoundCompletionDto {
  required: number
  finalized: number
  ready: boolean
  completedAt: string | null
}

/** The chief's decision on a complete round; oversight only. */
export interface ReviewRoundDecisionDto {
  action: 'advance' | 'return' | 'reject'
  decidedBy: string
  decidedAt: string
  reason: string | null
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
  completion: ReviewRoundCompletionDto
  decision: ReviewRoundDecisionDto | null
  slots: ReviewRoundSlotDto[]
  /** Slot replacements in the order they happened; oversight only. */
  replacements: ReviewReplacementDto[]
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
  completed_at: Date | null
  decision: ReviewRoundDecisionDto['action'] | null
  decided_by: string | null
  decided_at: Date | null
  decision_reason: string | null
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

interface ReplacementRow {
  id: string
  round_id: string
  slot: ReviewSlot
  old_user_id: string
  new_user_id: string
  replaced_by: string
  reason: string | null
  replaced_at: Date
}

const ROUND_COLUMNS =
  `id, request_id, request_revision, proposal_revision, employer_id, started_by, started_at, superseded_at, completed_at,
   decision, decided_by, decided_at, decision_reason`

/** The last employer the owner substituted for this request, if any. */
const REPLACEMENT_EMPLOYER_SQL = `(
  SELECT rp.new_user_id FROM dashboard.review_replacements rp
  WHERE rp.request_id = r.id AND rp.slot = 'employer'
  ORDER BY rp.replaced_at DESC, rp.id DESC LIMIT 1
)`

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

function mapReplacement(row: ReplacementRow): ReviewReplacementDto {
  return {
    id: row.id,
    slot: row.slot,
    oldUserId: row.old_user_id,
    newUserId: row.new_user_id,
    replacedBy: row.replaced_by,
    reason: row.reason,
    replacedAt: row.replaced_at.toISOString(),
  }
}

function mapRound(
  row: RoundRow,
  slots: SlotRow[],
  replacements: ReplacementRow[],
  progress: { finalized: number; current: boolean },
): ReviewRoundDto {
  return {
    id: row.id,
    requestId: row.request_id,
    requestRevision: row.request_revision,
    proposalRevision: row.proposal_revision,
    employerId: row.employer_id,
    startedBy: row.started_by,
    startedAt: row.started_at.toISOString(),
    supersededAt: row.superseded_at ? row.superseded_at.toISOString() : null,
    completion: {
      required: ROUND_REQUIRED_EVALUATIONS,
      finalized: progress.finalized,
      ready: progress.current && row.completed_at !== null,
      completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    },
    decision: row.decision && row.decided_by && row.decided_at
      ? {
          action: row.decision,
          decidedBy: row.decided_by,
          decidedAt: row.decided_at.toISOString(),
          reason: row.decision_reason,
        }
      : null,
    slots: slots.filter((slot) => slot.round_id === row.id).map(mapSlot),
    replacements: replacements.filter((item) => item.round_id === row.id).map(mapReplacement),
  }
}

/** The facts the router needs before it validates people; re-read under lock when starting. */
export interface RoundStartContext {
  requestId: string
  status: string
  reviewStage: string | null
  revision: number
  responsibleChiefId: string
  /** The employer fixed on the subtopic. */
  employerId: string
  /** The employer the owner last put in this case's place (T26), when one was. */
  replacementEmployerId: string | null
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

export type ReplaceSlotResult =
  | { round: ReviewRoundDto }
  | 'not_found'
  | 'forbidden'
  | 'invalid_state'
  | 'stale_revision'
  | 'no_round'
  | 'not_assigned'
  | 'evaluation_final'
  | 'already_assigned'
  | 'previously_assigned'

export interface ReplaceSlotInput {
  requestId: string
  actorId: string
  slot: ReviewSlot
  /** Ordinary slot: the reviewer being replaced. The employer slot has exactly one holder. */
  outgoingUserId?: string
  incomingUserId: string
  reason: string | null
  expectedRevision?: number
  /** `chief`: the event's responsible chief. `owner`: the system owner (the router checked the role). */
  authority: 'chief' | 'owner'
}

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
      replacement_employer_id: string | null
    }>(
      `SELECT r.status, r.review_stage, r.revision, e.responsible_chief_id AS chief_id, s.employer_id,
              ${REPLACEMENT_EMPLOYER_SQL} AS replacement_employer_id
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
      replacementEmployerId: row.replacement_employer_id,
    }
  }

  /** Rounds covering the current revision of the given cases, by request id; true once complete. */
  async currentRoundsOf(requestIds: string[]): Promise<Map<string, boolean>> {
    const valid = requestIds.filter(isUuid)
    if (valid.length === 0) return new Map()
    const { rows } = await this.pool.query<{ request_id: string; complete: boolean }>(
      `SELECT rr.request_id, rr.completed_at IS NOT NULL AS complete
       FROM dashboard.review_rounds rr
       JOIN dashboard.requests r ON r.id = rr.request_id AND r.revision = rr.request_revision
       WHERE rr.request_id = ANY($1::uuid[])`,
      [valid],
    )
    return new Map(rows.map((row) => [row.request_id, row.complete]))
  }

  /** The round for the request's current revision, or the latest earlier one. */
  async findLatest(requestId: string): Promise<ReviewRoundDto | null> {
    return (await this.loadRounds(requestId, { limit: 1 }))[0] ?? null
  }

  /** The round that reviewed exactly this revision, if one did. */
  async findByRevision(requestId: string, revision: number): Promise<ReviewRoundDto | null> {
    return (await this.loadRounds(requestId, { revision }))[0] ?? null
  }

  /** Every round of the request, newest first, including superseded and decided ones. */
  async listForRequest(requestId: string): Promise<ReviewRoundDto[]> {
    return this.loadRounds(requestId)
  }

  private async loadRounds(
    requestId: string,
    filter: { revision?: number; limit?: number } = {},
  ): Promise<ReviewRoundDto[]> {
    if (!isUuid(requestId)) return []
    const { rows } = await this.pool.query<RoundRow & { current: boolean }>(
      `SELECT rr.*, (r.revision = rr.request_revision AND r.status = 'in_review') AS current
       FROM dashboard.review_rounds rr
       JOIN dashboard.requests r ON r.id = rr.request_id
       WHERE rr.request_id = $1 AND ($2::integer IS NULL OR rr.request_revision = $2)
       ORDER BY rr.request_revision DESC LIMIT $3::integer`,
      [requestId, filter.revision ?? null, filter.limit ?? null],
    )
    const roundIds = rows.map((round) => round.id)
    const slots = await this.pool.query<SlotRow>(
      `SELECT id, round_id, user_id, role, slot, active, assigned_at, revoked_at, revoke_reason
       FROM dashboard.case_assignments WHERE round_id = ANY($1::uuid[])
       ORDER BY slot DESC, assigned_at ASC, user_id ASC`,
      [roundIds],
    )
    const replacements = await this.pool.query<ReplacementRow>(
      `SELECT id, round_id, slot, old_user_id, new_user_id, replaced_by, reason, replaced_at
       FROM dashboard.review_replacements WHERE round_id = ANY($1::uuid[]) ORDER BY replaced_at ASC, id ASC`,
      [roundIds],
    )
    return Promise.all(rows.map(async (round) => {
      const finalized = await countRoundFinals(this.pool, { id: round.id, requestRevision: round.request_revision })
      return mapRound(round, slots.rows, replacements.rows, { finalized, current: round.current })
    }))
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
        replacement_employer_id: string | null
      }>(
        `SELECT r.id, r.owner_id, r.status, r.review_stage, r.revision,
                e.responsible_chief_id AS chief_id, s.employer_id,
                ${REPLACEMENT_EMPLOYER_SQL} AS replacement_employer_id
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
      const allowedEmployers = [current.replacement_employer_id, current.employer_id]
      if (!allowedEmployers.includes(input.employerId)) return await this.abort(client, 'employer_changed')

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
        [current.id, current.revision, proposalRevision, input.employerId, input.actorId],
      )
      const round = inserted.rows[0]
      if (!round) throw new Error('INSERT review_rounds returned no row')

      const slots: SlotRow[] = []
      const people: { userId: string; role: 'employer-reviewer' | 'reviewer'; slot: ReviewSlot }[] = [
        { userId: input.employerId, role: 'employer-reviewer', slot: 'employer' },
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
      // Someone picked here may already hold a final evaluation of this revision
      // from an earlier hand-made grant; it is locked, so it can never be re-sent.
      await syncRoundCompletion(client, { requestId: current.id, revision: current.revision, actorId: input.actorId })
      const synced = await client.query<RoundRow>(
        `SELECT ${ROUND_COLUMNS} FROM dashboard.review_rounds WHERE id = $1`,
        [round.id],
      )
      const finalized = await countRoundFinals(client, { id: round.id, requestRevision: current.revision })
      await client.query('COMMIT')
      return { round: mapRound(synced.rows[0]!, slots, [], { finalized, current: true }) }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      if ((error as { code?: string }).code === '23505') return 'already_assigned'
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Replace one person in the current round: the outgoing assignment ends (its
   * access stops at the next request, the row and any evaluation stay as
   * history), the incoming person takes the same slot, and the replacement is
   * recorded with actor, reason and time. Authority, state, revision, the round
   * and the outgoing person's unfinished status are re-read under the request
   * lock the evaluation write guard also takes, so a finalization racing the
   * replacement either commits first (and blocks it) or finds the access gone.
   */
  async replaceSlot(input: ReplaceSlotInput): Promise<ReplaceSlotResult> {
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
      }>(
        `SELECT r.id, r.owner_id, r.status, r.review_stage, r.revision, e.responsible_chief_id AS chief_id
         FROM dashboard.requests r
         JOIN dashboard.request_rfps rfp ON rfp.request_id = r.id
         JOIN dashboard.events e ON e.id = rfp.event_id
         WHERE r.id = $1
         FOR NO KEY UPDATE OF r FOR SHARE OF e`,
        [input.requestId],
      )
      const current = locked.rows[0]
      if (!current) return await this.abort(client, 'not_found')
      if (input.authority === 'chief' && current.chief_id !== input.actorId) return await this.abort(client, 'forbidden')
      if (current.status !== 'in_review' || current.review_stage !== 'triaged') {
        return await this.abort(client, 'invalid_state')
      }
      if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision) {
        return await this.abort(client, 'stale_revision')
      }

      const roundRows = await client.query<RoundRow>(
        `SELECT ${ROUND_COLUMNS} FROM dashboard.review_rounds
         WHERE request_id = $1 AND request_revision = $2 FOR UPDATE`,
        [current.id, current.revision],
      )
      const round = roundRows.rows[0]
      if (!round) return await this.abort(client, 'no_round')

      const outgoing = await client.query<SlotRow>(
        `SELECT id, round_id, user_id, role, slot, active, assigned_at, revoked_at, revoke_reason
         FROM dashboard.case_assignments
         WHERE round_id = $1 AND slot = $2 AND active
           AND ($3::text IS NULL OR user_id = $3)
         FOR UPDATE`,
        [round.id, input.slot, input.outgoingUserId ?? null],
      )
      const leaving = outgoing.rows[0]
      if (!leaving) return await this.abort(client, 'not_assigned')

      if (input.slot === 'ordinary') {
        // Only unfinished work is handed over; a locked evaluation stays its author's.
        const final = await client.query(
          `SELECT 1 FROM dashboard.evaluations
           WHERE request_id = $1 AND user_id = $2 AND revision = $3 AND state = 'final'`,
          [current.id, leaving.user_id, current.revision],
        )
        if ((final.rowCount ?? 0) > 0) return await this.abort(client, 'evaluation_final')
      }

      // A person already (or earlier) in this round cannot be put back: their
      // old draft or evaluation would silently come back with them.
      const seen = await client.query<{ active: boolean }>(
        'SELECT active FROM dashboard.case_assignments WHERE round_id = $1 AND user_id = $2',
        [round.id, input.incomingUserId],
      )
      if (seen.rows.some((row) => row.active)) return await this.abort(client, 'already_assigned')
      if ((seen.rowCount ?? 0) > 0) return await this.abort(client, 'previously_assigned')

      const revokeReason = input.slot === 'employer' ? 'replaced_employer' : 'replaced_reviewer'
      await client.query(
        `UPDATE dashboard.case_assignments
         SET active = false, revoked_by = $2, revoked_at = now(), revoke_reason = $3
         WHERE id = $1`,
        [leaving.id, input.actorId, revokeReason],
      )
      const incoming = await client.query<{ id: string }>(
        `INSERT INTO dashboard.case_assignments (request_id, user_id, role, assigned_by, round_id, slot)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [current.id, input.incomingUserId, leaving.role, input.actorId, round.id, input.slot],
      )
      await client.query(
        `INSERT INTO dashboard.review_replacements
           (request_id, round_id, slot, old_assignment_id, new_assignment_id, old_user_id, new_user_id, replaced_by, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          current.id, round.id, input.slot, leaving.id, incoming.rows[0]!.id,
          leaving.user_id, input.incomingUserId, input.actorId, input.reason,
        ],
      )
      if (input.slot === 'employer') {
        await client.query('UPDATE dashboard.review_rounds SET employer_id = $2 WHERE id = $1', [
          round.id,
          input.incomingUserId,
        ])
      }
      await appendTransition(client, {
        requestId: current.id,
        ownerId: current.owner_id,
        actorId: input.actorId,
        action: input.slot === 'employer' ? 'owner_replace_employer' : 'chief_replace_reviewer',
        fromState: current.status,
        toState: current.status,
        revision: current.revision,
        reason: input.reason,
      })
      // Whoever left may have held a counted evaluation; completion follows the active slots.
      await syncRoundCompletion(client, { requestId: current.id, revision: current.revision, actorId: input.actorId })
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      if ((error as { code?: string }).code === '23505') return 'already_assigned'
      throw error
    } finally {
      client.release()
    }
    const updated = await this.findLatest(input.requestId)
    return updated ? { round: updated } : 'no_round'
  }

  private async abort<T extends string>(client: PoolClient, result: T): Promise<T> {
    await client.query('ROLLBACK')
    return result
  }
}
