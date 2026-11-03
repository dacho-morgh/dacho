import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'

import type {
  Booth,
  BoothChanges,
  BoothPriceVersion,
  BoothStatus,
  BoothWrite,
  ExhibitionCatalogueSettings,
  PriceUnit,
  SettingsWrite,
} from './catalogue.js'

export type CreateBoothResult =
  | { ok: true; booth: Booth }
  | { ok: false; error: 'duplicate_identifier' }

export type UpdateBoothResult =
  | { ok: true; booth: Booth }
  | { ok: false; error: 'duplicate_identifier' | 'booth_not_found' }

export interface CreateBoothInput extends BoothWrite {
  exhibitionId: string
  createdBy: string
}

export interface UpdateBoothInput extends BoothChanges {
  exhibitionId: string
  boothId: string
  updatedBy: string
}

/** One exhibition's operational state for the owner's admin list (S5). */
export interface ExhibitionAdminSummary {
  exhibitionId: string
  settings: ExhibitionCatalogueSettings | null
  boothCount: number
}

export type VersionedSettingsResult =
  | { ok: true; settings: ExhibitionCatalogueSettings }
  | { ok: false; error: 'stale'; revision: number }

export interface BoothCatalogueRepository {
  getSettings(exhibitionId: string): Promise<ExhibitionCatalogueSettings | undefined>
  upsertSettings(
    exhibitionId: string,
    input: SettingsWrite,
    actorId: string,
  ): Promise<ExhibitionCatalogueSettings>
  /**
   * Writes the settings only if they are still at `expectedRevision` (0: none yet),
   * then runs `alsoWrite` before committing; a throw from it rolls the settings back.
   */
  writeSettingsVersioned(
    exhibitionId: string,
    input: SettingsWrite,
    expectedRevision: number,
    actorId: string,
    alsoWrite?: () => Promise<void>,
  ): Promise<VersionedSettingsResult>
  listAdminSummaries(): Promise<ExhibitionAdminSummary[]>
  listBooths(exhibitionId: string, options?: { includeInactive?: boolean }): Promise<Booth[]>
  getBooth(exhibitionId: string, boothId: string): Promise<Booth | undefined>
  createBooth(input: CreateBoothInput): Promise<CreateBoothResult>
  updateBooth(input: UpdateBoothInput): Promise<UpdateBoothResult>
  findPriceVersion(id: string): Promise<BoothPriceVersion | undefined>
}

interface SettingsRow {
  exhibition_id: string
  company_booth_limit: string
  guide_map_reference: string | null
  revision: number
  updated_at: Date
}

interface BoothRow {
  id: string
  exhibition_id: string
  identifier: string
  specification: string
  location: string | null
  status: BoothStatus
  active: boolean
  price_amount: string
  price_unit: PriceUnit
  price_version_id: string | null
  has_active_reservation: boolean
  created_at: Date
  updated_at: Date
}

interface PriceVersionRow {
  id: string
  booth_id: string
  exhibition_id: string
  identifier: string
  price_amount: string
  price_unit: PriceUnit
  created_by: string | null
  created_at: Date
}

const BOOTH_COLUMNS = `
  b.id, b.exhibition_id, b.identifier, b.specification, b.location, b.status,
  b.active, b.price_amount, b.price_unit, b.price_version_id, b.created_at, b.updated_at,
  EXISTS (SELECT 1 FROM dashboard.booth_reservations reservation
    WHERE reservation.booth_id = b.id AND reservation.active) AS has_active_reservation
`

const BOOTH_RETURNING = `
  id, exhibition_id, identifier, specification, location, status,
  active, price_amount, price_unit, price_version_id, created_at, updated_at,
  EXISTS (SELECT 1 FROM dashboard.booth_reservations reservation
    WHERE reservation.booth_id = exhibition_booths.id AND reservation.active) AS has_active_reservation
`

const SETTINGS_COLUMNS = `
  exhibition_id, company_booth_limit, guide_map_reference, revision, updated_at
`

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  )
}

function mapSettings(row: SettingsRow): ExhibitionCatalogueSettings {
  return {
    exhibitionId: row.exhibition_id,
    companyBoothLimit: Number(row.company_booth_limit),
    guideMapReference: row.guide_map_reference,
    revision: row.revision,
    updatedAt: row.updated_at.toISOString(),
  }
}

