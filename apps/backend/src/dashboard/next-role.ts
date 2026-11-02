import type { Pool, PoolClient } from 'pg'

import { deliverInApp, type NotificationJobRow, type NotificationOutbox } from './notification-outbox.js'
import { TRANSITION_TITLES } from './transition-history.js'

/**
 * What a notified person is expected to do next (S1 inbox). The inbox shows an
 * item as needing action while its step is pending; the step is marked done when
 * that person acts on the case or the case moves past it.
 */
export const NEXT_STEPS = [
  'triage',
  'correct',
  'evaluate',
  'decide',
  'financial_package',
  'investment_memo',
  'publish_result',
  'supplementary_upload',
  // Booth requests (S7)
  'attendance_decision',
  'booth_receipt',
  'receipt_decision',
] as const
export type NextStep = (typeof NEXT_STEPS)[number]

export function isNextStep(value: unknown): value is NextStep {
  return typeof value === 'string' && (NEXT_STEPS as readonly string[]).includes(value)
}

/** Who receives a notice, resolved from the case's current participants. */
type Audience = 'owner' | 'chief' | 'round' | 'investment' | 'secretariat'

interface Notice {
  to: Audience
  step: NextStep | null
}

interface NextRoleRule {
  notices: Notice[]
  /** Steps on the case that this transition settles for every recipient. */
  clears?: NextStep[]
  /** Saving a draft is not acting on the step, so the actor's own steps stay pending. */
  keepsActorSteps?: boolean
}

/** Transition → who acts next. Transitions not listed notify nobody. */
export const NEXT_ROLE_RULES: Record<string, NextRoleRule> = {
  submit: { notices: [{ to: 'owner', step: null }, { to: 'chief', step: 'triage' }] },
  chief_accept: { notices: [{ to: 'owner', step: null }], clears: ['triage'] },
  chief_return: { notices: [{ to: 'owner', step: 'correct' }], clears: ['triage'] },
  chief_reject: { notices: [{ to: 'owner', step: null }], clears: ['triage'] },
  correction_submit: { notices: [{ to: 'owner', step: null }, { to: 'chief', step: 'triage' }], clears: ['correct'] },
  owner_reopen: { notices: [{ to: 'owner', step: null }, { to: 'chief', step: 'triage' }] },
  review_round_start: { notices: [{ to: 'round', step: 'evaluate' }] },
  chief_replace_reviewer: { notices: [{ to: 'round', step: 'evaluate' }] },
  owner_replace_employer: { notices: [{ to: 'round', step: 'evaluate' }] },
  review_round_complete: { notices: [{ to: 'chief', step: 'decide' }], clears: ['evaluate'] },
  chief_review_advance: { notices: [{ to: 'owner', step: 'financial_package' }], clears: ['decide'] },
  chief_review_return: { notices: [{ to: 'owner', step: 'correct' }], clears: ['decide'] },
  chief_review_reject: { notices: [{ to: 'owner', step: null }], clears: ['decide'] },
  financial_package_submit: { notices: [{ to: 'secretariat', step: null }], clears: ['financial_package'] },
  investment_handoff: { notices: [{ to: 'investment', step: 'investment_memo' }] },
  investment_memo_save: { notices: [], keepsActorSteps: true },
  investment_memo_send: { notices: [{ to: 'secretariat', step: 'publish_result' }], clears: ['investment_memo'] },
  // The request is itself a case letter to the company and carries the upload step.
  supplementary_request: { notices: [] },
  supplementary_delivery: { notices: [{ to: 'investment', step: null }], clears: ['supplementary_upload'] },
  result_save: { notices: [], keepsActorSteps: true },
  // The follow-up repository enqueues the versioned publication notice itself.
  result_publish: { notices: [], clears: ['publish_result'] },
}

interface CaseRef {
  id: string
  ownerId: string
  revision: number
  title: string
  trackingCode: string | null
}

/** Booth requests (S7): the company asks, Secretariat decides attendance, then the receipt. */
export const BOOTH_NEXT_ROLE_RULES: Record<string, NextRoleRule> = {
  booth_request: { notices: [{ to: 'secretariat', step: 'attendance_decision' }] },
  booth_attendance_approve: { notices: [{ to: 'owner', step: 'booth_receipt' }], clears: ['attendance_decision'] },
  booth_attendance_reject: { notices: [{ to: 'owner', step: null }], clears: ['attendance_decision'] },
  booth_receipt_submit: { notices: [{ to: 'secretariat', step: 'receipt_decision' }], clears: ['booth_receipt'] },
  booth_receipt_confirm: { notices: [{ to: 'owner', step: null }], clears: ['receipt_decision'] },
  booth_receipt_return: { notices: [{ to: 'owner', step: 'booth_receipt' }], clears: ['receipt_decision'] },
}

