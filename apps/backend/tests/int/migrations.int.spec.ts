import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'

import { runMigrations } from '../../src/db/migrate.js'

// Slice 2 — backend migrations: node-pg-migrate creates the dashboard tables
// (requests, letters, activities) in the `dashboard` schema.
const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:dacho@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString })

const tableColumns = async (table: string): Promise<string[]> => {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'dashboard'`,
    [table],
  )
  return rows.map((r) => r.column_name as string)
}

describe('dashboard migrations', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  afterAll(async () => {
    await pool.end()
  })

  it('creates the requests table with the request fields', async () => {
    const cols = await tableColumns('requests')
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'tracking_code',
        'title',
        'service_id',
        'service_key',
        'owner_id',
        'status',
        'current_step_index',
        'assigned_role',
        'answers',
        'submission_date',
        'due_date',
      ]),
    )
  })

  it('creates the letters table with the letter fields', async () => {
    const cols = await tableColumns('letters')
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'type',
        'title',
        'body',
        'sender_id',
        'sender_name',
        'sender_role',
        'recipient_id',
        'request_id',
        'read',
        'sent_at',
        'attachments',
      ]),
    )
  })

  it('creates the activities table with the activity fields', async () => {
    const cols = await tableColumns('activities')
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'owner_id', 'request_id', 'letter_id', 'type', 'title', 'description', 'at']),
    )
  })

  it('adds transition history fields without breaking the activity view', async () => {
    const cols = await tableColumns('activities')
    expect(cols).toEqual(
      expect.arrayContaining(['actor_id', 'action', 'reason', 'from_state', 'to_state', 'revision']),
    )
    expect(await tableColumns('requests')).toEqual(expect.arrayContaining(['revision']))
  })

  it('creates the support ticket messages table', async () => {
    const cols = await tableColumns('support_ticket_messages')
    expect(cols).toEqual(expect.arrayContaining(['id', 'ticket_id', 'author_id', 'author_role', 'body', 'created_at']))
  })

  it('creates the events table with the registration window and responsible people', async () => {
    const cols = await tableColumns('events')
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'title',
        'description',
        'registration_open_at',
        'registration_close_at',
        'responsible_chief_id',
        'responsible_investment_id',
        'revision',
        'created_by',
        'created_at',
        'updated_at',
      ]),
    )
  })

  it('creates the event audit table with actor, reason, revision and snapshots', async () => {
    const cols = await tableColumns('event_audit')
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'event_id',
        'revision',
        'actor_id',
        'reason',
        'changed_fields',
        'before_state',
        'after_state',
        'created_at',
      ]),
    )
  })

  it('creates the notification_jobs table with the outbox fields', async () => {
    const cols = await tableColumns('notification_jobs')
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'request_id',
        'recipient_id',
        'actor_id',
        'action',
        'from_state',
        'to_state',
        'revision',
        'channel',
        'title',
        'body',
        'status',
        'attempts',
        'last_error',
        'letter_id',
        'created_at',
        'updated_at',
        'processed_at',
      ]),
    )
  })

  it('types requests.status with the request_status enum', async () => {
    const { rows } = await pool.query(
      `SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'requests' AND table_schema = 'dashboard' AND column_name = 'status'`,
    )
    expect(rows[0]?.data_type).toBe('USER-DEFINED')
    expect(rows[0]?.udt_name).toBe('request_status')
  })
})
