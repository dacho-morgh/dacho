import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'

export interface EventCategory {
  id: string
  eventId: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface EventSubtopic {
  id: string
  eventId: string
  categoryId: string
  title: string
  employerId: string
  currentRfpVersionId?: string | null
  createdAt: string
  updatedAt: string
}

export interface EventSubtopicWithCategory extends EventSubtopic {
  categoryTitle: string
}

export interface CreateSubtopicInput {
  eventId: string
  categoryId: string
  title: string
  employerId: string
}

export interface EventCategoryStore {
  createCategory(eventId: string, title: string): Promise<EventCategory>
  listCategories(eventId: string): Promise<EventCategory[]>
  findCategoryById(id: string): Promise<EventCategory | undefined>
  createSubtopic(input: CreateSubtopicInput): Promise<EventSubtopic>
  listSubtopics(eventId: string): Promise<EventSubtopicWithCategory[]>
  findSubtopicById(id: string): Promise<EventSubtopicWithCategory | undefined>
}

interface CategoryRow {
  id: string
  eventId: string
  title: string
  createdAt: Date
  updatedAt: Date
}

interface SubtopicRow {
  id: string
  eventId: string
  categoryId: string
  title: string
  employerId: string
  currentRfpVersionId?: string | null
  current_rfp_version_id?: string | null
  createdAt: Date
  updatedAt: Date
}

interface SubtopicWithCategoryRow extends SubtopicRow {
  categoryTitle: string
}

function mapCategory(row: CategoryRow): EventCategory {
  return {
    id: row.id,
    eventId: row.eventId,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapSubtopic(row: SubtopicRow): EventSubtopic {
  return {
    id: row.id,
    eventId: row.eventId,
    categoryId: row.categoryId,
    title: row.title,
    employerId: row.employerId,
    currentRfpVersionId: row.currentRfpVersionId ?? row.current_rfp_version_id ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapSubtopicWithCategory(row: SubtopicWithCategoryRow): EventSubtopicWithCategory {
  return {
    ...mapSubtopic(row),
    categoryTitle: row.categoryTitle,
  }
}

export class EventCategoryRepository implements EventCategoryStore {
  constructor(private readonly pool: Pool) {}

  async createCategory(eventId: string, title: string): Promise<EventCategory> {
    const { rows } = await this.pool.query<CategoryRow>(
      `INSERT INTO dashboard.event_categories (event_id, title)
       SELECT id, $2 FROM dashboard.events WHERE id = $1
       RETURNING id, event_id AS "eventId", title, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [eventId, title.trim()],
    )
    if (!rows[0]) throw new Error('Event not found or category insert failed')
    return mapCategory(rows[0])
  }

  async listCategories(eventId: string): Promise<EventCategory[]> {
    const { rows } = await this.pool.query<CategoryRow>(
      `SELECT id, event_id AS "eventId", title, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM dashboard.event_categories
       WHERE event_id = $1
       ORDER BY title ASC, id ASC`,
      [eventId],
    )
    return rows.map(mapCategory)
  }

  async findCategoryById(id: string): Promise<EventCategory | undefined> {
    const { rows } = await this.pool.query<CategoryRow>(
      `SELECT id, event_id AS "eventId", title, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM dashboard.event_categories
       WHERE id = $1`,
      [id],
    )
    return rows[0] ? mapCategory(rows[0]) : undefined
  }

  async createSubtopic(input: CreateSubtopicInput): Promise<EventSubtopic> {
    const { rows } = await this.pool.query<SubtopicRow>(
      `INSERT INTO dashboard.event_subtopics (event_id, category_id, title, employer_id)
       SELECT event_id, id, $3, $4
       FROM dashboard.event_categories
       WHERE id = $2 AND event_id = $1
       RETURNING id, event_id AS "eventId", category_id AS "categoryId", title, employer_id AS "employerId", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [input.eventId, input.categoryId, input.title.trim(), input.employerId.trim()],
    )
    if (!rows[0]) throw new Error('Invalid category or event relationship')
    return mapSubtopic(rows[0])
  }

  async listSubtopics(eventId: string): Promise<EventSubtopicWithCategory[]> {
    const { rows } = await this.pool.query<SubtopicWithCategoryRow>(
      `SELECT s.id, s.event_id AS "eventId", s.category_id AS "categoryId",
              c.title AS "categoryTitle", s.title, s.employer_id AS "employerId",
              s.current_rfp_version_id AS "currentRfpVersionId",
              s.created_at AS "createdAt", s.updated_at AS "updatedAt"
       FROM dashboard.event_subtopics s
       JOIN dashboard.event_categories c ON c.id = s.category_id
       WHERE s.event_id = $1
       ORDER BY c.title ASC, s.title ASC, s.id ASC`,
      [eventId],
    )
    return rows.map(mapSubtopicWithCategory)
  }

  async findSubtopicById(id: string): Promise<EventSubtopicWithCategory | undefined> {
    const { rows } = await this.pool.query<SubtopicWithCategoryRow>(
      `SELECT s.id, s.event_id AS "eventId", s.category_id AS "categoryId",
              c.title AS "categoryTitle", s.title, s.employer_id AS "employerId",
              s.current_rfp_version_id AS "currentRfpVersionId",
              s.created_at AS "createdAt", s.updated_at AS "updatedAt"
       FROM dashboard.event_subtopics s
       JOIN dashboard.event_categories c ON c.id = s.category_id
       WHERE s.id = $1`,
      [id],
    )
    return rows[0] ? mapSubtopicWithCategory(rows[0]) : undefined
  }
}

export class InMemoryEventCategoryStore implements EventCategoryStore {
  private readonly categories = new Map<string, EventCategory>()
  private readonly subtopics = new Map<string, EventSubtopic>()

  async createCategory(eventId: string, title: string): Promise<EventCategory> {
    const id = randomUUID()
    const now = new Date().toISOString()
    const cat: EventCategory = {
      id,
      eventId,
      title: title.trim(),
      createdAt: now,
      updatedAt: now,
    }
    this.categories.set(id, cat)
    return cat
  }

  async listCategories(eventId: string): Promise<EventCategory[]> {
    return [...this.categories.values()]
      .filter((c) => c.eventId === eventId)
      .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
  }

  async findCategoryById(id: string): Promise<EventCategory | undefined> {
    return this.categories.get(id)
  }

  async createSubtopic(input: CreateSubtopicInput): Promise<EventSubtopic> {
    const cat = this.categories.get(input.categoryId)
    if (!cat || cat.eventId !== input.eventId) {
      throw new Error('Invalid category or event relationship')
    }
    const id = randomUUID()
    const now = new Date().toISOString()
    const sub: EventSubtopic = {
      id,
      eventId: input.eventId,
      categoryId: input.categoryId,
      title: input.title.trim(),
      employerId: input.employerId.trim(),
      currentRfpVersionId: null,
      createdAt: now,
      updatedAt: now,
    }
    this.subtopics.set(id, sub)
    return sub
  }

  async listSubtopics(eventId: string): Promise<EventSubtopicWithCategory[]> {
    return [...this.subtopics.values()]
      .filter((s) => s.eventId === eventId)
      .map((s) => ({
        ...s,
        categoryTitle: this.categories.get(s.categoryId)?.title ?? '',
      }))
      .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
  }

  async findSubtopicById(id: string): Promise<EventSubtopicWithCategory | undefined> {
    const sub = this.subtopics.get(id)
    if (!sub) return undefined
    return {
      ...sub,
      categoryTitle: this.categories.get(sub.categoryId)?.title ?? '',
    }
  }
}
