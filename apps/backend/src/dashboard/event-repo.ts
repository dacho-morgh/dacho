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

export interface EventStore {
  create(input: CreateEventInput): Promise<EventConfiguration>
  update(id: string, input: EventInput): Promise<EventConfiguration | undefined>
  findById(id: string): Promise<EventConfiguration | undefined>
  list(): Promise<EventConfiguration[]>
}

interface EventRow {
  id: string
  title: string
  description: string
  registration_open_at: Date
  registration_close_at: Date
  responsible_chief_id: string
  responsible_investment_id: string
  created_by: string
  created_at: Date
  updated_at: Date
}

const EVENT_COLUMNS = `
  id, title, description, registration_open_at, registration_close_at,
  responsible_chief_id, responsible_investment_id, created_by, created_at, updated_at
`

function mapRow(row: EventRow): EventConfiguration {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    registrationOpenAt: row.registration_open_at.toISOString(),
    registrationCloseAt: row.registration_close_at.toISOString(),
    responsibleChiefId: row.responsible_chief_id,
    responsibleInvestmentId: row.responsible_investment_id,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
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

  async update(id: string, input: EventInput): Promise<EventConfiguration | undefined> {
    const { rows } = await this.pool.query<EventRow>(
      `UPDATE dashboard.events
       SET title = $2,
           description = $3,
           registration_open_at = $4,
           registration_close_at = $5,
           responsible_chief_id = $6,
           responsible_investment_id = $7,
           updated_at = now()
       WHERE id = $1
       RETURNING ${EVENT_COLUMNS}`,
      [
        id,
        input.title,
        input.description,
        input.registrationOpenAt,
        input.registrationCloseAt,
        input.responsibleChiefId,
        input.responsibleInvestmentId,
      ],
    )
    const row = rows[0]
    return row ? mapRow(row) : undefined
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
}

/** Keeps authorization and validation tests independent of a live Postgres. */
export class InMemoryEventStore implements EventStore {
  private readonly events = new Map<string, EventConfiguration>()

  async create(input: CreateEventInput): Promise<EventConfiguration> {
    const now = new Date().toISOString()
    const event: EventConfiguration = {
      id: randomUUID(),
      ...input,
      createdAt: now,
      updatedAt: now,
    }
    this.events.set(event.id, event)
    return event
  }

  async update(id: string, input: EventInput): Promise<EventConfiguration | undefined> {
    const existing = this.events.get(id)
    if (!existing) return undefined
    const event: EventConfiguration = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    }
    this.events.set(id, event)
    return event
  }

  async findById(id: string): Promise<EventConfiguration | undefined> {
    return this.events.get(id)
  }

  async list(): Promise<EventConfiguration[]> {
    return [...this.events.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }
}