function mapBooth(row: BoothRow): Booth {
  return {
    id: row.id,
    exhibitionId: row.exhibition_id,
    identifier: row.identifier,
    specification: row.specification,
    location: row.location,
    status: row.status,
    active: row.active,
    available: row.active && row.status === 'available' && !row.has_active_reservation,
    priceAmount: Number(row.price_amount),
    priceUnit: row.price_unit,
    priceVersionId: row.price_version_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function mapPriceVersion(row: PriceVersionRow): BoothPriceVersion {
  return {
    id: row.id,
    boothId: row.booth_id,
    exhibitionId: row.exhibition_id,
    identifier: row.identifier,
    priceAmount: Number(row.price_amount),
    priceUnit: row.price_unit,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  }
}

async function insertPriceVersion(
  client: PoolClient,
  input: {
    boothId: string
    exhibitionId: string
    identifier: string
    priceAmount: number
    priceUnit: PriceUnit
    createdBy: string | null
  },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO dashboard.booth_price_versions
      (booth_id, exhibition_id, identifier, price_amount, price_unit, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      input.boothId,
      input.exhibitionId,
      input.identifier,
      input.priceAmount,
      input.priceUnit,
      input.createdBy,
    ],
  )
  const versionId = rows[0]?.id
  if (!versionId) throw new Error('INSERT booth price version returned no row')
  return versionId
}

async function selectBooth(
  client: PoolClient | Pool,
  exhibitionId: string,
  boothId: string,
): Promise<Booth | undefined> {
  const { rows } = await client.query<BoothRow>(
    `SELECT ${BOOTH_COLUMNS}
     FROM dashboard.exhibition_booths b
     WHERE b.exhibition_id = $1 AND b.id = $2`,
    [exhibitionId, boothId],
  )
  return rows[0] ? mapBooth(rows[0]) : undefined
}

export class PostgresBoothCatalogueRepository implements BoothCatalogueRepository {
  constructor(private readonly pool: Pool) {}

  async getSettings(exhibitionId: string): Promise<ExhibitionCatalogueSettings | undefined> {
    const { rows } = await this.pool.query<SettingsRow>(
      `SELECT ${SETTINGS_COLUMNS}
       FROM dashboard.exhibition_catalogue_settings
       WHERE exhibition_id = $1`,
      [exhibitionId],
    )
    return rows[0] ? mapSettings(rows[0]) : undefined
  }

  async upsertSettings(
    exhibitionId: string,
    input: SettingsWrite,
    actorId: string,
  ): Promise<ExhibitionCatalogueSettings> {
    const { rows } = await this.pool.query<SettingsRow>(
      `INSERT INTO dashboard.exhibition_catalogue_settings
        (exhibition_id, company_booth_limit, guide_map_reference, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (exhibition_id) DO UPDATE SET
         company_booth_limit = EXCLUDED.company_booth_limit,
         guide_map_reference = EXCLUDED.guide_map_reference,
         updated_by = EXCLUDED.updated_by,
         revision = exhibition_catalogue_settings.revision + 1,
         updated_at = now()
       RETURNING ${SETTINGS_COLUMNS}`,
      [exhibitionId, input.companyBoothLimit, input.guideMapReference, actorId],
    )
    const row = rows[0]
    if (!row) throw new Error('Upsert exhibition catalogue settings returned no row')
    return mapSettings(row)
  }

  async writeSettingsVersioned(
    exhibitionId: string,
    input: SettingsWrite,
    expectedRevision: number,
    actorId: string,
    alsoWrite?: () => Promise<void>,
  ): Promise<VersionedSettingsResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: current } = await client.query<SettingsRow>(
        `SELECT ${SETTINGS_COLUMNS} FROM dashboard.exhibition_catalogue_settings
         WHERE exhibition_id = $1 FOR UPDATE`,
        [exhibitionId],
      )
      const revision = current[0]?.revision ?? 0
      if (revision !== expectedRevision) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'stale', revision }
      }
      // A first write races another first write on the primary key; that loser is stale too.
      const { rows } = current[0]
        ? await client.query<SettingsRow>(
            `UPDATE dashboard.exhibition_catalogue_settings
             SET company_booth_limit = $2, guide_map_reference = $3, updated_by = $4,
                 revision = revision + 1, updated_at = now()
             WHERE exhibition_id = $1
             RETURNING ${SETTINGS_COLUMNS}`,
            [exhibitionId, input.companyBoothLimit, input.guideMapReference, actorId],
          )
        : await client.query<SettingsRow>(
            `INSERT INTO dashboard.exhibition_catalogue_settings
              (exhibition_id, company_booth_limit, guide_map_reference, updated_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (exhibition_id) DO NOTHING
             RETURNING ${SETTINGS_COLUMNS}`,
            [exhibitionId, input.companyBoothLimit, input.guideMapReference, actorId],
          )
      if (!rows[0]) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'stale', revision: (await this.getSettings(exhibitionId))?.revision ?? 0 }
      }
      await alsoWrite?.()
      await client.query('COMMIT')
      return { ok: true, settings: mapSettings(rows[0]) }
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

  async listAdminSummaries(): Promise<ExhibitionAdminSummary[]> {
    const { rows } = await this.pool.query<SettingsRow & { id: string; booth_count: string }>(
      `WITH counts AS (
         SELECT exhibition_id, count(*) AS booth_count
         FROM dashboard.exhibition_booths GROUP BY exhibition_id
       )
       SELECT coalesce(s.exhibition_id, c.exhibition_id) AS id, s.exhibition_id,
              s.company_booth_limit, s.guide_map_reference, s.revision, s.updated_at,
              coalesce(c.booth_count, 0) AS booth_count
       FROM dashboard.exhibition_catalogue_settings s
       FULL OUTER JOIN counts c ON c.exhibition_id = s.exhibition_id`,
    )
    return rows.map((row) => ({
      exhibitionId: row.id,
      settings: row.exhibition_id ? mapSettings(row) : null,
      boothCount: Number(row.booth_count),
    }))
  }

  async listBooths(
    exhibitionId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<Booth[]> {
    const activeClause = options.includeInactive ? '' : 'AND b.active = true'
    const { rows } = await this.pool.query<BoothRow>(
      `SELECT ${BOOTH_COLUMNS}
       FROM dashboard.exhibition_booths b
       WHERE b.exhibition_id = $1 ${activeClause}
       ORDER BY b.identifier`,
      [exhibitionId],
    )
    return rows.map(mapBooth)
  }

  async getBooth(exhibitionId: string, boothId: string): Promise<Booth | undefined> {
    return selectBooth(this.pool, exhibitionId, boothId)
  }

  async createBooth(input: CreateBoothInput): Promise<CreateBoothResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO dashboard.exhibition_booths
          (exhibition_id, identifier, specification, location, status, active, price_amount, price_unit, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          input.exhibitionId,
          input.identifier,
          input.specification,
          input.location,
          input.status,
          input.active,
          input.priceAmount,
          input.priceUnit,
          input.createdBy,
        ],
      )
      const boothId = rows[0]?.id
      if (!boothId) throw new Error('INSERT booth returned no row')

      const versionId = await insertPriceVersion(client, {
        boothId,
        exhibitionId: input.exhibitionId,
        identifier: input.identifier,
        priceAmount: input.priceAmount,
        priceUnit: input.priceUnit,
        createdBy: input.createdBy,
      })
      await client.query(
        `UPDATE dashboard.exhibition_booths
         SET price_version_id = $3
         WHERE exhibition_id = $1 AND id = $2`,
        [input.exhibitionId, boothId, versionId],
      )

      const { rows: boothRows } = await client.query<BoothRow>(
        `SELECT ${BOOTH_RETURNING}
         FROM dashboard.exhibition_booths
         WHERE exhibition_id = $1 AND id = $2`,
        [input.exhibitionId, boothId],
      )
      const created = boothRows[0]
      if (!created) throw new Error('Created booth could not be read back')
      await client.query('COMMIT')
      return { ok: true, booth: mapBooth(created) }
    } catch (error) {
      await client.query('ROLLBACK')
      if (isUniqueViolation(error)) return { ok: false, error: 'duplicate_identifier' }
      throw error
    } finally {
      client.release()
    }
  }

  async updateBooth(input: UpdateBoothInput): Promise<UpdateBoothResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<BoothRow>(
        `SELECT ${BOOTH_COLUMNS}
         FROM dashboard.exhibition_booths b
         WHERE b.exhibition_id = $1 AND b.id = $2
         FOR UPDATE`,
        [input.exhibitionId, input.boothId],
      )
      const existing = rows[0]
      if (!existing) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'booth_not_found' }
      }

      const next = {
        identifier: input.identifier ?? existing.identifier,
        specification: input.specification ?? existing.specification,
        location: input.location !== undefined ? input.location : existing.location,
        status: input.status ?? existing.status,
        active: input.active ?? existing.active,
        priceAmount: input.priceAmount ?? Number(existing.price_amount),
        priceUnit: input.priceUnit ?? existing.price_unit,
      }
      const priceChanged =
        next.priceAmount !== Number(existing.price_amount) ||
        next.priceUnit !== existing.price_unit

      let priceVersionId = existing.price_version_id
      if (priceChanged) {
        priceVersionId = await insertPriceVersion(client, {
          boothId: existing.id,
          exhibitionId: input.exhibitionId,
          identifier: next.identifier,
          priceAmount: next.priceAmount,
          priceUnit: next.priceUnit,
          createdBy: input.updatedBy,
        })
      }

      const { rows: updatedRows } = await client.query<BoothRow>(
        `UPDATE dashboard.exhibition_booths
         SET identifier = $3,
             specification = $4,
             location = $5,
             status = $6,
             active = $7,
             price_amount = $8,
             price_unit = $9,
             price_version_id = $10,
             updated_at = now()
         WHERE exhibition_id = $1 AND id = $2
         RETURNING ${BOOTH_RETURNING}`,
        [
          input.exhibitionId,
          input.boothId,
          next.identifier,
          next.specification,
          next.location,
          next.status,
          next.active,
          next.priceAmount,
          next.priceUnit,
          priceVersionId,
        ],
      )
      const updated = updatedRows[0]
      if (!updated) throw new Error('Updated booth could not be read back')
      await client.query('COMMIT')
      return { ok: true, booth: mapBooth(updated) }
    } catch (error) {
      await client.query('ROLLBACK')
      if (isUniqueViolation(error)) return { ok: false, error: 'duplicate_identifier' }
      throw error
    } finally {
      client.release()
    }
  }

  async findPriceVersion(id: string): Promise<BoothPriceVersion | undefined> {
    const { rows } = await this.pool.query<PriceVersionRow>(
      `SELECT id, booth_id, exhibition_id, identifier, price_amount, price_unit, created_by, created_at
       FROM dashboard.booth_price_versions
       WHERE id = $1`,
      [id],
    )
    return rows[0] ? mapPriceVersion(rows[0]) : undefined
  }
}

