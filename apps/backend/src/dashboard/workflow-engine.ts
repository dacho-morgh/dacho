import type { Pool } from 'pg'

import type { ServiceCatalog } from '../catalog/service-catalog.js'
import { mapRequestRow, REQUEST_COLUMNS, type RequestDto, type RequestRow, type RequestStatus } from './request-repo.js'

export type TransitionType = 'forward' | 'return-to-company' | 'return-to-previous' | 'reject'

export interface Actor {
  userId: string
  /** Role ids the actor holds (from the m2m `roles` collection). */
  roles: string[]
  cmsRole?: string
}

export type TransitionError =
  | 'request_not_found'
  | 'service_not_found'
  | 'invalid_state'
  | 'forbidden'
  | 'invalid_transition'

export type TransitionOutcome = { request: RequestDto } | { error: TransitionError }

const LETTER_TITLES: Record<'approved' | 'needs_fix' | 'rejected', string> = {
  approved: 'تایید درخواست',
  needs_fix: 'نیاز به اصلاح',
  rejected: 'رد درخواست',
}

const ACTIVITY_TITLES: Record<TransitionType, string> = {
  forward: 'انتقال به مرحله بعد',
  'return-to-company': 'بازگشت به متقاضی',
  'return-to-previous': 'بازگشت به مرحله قبل',
  reject: 'رد درخواست',
}

/**
 * Role-gated state machine over a request's workflow steps. Each transition
 * updates the request, creates the outcome letter (when applicable) and appends
 * an activity-log entry in a single DB transaction.
 */
export class WorkflowEngine {
  constructor(
    private readonly pool: Pool,
    private readonly catalog: ServiceCatalog,
  ) {}

  async transition(input: {
    requestId: string
    actor: Actor
    transition: TransitionType
    note?: string
  }): Promise<TransitionOutcome> {
    const request = await this.findRequest(input.requestId)
    if (!request) return { error: 'request_not_found' }

    const service = await this.catalog.findById(request.serviceId)
    if (!service) return { error: 'service_not_found' }

    const workflow = service.workflow
    if (workflow.length === 0) return { error: 'invalid_state' }
    if (request.status !== 'in_review') return { error: 'invalid_state' }

    const currentIndex = request.currentStepIndex
    const currentStep = workflow[currentIndex]
    if (!currentStep) return { error: 'invalid_state' }

    // Role gate: the actor must hold the current step's role; cmsRole admin overrides.
    if (input.actor.cmsRole !== 'admin' && !input.actor.roles.includes(currentStep.role)) {
      return { error: 'forbidden' }
    }

    let nextIndex = currentIndex
    let nextStatus: RequestStatus = request.status
    let letterType: 'approved' | 'needs_fix' | 'rejected' | null = null

    switch (input.transition) {
      case 'forward':
        if (currentIndex === workflow.length - 1) {
          nextStatus = 'approved'
          letterType = 'approved'
        } else {
          nextIndex = currentIndex + 1
        }
        break
      case 'return-to-company':
        nextIndex = 0
        nextStatus = 'action_needed'
        letterType = 'needs_fix'
        break
      case 'return-to-previous':
        if (currentIndex === 0) return { error: 'invalid_transition' }
        nextIndex = currentIndex - 1
        break
      case 'reject':
        nextStatus = 'rejected'
        letterType = 'rejected'
        break
    }

    const assignedRole = nextStatus === 'in_review' ? (workflow[nextIndex]?.roleName ?? null) : null
    const currentStepTitle = nextStatus === 'in_review' ? (workflow[nextIndex]?.title ?? null) : null

    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      const updated = await client.query<RequestRow>(
        `UPDATE dashboard.requests
         SET status = $1, current_step_index = $2, assigned_role = $3, current_step = $4, updated_at = now()
         WHERE id = $5
         RETURNING ${REQUEST_COLUMNS}`,
        [nextStatus, nextIndex, assignedRole, currentStepTitle, request.id],
      )

      let letterId: string | null = null
      if (letterType) {
        const letter = await client.query<{ id: string }>(
          `INSERT INTO dashboard.letters (type, title, body, recipient_id, request_id, read)
           VALUES ($1, $2, $3, $4, $5, false)
           RETURNING id`,
          [letterType, LETTER_TITLES[letterType], input.note ?? '', request.ownerId, request.id],
        )
        letterId = letter.rows[0]?.id ?? null
      }

      await client.query(
        `INSERT INTO dashboard.activities (owner_id, request_id, letter_id, type, title, description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          request.ownerId,
          request.id,
          letterId,
          'transition',
          ACTIVITY_TITLES[input.transition],
          input.note ?? null,
        ],
      )

      await client.query('COMMIT')

      const row = updated.rows[0]
      if (!row) throw new Error('UPDATE dashboard.requests returned no row')
      return { request: mapRequestRow(row) }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  private async findRequest(id: string): Promise<RequestDto | undefined> {
    const { rows } = await this.pool.query<RequestRow>(
      `SELECT ${REQUEST_COLUMNS} FROM dashboard.requests WHERE id = $1`,
      [id],
    )
    const row = rows[0]
    return row ? mapRequestRow(row) : undefined
  }
}
