import { randomUUID } from 'node:crypto'

import type { Pool } from 'pg'

export interface EventConfiguration {
  id: string
  title: string
  description: string
  registrationOpenAt: string
  registrationCloseAt: string
  responsibleChiefId: string
  responsibleInvestmentId: string
  revision: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface EventInput {
  title: string
  description: string
  registrationOpenAt: string
  registrationCloseAt: string
  responsibleChiefId: string
  responsibleInvestmentId: string
}

export interface CreateEventInput extends EventInput {
  createdBy: string
}

export interface UpdateEventInput extends EventInput {
  expectedRevision: number
  actorId: string
  reason: string
}

export type EventUpdateResult =
  | { ok: true; event: EventConfiguration }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'stale'; event: EventConfiguration }

export interface EventAuditEntry {
  id: string
  eventId: string
  revision: number
  actorId: string
  reason: string
  changedFields: string[]
  before: EventConfiguration
  after: EventConfiguration
  createdAt: string
}

export interface EventStore {
  create(input: CreateEventInput): Promise<EventConfiguration>
  update(id: string, input: UpdateEventInput): Promise<EventUpdateResult>
  findById(id: string): Promise<EventConfiguration | undefined>
  list(): Promise<EventConfiguration[]>
  listAudit(eventId: string): Promise<EventAuditEntry[]>
}

export const EVENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isEventId(value: string): boolean {
  return EVENT_ID_PATTERN.test(value)
}

interface EventRow {
  id: string
  title: string
  description: string
  registration_open_at: Date
  registration_close_at: Date
  responsible_chief_id: string
  responsible_investment_id: string
  revision: number
  created_by: string
  created_at: Date
  updated_at: Date
}

interface EventAuditRow {
  id: string
  event_id: string
  revision: number
  actor_id: string
  reason: string
  changed_fields: string[]
  before_state: EventConfiguration
  after_state: EventConfiguration
  created_at: Date
}

const EVENT_COLUMNS = `
  id, title, description, registration_open_at, registration_close_at,
  responsible_chief_id, responsible_investment_id, revision, created_by, created_at, updated_at
`

const AUDITED_EVENT_FIELDS = [
  'title',
  'description',
  'registrationOpenAt',
  'registrationCloseAt',
  'responsibleChiefId',
  'responsibleInvestmentId',
] as const satisfies readonly (keyof EventInput)[]

