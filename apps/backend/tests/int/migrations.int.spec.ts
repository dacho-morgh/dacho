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

  it('creates the event_categories table with event_id, title, and timestamps', async () => {
    const cols = await tableColumns('event_categories')
    expect(cols).toEqual(
      expect.arrayContaining(['id', 'event_id', 'title', 'created_at', 'updated_at']),
    )
  })

  it('creates the event_subtopics table with category_id, title, employer_id, and timestamps', async () => {
    const cols = await tableColumns('event_subtopics')
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'event_id',
        'category_id',
        'title',
        'employer_id',
        'created_at',
        'updated_at',
      ]),
    )
  })

  it('adds attendance fields to booth_reservations and creates booth_attendance_decisions', async () => {
    const resCols = await tableColumns('booth_reservations')
    expect(resCols).toEqual(
      expect.arrayContaining([
        'attendance_status',
        'attendance_reason',
        'attendance_decided_by',
        'attendance_decided_at',
      ]),
    )

    const decCols = await tableColumns('booth_attendance_decisions')
    expect(decCols).toEqual(
      expect.arrayContaining([
        'id',
        'reservation_id',
        'action',
        'from_status',
        'to_status',
        'reason',
        'decided_by',
        'created_at',
      ]),
    )
  })

  it('creates the company_verifications table with status enum and required columns', async () => {
    const cols = await tableColumns('company_verifications')
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'company_id',
        'representative_id',
        'status',
        'revision',
        'snapshot',
        'submitted_at',
        'decided_at',
        'reviewer_id',
        'reason',
        'created_at',
        'updated_at',
      ]),
    )
    const { rows } = await pool.query(
      `SELECT data_type, udt_name FROM information_schema.columns WHERE table_name = 'company_verifications' AND table_schema = 'dashboard' AND column_name = 'status'`,
    )
    expect(rows[0]?.data_type).toBe('USER-DEFINED')
    expect(rows[0]?.udt_name).toBe('company_verification_status')
  })

  it('creates the request_verifications table with required columns', async () => {
    const cols = await tableColumns('request_verifications')
    expect(cols).toEqual(
      expect.arrayContaining([
        'request_id',
        'company_id',
        'verification_id',
        'revision',
        'snapshot',
        'created_at',
      ]),
    )
  })
})
