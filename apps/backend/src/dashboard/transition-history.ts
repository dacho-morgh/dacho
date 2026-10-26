import type { PoolClient } from 'pg'

export const TRANSITION_TITLES: Record<string, string> = {
  submit: 'ارسال درخواست',
}

export interface TransitionInput {
  requestId: string
  ownerId: string
  actorId: string
  action: string
  fromState: string
  toState: string
  revision: number
  reason?: string | null
}

export async function appendTransition(client: PoolClient, input: TransitionInput): Promise<void> {
  await client.query(
    `INSERT INTO dashboard.activities
       (owner_id, request_id, letter_id, type, title, description,
        actor_id, action, reason, from_state, to_state, revision)
     VALUES ($1, $2, NULL, 'transition', $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.ownerId,
      input.requestId,
      TRANSITION_TITLES[input.action] ?? input.action,
      input.reason ?? null,
      input.actorId,
      input.action,
      input.reason ?? null,
      input.fromState,
      input.toState,
      input.revision,
    ],
  )
}
