import type { Pool, PoolClient } from 'pg'

import { appendTransition } from '../dashboard/transition-history.js'

/** One employer and three ordinary reviewers. */
export const ROUND_REQUIRED_EVALUATIONS = 4

/**
 * Final evaluations for the round's revision held by its slots: the active ones,
 * or the ones a later round ended, so a past round keeps the count it was decided
 * on. Replaced people never count.
 */
export async function countRoundFinals(
  db: Pool | PoolClient,
  round: { id: string; requestRevision: number },
): Promise<number> {
  const { rows } = await db.query<{ finalized: number }>(
    `SELECT count(*)::integer AS finalized
     FROM dashboard.case_assignments a
     JOIN dashboard.evaluations ev
       ON ev.request_id = a.request_id AND ev.user_id = a.user_id AND ev.role = a.role::text
      AND ev.revision = $2 AND ev.state = 'final'
     WHERE a.round_id = $1 AND (a.active OR a.revoke_reason = 'superseded_by_new_round')`,
    [round.id, round.requestRevision],
  )
  return Number(rows[0]?.finalized ?? 0)
}

/**
 * Brings the round of this revision in line with its final evaluations, inside
 * the caller's transaction. The round lock serializes finalizers: whoever takes
 * it last counts everyone who committed before, and only the update that sets
 * `completed_at` writes history, so racing fourth evaluations complete it once.
 * This never moves the case; advancing it stays the chief's explicit decision.
 */
export async function syncRoundCompletion(
  client: PoolClient,
  input: { requestId: string; revision: number; actorId: string },
): Promise<void> {
  const { rows } = await client.query<{ id: string; owner_id: string; status: string; completed_at: Date | null }>(
    `SELECT rr.id, r.owner_id, r.status, rr.completed_at
     FROM dashboard.review_rounds rr
     JOIN dashboard.requests r ON r.id = rr.request_id
     WHERE rr.request_id = $1 AND rr.request_revision = $2
     FOR NO KEY UPDATE OF rr`,
    [input.requestId, input.revision],
  )
  const round = rows[0]
  if (!round) return

  const finalized = await countRoundFinals(client, { id: round.id, requestRevision: input.revision })
  if (finalized < ROUND_REQUIRED_EVALUATIONS) {
    // The owner's employer replacement can take back a slot that had finished.
    if (round.completed_at) {
      await client.query('UPDATE dashboard.review_rounds SET completed_at = NULL WHERE id = $1', [round.id])
    }
    return
  }
  if (round.completed_at) return

  await client.query('UPDATE dashboard.review_rounds SET completed_at = now() WHERE id = $1', [round.id])
  await appendTransition(client, {
    requestId: input.requestId,
    ownerId: round.owner_id,
    actorId: input.actorId,
    action: 'review_round_complete',
    fromState: round.status,
    toState: round.status,
    revision: input.revision,
  })
}