interface StoredBooth extends BoothWrite {
  id: string
  exhibitionId: string
  priceVersionId: string | null
  createdAt: string
  updatedAt: string
}

export class InMemoryBoothCatalogueRepository implements BoothCatalogueRepository {
  private readonly settings = new Map<string, ExhibitionCatalogueSettings>()
  private readonly booths = new Map<string, StoredBooth>()
  private readonly priceVersions = new Map<string, BoothPriceVersion>()
  private reservationChecker?: (boothId: string) => boolean

  setReservationChecker(fn: (boothId: string) => boolean): void {
    this.reservationChecker = fn
  }

  async getSettings(exhibitionId: string): Promise<ExhibitionCatalogueSettings | undefined> {
    return this.settings.get(exhibitionId)
  }

  async upsertSettings(
    exhibitionId: string,
    input: SettingsWrite,
    _actorId: string,
  ): Promise<ExhibitionCatalogueSettings> {
    const settings: ExhibitionCatalogueSettings = {
      exhibitionId,
      companyBoothLimit: input.companyBoothLimit,
      guideMapReference: input.guideMapReference,
      revision: (this.settings.get(exhibitionId)?.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    }
    this.settings.set(exhibitionId, settings)
    return settings
  }

  async writeSettingsVersioned(
    exhibitionId: string,
    input: SettingsWrite,
    expectedRevision: number,
    actorId: string,
    alsoWrite?: () => Promise<void>,
  ): Promise<VersionedSettingsResult> {
    const before = this.settings.get(exhibitionId)
    const revision = before?.revision ?? 0
    if (revision !== expectedRevision) return { ok: false, error: 'stale', revision }
    const settings = await this.upsertSettings(exhibitionId, input, actorId)
    try {
      await alsoWrite?.()
    } catch (error) {
      if (before) this.settings.set(exhibitionId, before)
      else this.settings.delete(exhibitionId)
      throw error
    }
    return { ok: true, settings }
  }

  async listAdminSummaries(): Promise<ExhibitionAdminSummary[]> {
    const ids = new Set([...this.settings.keys(), ...[...this.booths.values()].map((booth) => booth.exhibitionId)])
    return [...ids].map((exhibitionId) => ({
      exhibitionId,
      settings: this.settings.get(exhibitionId) ?? null,
      boothCount: [...this.booths.values()].filter((booth) => booth.exhibitionId === exhibitionId).length,
    }))
  }

  async listBooths(
    exhibitionId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<Booth[]> {
    return [...this.booths.values()]
      .filter((booth) => booth.exhibitionId === exhibitionId)
      .filter((booth) => options.includeInactive || booth.active)
      .sort((a, b) => a.identifier.localeCompare(b.identifier))
      .map((booth) => this.toBooth(booth))
  }

  async getBooth(exhibitionId: string, boothId: string): Promise<Booth | undefined> {
    const booth = this.booths.get(boothId)
    if (!booth || booth.exhibitionId !== exhibitionId) return undefined
    return this.toBooth(booth)
  }

  async createBooth(input: CreateBoothInput): Promise<CreateBoothResult> {
    if (this.identifierTaken(input.exhibitionId, input.identifier)) {
      return { ok: false, error: 'duplicate_identifier' }
    }
    const now = new Date().toISOString()
    const id = randomUUID()
    const version = this.storePriceVersion(id, input.exhibitionId, input.identifier, input.priceAmount, input.priceUnit, input.createdBy)
    const booth: StoredBooth = {
      id,
      exhibitionId: input.exhibitionId,
      identifier: input.identifier,
      specification: input.specification,
      location: input.location,
      status: input.status,
      active: input.active,
      priceAmount: input.priceAmount,
      priceUnit: input.priceUnit,
      priceVersionId: version.id,
      createdAt: now,
      updatedAt: now,
    }
    this.booths.set(id, booth)
    return { ok: true, booth: this.toBooth(booth) }
  }

  async updateBooth(input: UpdateBoothInput): Promise<UpdateBoothResult> {
    const existing = this.booths.get(input.boothId)
    if (!existing || existing.exhibitionId !== input.exhibitionId) {
      return { ok: false, error: 'booth_not_found' }
    }
    if (
      input.identifier !== undefined &&
      input.identifier.toLocaleLowerCase() !== existing.identifier.toLocaleLowerCase() &&
      this.identifierTaken(input.exhibitionId, input.identifier, existing.id)
    ) {
      return { ok: false, error: 'duplicate_identifier' }
    }

    const next: StoredBooth = {
      ...existing,
      ...(input.identifier !== undefined ? { identifier: input.identifier } : {}),
      ...(input.specification !== undefined ? { specification: input.specification } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.priceAmount !== undefined ? { priceAmount: input.priceAmount } : {}),
      ...(input.priceUnit !== undefined ? { priceUnit: input.priceUnit } : {}),
    }

    if (next.priceAmount !== existing.priceAmount || next.priceUnit !== existing.priceUnit) {
      const version = this.storePriceVersion(
        existing.id,
        existing.exhibitionId,
        next.identifier,
        next.priceAmount,
        next.priceUnit,
        input.updatedBy,
      )
      next.priceVersionId = version.id
    }
    next.updatedAt = new Date().toISOString()
    this.booths.set(existing.id, next)
    return { ok: true, booth: this.toBooth(next) }
  }

  async findPriceVersion(id: string): Promise<BoothPriceVersion | undefined> {
    return this.priceVersions.get(id)
  }

  private identifierTaken(
    exhibitionId: string,
    identifier: string,
    exceptBoothId?: string,
  ): boolean {
    const needle = identifier.toLocaleLowerCase()
    return [...this.booths.values()].some(
      (booth) =>
        booth.exhibitionId === exhibitionId &&
        booth.id !== exceptBoothId &&
        booth.identifier.toLocaleLowerCase() === needle,
    )
  }

  private storePriceVersion(
    boothId: string,
    exhibitionId: string,
    identifier: string,
    priceAmount: number,
    priceUnit: PriceUnit,
    createdBy: string | null,
  ): BoothPriceVersion {
    const version: BoothPriceVersion = {
      id: randomUUID(),
      boothId,
      exhibitionId,
      identifier,
      priceAmount,
      priceUnit,
      createdBy,
      createdAt: new Date().toISOString(),
    }
    this.priceVersions.set(version.id, version)
    return version
  }

  private toBooth(booth: StoredBooth): Booth {
    const isReserved = this.reservationChecker?.(booth.id) ?? false
    return {
      ...booth,
      available: booth.active && booth.status === 'available' && !isReserved,
    }
  }
}
