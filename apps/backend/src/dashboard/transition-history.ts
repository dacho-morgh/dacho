import type { PoolClient } from 'pg'

export const TRANSITION_TITLES: Record<string, string> = {
  submit: 'ارسال درخواست',
  chief_accept: 'تأیید اولیه درخواست',
  chief_return: 'برگشت درخواست جهت اصلاح',
  chief_reject: 'رد درخواست',
  correction_submit: 'ارسال اصلاحیه درخواست',
  review_round_start: 'شروع دور داوری',
  review_round_complete: 'تکمیل چهار ارزیابی دور داوری',
  chief_review_advance: 'تأیید عبور از مرحله داوری',
  chief_review_return: 'برگشت پروپوزال جهت اصلاح پس از داوری',
  chief_review_reject: 'رد درخواست پس از داوری',
  chief_replace_reviewer: 'جایگزینی داور',
  owner_replace_employer: 'جایگزینی کارفرما توسط صاحب سیستم',
  owner_reopen: 'بازگشایی درخواست توسط صاحب سیستم',
  verification_submit: 'ارسال مدارک برای احراز',
  verification_approve: 'تأیید مدارک احراز',
  verification_return: 'برگشت مدارک احراز جهت اصلاح',
  verification_reject: 'رد مدارک احراز',
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