export interface NotifyNextRoleInput {
  requestId: string
  actorId: string
  action: string
  fromState: string
  toState: string
  /** Overrides the default notice text for every recipient. */
  title?: string
  body?: string
  reason?: string | null
  /**
   * The caller delivers the returned jobs itself after commit (the T37 outbox model).
   * Otherwise the in-app letter is written inside the transition's transaction.
   */
  deliverAfterCommit?: boolean
}

async function recipientsOf(client: PoolClient, audience: Audience, request: CaseRef): Promise<string[]> {
  switch (audience) {
    case 'owner':
      return [request.ownerId]
    case 'chief':
    case 'investment': {
      const role = audience === 'chief' ? 'chief-reviewer' : 'investment-reviewer'
      const { rows } = await client.query<{ user_id: string }>(
        `SELECT user_id FROM dashboard.case_assignments WHERE request_id = $1 AND role = $2 AND active`,
        [request.id, role],
      )
      return rows.map((row) => row.user_id)
    }
    case 'round': {
      // The current round's active reviewers and employer.
      const { rows } = await client.query<{ user_id: string }>(
        `SELECT ca.user_id FROM dashboard.case_assignments ca
         WHERE ca.request_id = $1 AND ca.active AND ca.round_id = (
           SELECT rr.id FROM dashboard.review_rounds rr
           WHERE rr.request_id = $1 ORDER BY rr.request_revision DESC LIMIT 1
         )`,
        [request.id],
      )
      return rows.map((row) => row.user_id)
    }
    case 'secretariat': {
      const { rows } = await client.query<{ id: string }>(
        `SELECT id::text AS id FROM public.users
         WHERE operational_role = 'central-secretariat' AND is_active`,
      )
      return rows.map((row) => row.id)
    }
  }
}

/** Marks pending steps on a case done: the given person's, and/or the listed steps for everyone. */
export async function completeNextSteps(
  client: PoolClient,
  requestId: string,
  options: { userId?: string; steps?: readonly NextStep[] },
): Promise<void> {
  const conditions: string[] = []
  const params: unknown[] = [requestId]
  if (options.userId) {
    params.push(options.userId)
    conditions.push(`recipient_id = $${params.length}`)
  }
  if (options.steps && options.steps.length > 0) {
    params.push([...options.steps])
    conditions.push(`next_step = ANY($${params.length}::text[])`)
  }
  if (conditions.length === 0) return
  await client.query(
    `UPDATE dashboard.letters SET next_step_done_at = now(), updated_at = now()
     WHERE request_id = $1 AND next_step IS NOT NULL AND next_step_done_at IS NULL
       AND (${conditions.join(' OR ')})`,
    params,
  )
}

function defaultBody(request: CaseRef, title: string, reason?: string | null): string {
  const code = request.trackingCode ? ` با کد رهگیری ${request.trackingCode}` : ''
  return `${title} — درخواست ${request.title}${code}${reason ? `: ${reason}` : ''}`
}

/**
 * Settles the steps this transition answers and notifies whoever acts next, inside
 * the transition's own transaction. Callers that already deliver after commit pass
 * `deliverAfterCommit` and keep the T37 recovery model. Elsewhere the in-app letter
 * commits with the transition; with the outbox's failure simulation on, the jobs
 * stay pending for operator recovery. Returns the job ids.
 */
export async function notifyNextRole(
  client: PoolClient,
  outbox: NotificationOutbox,
  input: NotifyNextRoleInput,
): Promise<string[]> {
  const rule = NEXT_ROLE_RULES[input.action]
  if (!rule) return []
  // Read after the transition's own update, so the notice carries the new revision.
  const { rows: found } = await client.query<{ owner_id: string; revision: number; title: string; tracking_code: string | null }>(
    `SELECT owner_id, revision, title, tracking_code FROM dashboard.requests WHERE id = $1`,
    [input.requestId],
  )
  if (!found[0]) return []
  const request: CaseRef = {
    id: input.requestId,
    ownerId: found[0].owner_id,
    revision: found[0].revision,
    title: found[0].title,
    trackingCode: found[0].tracking_code,
  }
  await completeNextSteps(client, request.id, {
    userId: rule.keepsActorSteps ? undefined : input.actorId,
    steps: rule.clears,
  })

  const title = input.title ?? TRANSITION_TITLES[input.action] ?? input.action
  const body = input.body ?? defaultBody(request, title, input.reason)
  const jobIds: string[] = []
  for (const notice of rule.notices) {
    for (const recipientId of new Set(await recipientsOf(client, notice.to, request))) {
      // Nobody is asked to act on their own transition.
      if (notice.step && recipientId === input.actorId) continue
      if (notice.step) {
        const pending = await client.query(
          `SELECT 1 FROM dashboard.letters
           WHERE request_id = $1 AND recipient_id = $2 AND next_step = $3 AND next_step_done_at IS NULL
           LIMIT 1`,
          [request.id, recipientId, notice.step],
        )
        if ((pending.rowCount ?? 0) > 0) continue
      }
      const job = await outbox.enqueue(client, {
        requestId: request.id,
        recipientId,
        actorId: input.actorId,
        action: input.action,
        fromState: input.fromState,
        toState: input.toState,
        revision: request.revision,
        title,
        body,
        nextStep: notice.step,
      })
      jobIds.push(job.id)
      if (input.deliverAfterCommit || job.status === 'delivered' || outbox.isSimulationFailure()) continue
      const { rows } = await client.query<NotificationJobRow>(
        `SELECT * FROM dashboard.notification_jobs WHERE id = $1 FOR UPDATE`,
        [job.id],
      )
      if (rows[0]) await deliverInApp(client, rows[0])
    }
  }
  return jobIds
}