function mapRow(row: EventRow): EventConfiguration {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    registrationOpenAt: row.registration_open_at.toISOString(),
    registrationCloseAt: row.registration_close_at.toISOString(),
    responsibleChiefId: row.responsible_chief_id,
    responsibleInvestmentId: row.responsible_investment_id,
    revision: row.revision,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function mapAuditRow(row: EventAuditRow): EventAuditEntry {
  return {
    id: row.id,
    eventId: row.event_id,
    revision: row.revision,
    actorId: row.actor_id,
    reason: row.reason,
    changedFields: row.changed_fields,
    before: row.before_state,
    after: row.after_state,
    createdAt: row.created_at.toISOString(),
  }
}

function changedEventFields(before: EventConfiguration, after: EventConfiguration): string[] {
  return AUDITED_EVENT_FIELDS.filter((field) => before[field] !== after[field])
}

export class EventRepository implements EventStore {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateEventInput): Promise<EventConfiguration> {
    const { rows } = await this.pool.query<EventRow>(
      `INSERT INTO dashboard.events (
         title, description, registration_open_at, registration_close_at,
         responsible_chief_id, responsible_investment_id, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${EVENT_COLUMNS}`,
      [
        input.title,
        input.description,
        input.registrationOpenAt,
        input.registrationCloseAt,
        input.responsibleChiefId,
        input.responsibleInvestmentId,
        input.createdBy,
      ],
    )
    const row = rows[0]
    if (!row) throw new Error('INSERT events returned no row')
    return mapRow(row)
  }

  async update(id: string, input: UpdateEventInput): Promise<EventUpdateResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: currentRows } = await client.query<EventRow>(
        `SELECT ${EVENT_COLUMNS} FROM dashboard.events WHERE id = $1 FOR UPDATE`,
        [id],
      )
      const currentRow = currentRows[0]
      if (!currentRow) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'not_found' }
      }
      const current = mapRow(currentRow)
      if (current.revision !== input.expectedRevision) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'stale', event: current }
      }

      const { rows } = await client.query<EventRow>(
        `UPDATE dashboard.events
         SET title = $2,
             description = $3,
             registration_open_at = $4,
             registration_close_at = $5,
             responsible_chief_id = $6,
             responsible_investment_id = $7,
             revision = revision + 1,
             updated_at = now()
         WHERE id = $1 AND revision = $8
         RETURNING ${EVENT_COLUMNS}`,
        [
          id,
          input.title,
          input.description,
          input.registrationOpenAt,
          input.registrationCloseAt,
          input.responsibleChiefId,
          input.responsibleInvestmentId,
          input.expectedRevision,
        ],
      )
      const row = rows[0]
      if (!row) {
        const { rows: latestRows } = await client.query<EventRow>(
          `SELECT ${EVENT_COLUMNS} FROM dashboard.events WHERE id = $1`,
          [id],
        )
        await client.query('ROLLBACK')
        const latest = latestRows[0]
        return latest
          ? { ok: false, error: 'stale', event: mapRow(latest) }
          : { ok: false, error: 'not_found' }
      }

      const event = mapRow(row)
      await client.query(
        `INSERT INTO dashboard.event_audit (
           event_id, revision, actor_id, reason, changed_fields, before_state, after_state
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          event.id,
          event.revision,
          input.actorId,
          input.reason,
          changedEventFields(current, event),
          JSON.stringify(current),
          JSON.stringify(event),
        ],
      )
      await client.query('COMMIT')
      return { ok: true, event }
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Preserve the original failure when the connection is already gone.
      }
      throw error
    } finally {
      client.release()
    }
  }

  async findById(id: string): Promise<EventConfiguration | undefined> {
    const { rows } = await this.pool.query<EventRow>(
      `SELECT ${EVENT_COLUMNS} FROM dashboard.events WHERE id = $1`,
      [id],
    )
    const row = rows[0]
    return row ? mapRow(row) : undefined
  }

  async list(): Promise<EventConfiguration[]> {
    const { rows } = await this.pool.query<EventRow>(
      `SELECT ${EVENT_COLUMNS} FROM dashboard.events ORDER BY created_at DESC, id ASC`,
    )
    return rows.map(mapRow)
  }

  async listAudit(eventId: string): Promise<EventAuditEntry[]> {
    const { rows } = await this.pool.query<EventAuditRow>(
      `SELECT id, event_id, revision, actor_id, reason, changed_fields,
              before_state, after_state, created_at
       FROM dashboard.event_audit
       WHERE event_id = $1
       ORDER BY revision ASC, created_at ASC`,
      [eventId],
    )
    return rows.map(mapAuditRow)
  }
}

/** Keeps authorization and validation tests independent of a live Postgres. */
export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, EventConfiguration>()
  private readonly auditEntries: EventAuditEntry[] = []

  async create(input: CreateEventInput): Promise<EventConfiguration> {
    const now = new Date().toISOString()
    const event: EventConfiguration = {
      id: randomUUID(),
      ...input,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    }
    this.events.set(event.id, event)
    return event
  }

  async update(id: string, input: UpdateEventInput): Promise<EventUpdateResult> {
    const existing = this.events.get(id)
    if (!existing) return { ok: false, error: 'not_found' }
    if (existing.revision !== input.expectedRevision) {
      return { ok: false, error: 'stale', event: existing }
    }
    const now = new Date().toISOString()
    const event: EventConfiguration = {
      id: existing.id,
      title: input.title,
      description: input.description,
      registrationOpenAt: input.registrationOpenAt,
      registrationCloseAt: input.registrationCloseAt,
      responsibleChiefId: input.responsibleChiefId,
      responsibleInvestmentId: input.responsibleInvestmentId,
      revision: existing.revision + 1,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: now,
    }
    this.events.set(id, event)
    this.auditEntries.push({
      id: randomUUID(),
      eventId: id,
      revision: event.revision,
      actorId: input.actorId,
      reason: input.reason,
      changedFields: changedEventFields(existing, event),
      before: existing,
      after: event,
      createdAt: now,
    })
    return { ok: true, event }
  }

  async findById(id: string): Promise<EventConfiguration | undefined> {
    return this.events.get(id)
  }

  async list(): Promise<EventConfiguration[]> {
    return [...this.events.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  async listAudit(eventId: string): Promise<EventAuditEntry[]> {
    return this.auditEntries
      .filter((entry) => entry.eventId === eventId)
      .sort((left, right) => left.revision - right.revision)
  }
}
