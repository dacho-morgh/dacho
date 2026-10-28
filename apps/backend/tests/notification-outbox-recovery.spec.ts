import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import {
  PostgresNotificationOutbox,
  type NotificationJobRow,
} from '../src/dashboard/notification-outbox.js'
import { RequestRepository, type RequestRow } from '../src/dashboard/request-repo.js'

const requestId = 'a0000000-0000-0000-0000-000000000001'
const jobId = 'b0000000-0000-0000-0000-000000000001'

// A one-connection pool fails additional checkouts rather than leaving a test
// hanging forever. SQL effects below model the request and its notification.
function singleConnectionPool() {
  let leased = false
  const now = new Date()
  const job: NotificationJobRow = {
    id: jobId, request_id: requestId, recipient_id: 'person', actor_id: 'person',
    action: 'submit', from_state: 'draft', to_state: 'in_review', revision: 2,
    channel: 'in_app', title: 'Submitted', body: 'Submitted', status: 'pending',
    attempts: 0, last_error: null, letter_id: null, created_at: now,
    updated_at: now, processed_at: null,
  }
  const submitted: RequestRow & { revision: number } = {
    id: requestId, tracking_code: 'DCH-2026-1', title: 'Request', service_id: '1',
    service_key: 'financing', service_name: 'Financing', owner_id: 'person', company_id: null,
    status: 'in_review', current_step_index: 0, assigned_role: null, current_step: null,
    answers: {}, submission_date: now, due_date: null, created_at: now, updated_at: now,
    revision: 2,
  }
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('UPDATE dashboard.requests')) return { rows: [submitted] }
      if (sql.includes('INSERT INTO dashboard.notification_jobs') || sql.startsWith('SELECT *'))
        return { rows: [{ ...job }] }
      if (sql.includes('INSERT INTO dashboard.letters')) return { rows: [{ id: 'letter' }] }
      if (sql.includes("SET status = 'delivered'")) job.status = 'delivered'
      if (sql.includes("SET status = 'failed'")) job.status = 'failed'
      return { rows: [] }
    }),
    release: vi.fn(() => { leased = false }),
  }
  const pool = {
    connect: vi.fn(async () => {
      if (leased) throw new Error('Pool exhausted while retaining its only client')
      leased = true
      return client
    }),
    query: vi.fn(async () => { throw new Error('Unexpected second connection') }),
  }
  return { pool: pool as unknown as Pool, client, job }
}

describe('notification recovery and connection ownership', () => {
  it.each([false, true])('completes submission with one pooled connection (failure=%s)', async (fail) => {
    const { pool, job } = singleConnectionPool()
    const outbox = new PostgresNotificationOutbox(pool)
    outbox.setSimulationFailure(fail)
    const result = await new RequestRepository(pool, outbox).submit(requestId, 'person')

    expect(result).toMatchObject({ id: requestId, status: 'in_review' })
    expect(job.status).toBe(fail ? 'failed' : 'delivered')
  })

  it('records a delivery failure using the available client after rollback', async () => {
    const { pool, job } = singleConnectionPool()
    const outbox = new PostgresNotificationOutbox(pool)
    outbox.setSimulationFailure(true)

    expect(await outbox.deliver(jobId)).toMatchObject({ status: 'failed' })
    expect(job.status).toBe('failed')
  })
})