export interface NotifyBoothStepInput {
  reservationId: string
  actorId: string
  action: keyof typeof BOOTH_NEXT_ROLE_RULES
  reason?: string | null
}

/**
 * Next-role notices for a booth request, sent after the booth action committed:
 * the booth repositories own their transactions, so the notice runs in its own.
 * A failed notice never undoes or fails the booth action; it is logged and the
 * inbox simply lacks that item. Returns the job ids.
 */
export async function notifyBoothStep(pool: Pool, outbox: NotificationOutbox, input: NotifyBoothStepInput): Promise<string[]> {
  const rule = BOOTH_NEXT_ROLE_RULES[input.action]
  if (!rule) return []
  let client: PoolClient
  try {
    client = await pool.connect()
  } catch (error) {
    console.error('[next-role] booth notice skipped: no connection', input.action, input.reservationId, error)
    return []
  }
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<{ requested_by: string; identifier: string | null; attendance_status: string }>(
      `SELECT r.requested_by, b.identifier, r.attendance_status
       FROM dashboard.booth_reservations r
       LEFT JOIN dashboard.exhibition_booths b ON b.id = r.booth_id
       WHERE r.id = $1`,
      [input.reservationId],
    )
    const reservation = rows[0]
    if (!reservation) {
      await client.query('ROLLBACK')
      return []
    }
    await client.query(
      `UPDATE dashboard.letters SET next_step_done_at = now(), updated_at = now()
       WHERE booth_reservation_id = $1 AND next_step IS NOT NULL AND next_step_done_at IS NULL
         AND (recipient_id = $2 OR next_step = ANY($3::text[]))`,
      [input.reservationId, input.actorId, [...(rule.clears ?? [])]],
    )
    const title = TRANSITION_TITLES[input.action] ?? input.action
    const booth = reservation.identifier ? ` غرفه ${reservation.identifier}` : ''
    const body = `${title} —${booth}${input.reason ? `: ${input.reason}` : ''}`
    const jobIds: string[] = []
    for (const notice of rule.notices) {
      const recipients = notice.to === 'owner'
        ? [reservation.requested_by]
        : (await client.query<{ id: string }>(
            `SELECT id::text AS id FROM public.users WHERE operational_role = 'central-secretariat' AND is_active`,
          )).rows.map((row) => row.id)
      for (const recipientId of new Set(recipients)) {
        if (notice.step && recipientId === input.actorId) continue
        if (notice.step) {
          const pending = await client.query(
            `SELECT 1 FROM dashboard.letters
             WHERE booth_reservation_id = $1 AND recipient_id = $2 AND next_step = $3 AND next_step_done_at IS NULL
             LIMIT 1`,
            [input.reservationId, recipientId, notice.step],
          )
          if ((pending.rowCount ?? 0) > 0) continue
        }
        const job = await outbox.enqueue(client, {
          requestId: null,
          boothReservationId: input.reservationId,
          recipientId,
          actorId: input.actorId,
          action: input.action,
          fromState: reservation.attendance_status,
          toState: reservation.attendance_status,
          revision: 0,
          title,
          body,
          nextStep: notice.step,
        })
        jobIds.push(job.id)
        if (outbox.isSimulationFailure()) continue
        const { rows: jobs } = await client.query<NotificationJobRow>(
          `SELECT * FROM dashboard.notification_jobs WHERE id = $1 FOR UPDATE`,
          [job.id],
        )
        if (jobs[0]) await deliverInApp(client, jobs[0])
      }
    }
    await client.query('COMMIT')
    return jobIds
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    console.error('[next-role] booth notice failed', input.action, input.reservationId, error)
    return []
  } finally {
    client.release()
  }
}
