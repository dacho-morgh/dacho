import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { BoothCatalogueRepository } from './catalogue-repo.js'

export type AttendanceStatus = 'pending' | 'approved' | 'rejected'

/** T09 supplies authoritative verification; profile completeness is insufficient. */
export interface BoothCompanyEligibility {
  isVerified(companyId: string): Promise<boolean>
}

export interface BoothReservationDto {
  id: string
  boothId: string
  boothIdentifier?: string
  exhibitionId: string
  companyId: string
  companyName?: string
  requestedBy: string
  priceVersionId: string
  priceAmount?: number
  priceUnit?: string
  active: boolean
  attendanceStatus: AttendanceStatus
  attendanceReason: string | null
  attendanceDecidedBy: string | null
  attendanceDecidedAt: string | null
  createdAt: string
  allowedActions: string[]
}

export interface BoothAttendanceDecisionDto {
  id: string
  reservationId: string
  action: 'approve' | 'reject'
  fromStatus: AttendanceStatus
  toStatus: AttendanceStatus
  reason: string | null
  decidedBy: string
  createdAt: string
}

export interface AttendanceDecisionInput {
  id: string
  action: 'approve' | 'reject'
  reason?: string | null
  actorId: string
}

export type AttendanceDecisionResult =
  | { ok: true; reservation: BoothReservationDto }
  | { ok: false; error: 'not_found' | 'invalid_state' | 'reason_required' }

export type ReserveResult =
  | { ok: true; reservation: BoothReservationDto }
  | { ok: false; error: 'catalogue_not_configured' | 'booth_unavailable' | 'company_limit_reached' }

export type CanSubmitReceiptResult =
  | { ok: true; reservation: BoothReservationDto }
  | {
      ok: false
      error: 'not_found' | 'forbidden' | 'attendance_not_approved' | 'attendance_rejected' | 'reservation_inactive'
      attendanceStatus?: AttendanceStatus
    }

export function computeReservationAllowedActions(
  reservation: { attendanceStatus: AttendanceStatus; active: boolean },
  role?: string,
): string[] {
  if (role === 'system-owner' || role === 'central-secretariat') {
    if (reservation.attendanceStatus === 'pending' && reservation.active) return ['read', 'approve', 'reject']
    return ['read']
  }
  if (role === 'representative') {
    if (reservation.attendanceStatus === 'approved' && reservation.active) return ['read', 'submit_receipt']
    return ['read']
  }
  return ['read']
}

export interface BoothReservationRepository {
  reserve(input: { exhibitionId: string; boothId: string; companyId: string; actorId: string }): Promise<ReserveResult>
  findById(id: string, role?: string): Promise<BoothReservationDto | null>
  listByExhibition(
    exhibitionId: string,
    options?: { status?: AttendanceStatus | 'all'; companyId?: string },
    role?: string,
  ): Promise<BoothReservationDto[]>
  listByCompany(companyId: string, exhibitionId?: string, role?: string): Promise<BoothReservationDto[]>
  decideAttendance(input: AttendanceDecisionInput): Promise<AttendanceDecisionResult>
  canSubmitReceipt(reservationId: string, companyId: string): Promise<CanSubmitReceiptResult>
  listDecisionsHistory(reservationId: string): Promise<BoothAttendanceDecisionDto[]>
}

interface ReservationRow {
  id: string
  exhibition_id: string
  booth_id: string
  booth_identifier?: string
  company_id: string
  requested_by: string
  price_version_id: string
  price_amount?: number
  price_unit?: string
  active: boolean
  attendance_status: AttendanceStatus
  attendance_reason: string | null
  attendance_decided_by: string | null
  attendance_decided_at: Date | string | null
  created_at: Date | string
}

function mapReservationRow(row: ReservationRow, role?: string): BoothReservationDto {
  const attendanceStatus = row.attendance_status ?? 'pending'
  const active = Boolean(row.active)
  return {
    id: row.id,
    boothId: row.booth_id,
    boothIdentifier: row.booth_identifier,
    exhibitionId: row.exhibition_id,
    companyId: row.company_id,
    requestedBy: row.requested_by,
    priceVersionId: row.price_version_id,
    priceAmount: row.price_amount ? Number(row.price_amount) : undefined,
    priceUnit: row.price_unit ?? undefined,
    active,
    attendanceStatus,
    attendanceReason: row.attendance_reason ?? null,
    attendanceDecidedBy: row.attendance_decided_by ?? null,
    attendanceDecidedAt: row.attendance_decided_at
      ? new Date(row.attendance_decided_at).toISOString()
      : null,
    createdAt: new Date(row.created_at).toISOString(),
    allowedActions: computeReservationAllowedActions({ attendanceStatus, active }, role),
  }
}

export class PostgresBoothReservationRepository implements BoothReservationRepository {
  constructor(private readonly pool: Pool) {}

  async reserve(input: { exhibitionId: string; boothId: string; companyId: string; actorId: string }): Promise<ReserveResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      // Serializes reservations and concurrent changes to the configured limit.
      const settings = await client.query<{ company_booth_limit: string }>(
        'SELECT company_booth_limit FROM dashboard.exhibition_catalogue_settings WHERE exhibition_id = $1 FOR UPDATE',
        [input.exhibitionId],
      )
      if (!settings.rows[0]) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'catalogue_not_configured' }
      }
      const booth = await client.query<{ price_version_id: string | null }>(
        `SELECT price_version_id FROM dashboard.exhibition_booths
         WHERE id = $1 AND exhibition_id = $2 AND active AND status = 'available' FOR UPDATE`,
        [input.boothId, input.exhibitionId],
      )
      if (!booth.rows[0]?.price_version_id) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'booth_unavailable' }
      }
      const occupied = await client.query(
        'SELECT 1 FROM dashboard.booth_reservations WHERE booth_id = $1 AND active',
        [input.boothId],
      )
      if (occupied.rowCount) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'booth_unavailable' }
      }
      const count = await client.query<{ count: string }>(
        'SELECT count(*) AS count FROM dashboard.booth_reservations WHERE exhibition_id = $1 AND company_id = $2 AND active',
        [input.exhibitionId, input.companyId],
      )
      if (BigInt(count.rows[0]!.count) >= BigInt(settings.rows[0].company_booth_limit)) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'company_limit_reached' }
      }
      const created = await client.query<ReservationRow>(
        `INSERT INTO dashboard.booth_reservations (exhibition_id, booth_id, company_id, requested_by, price_version_id, attendance_status, active)
         VALUES ($1, $2, $3, $4, $5, 'pending', true)
         RETURNING id, exhibition_id, booth_id, company_id, requested_by, price_version_id, active, attendance_status, attendance_reason, attendance_decided_by, attendance_decided_at, created_at`,
        [input.exhibitionId, input.boothId, input.companyId, input.actorId, booth.rows[0].price_version_id],
      )
      await client.query('COMMIT')
      return { ok: true, reservation: mapReservationRow(created.rows[0]!) }
    } catch (error) {
      await client.query('ROLLBACK')
      if (
        (error as { code?: string; constraint?: string }).code === '23505' &&
        (error as { constraint?: string }).constraint === 'booth_reservations_one_active_booth'
      ) {
        return { ok: false, error: 'booth_unavailable' }
      }
      throw error
    } finally {
      client.release()
    }
  }

  async findById(id: string, role?: string): Promise<BoothReservationDto | null> {
    const { rows } = await this.pool.query<ReservationRow>(
      `SELECT r.*, b.identifier AS booth_identifier, pv.price_amount, pv.price_unit
       FROM dashboard.booth_reservations r
       JOIN dashboard.exhibition_booths b ON b.id = r.booth_id
       JOIN dashboard.booth_price_versions pv ON pv.id = r.price_version_id
       WHERE r.id = $1`,
      [id],
    )
    if (!rows[0]) return null
    return mapReservationRow(rows[0], role)
  }

  async listByExhibition(
    exhibitionId: string,
    options: { status?: AttendanceStatus | 'all'; companyId?: string } = {},
    role?: string,
  ): Promise<BoothReservationDto[]> {
    const conditions: string[] = ['r.exhibition_id = $1']
    const params: unknown[] = [exhibitionId]

    if (options.status && options.status !== 'all') {
      params.push(options.status)
      conditions.push(`r.attendance_status = $${params.length}`)
    }
    if (options.companyId) {
      params.push(options.companyId)
      conditions.push(`r.company_id = $${params.length}`)
    }

    const { rows } = await this.pool.query<ReservationRow>(
      `SELECT r.*, b.identifier AS booth_identifier, pv.price_amount, pv.price_unit
       FROM dashboard.booth_reservations r
       JOIN dashboard.exhibition_booths b ON b.id = r.booth_id
       JOIN dashboard.booth_price_versions pv ON pv.id = r.price_version_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.created_at DESC`,
      params,
    )
    return rows.map((r) => mapReservationRow(r, role))
  }

  async listByCompany(companyId: string, exhibitionId?: string, role?: string): Promise<BoothReservationDto[]> {
    const conditions: string[] = ['r.company_id = $1']
    const params: unknown[] = [companyId]
    if (exhibitionId) {
      params.push(exhibitionId)
      conditions.push(`r.exhibition_id = $${params.length}`)
    }
    const { rows } = await this.pool.query<ReservationRow>(
      `SELECT r.*, b.identifier AS booth_identifier, pv.price_amount, pv.price_unit
       FROM dashboard.booth_reservations r
       JOIN dashboard.exhibition_booths b ON b.id = r.booth_id
       JOIN dashboard.booth_price_versions pv ON pv.id = r.price_version_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.created_at DESC`,
      params,
    )
    return rows.map((r) => mapReservationRow(r, role))
  }

  async decideAttendance(input: AttendanceDecisionInput): Promise<AttendanceDecisionResult> {
    if (input.action === 'reject' && (!input.reason || !input.reason.trim())) {
      return { ok: false, error: 'reason_required' }
    }
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query<ReservationRow>(
        'SELECT * FROM dashboard.booth_reservations WHERE id = $1 FOR UPDATE',
        [input.id],
      )
      const reservation = existing.rows[0]
      if (!reservation) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'not_found' }
      }
      if (reservation.attendance_status !== 'pending' || !reservation.active) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'invalid_state' }
      }

      const cleanReason = input.reason?.trim() ?? null
      const nextStatus: AttendanceStatus = input.action === 'approve' ? 'approved' : 'rejected'
      const nextActive = input.action === 'approve' ? true : false

      const updated = await client.query<ReservationRow>(
        `UPDATE dashboard.booth_reservations
         SET attendance_status = $1,
             attendance_reason = $2,
             attendance_decided_by = $3,
             attendance_decided_at = now(),
             active = $4
         WHERE id = $5
         RETURNING *`,
        [nextStatus, cleanReason, input.actorId, nextActive, input.id],
      )

      await client.query(
        `INSERT INTO dashboard.booth_attendance_decisions (reservation_id, action, from_status, to_status, reason, decided_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [input.id, input.action, 'pending', nextStatus, cleanReason, input.actorId],
      )

      await client.query('COMMIT')
      return { ok: true, reservation: mapReservationRow(updated.rows[0]!) }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  async canSubmitReceipt(reservationId: string, companyId: string): Promise<CanSubmitReceiptResult> {
    const reservation = await this.findById(reservationId)
    if (!reservation) return { ok: false, error: 'not_found' }
    if (reservation.companyId !== companyId) return { ok: false, error: 'forbidden' }
    if (reservation.attendanceStatus === 'pending') {
      return { ok: false, error: 'attendance_not_approved', attendanceStatus: 'pending' }
    }
    if (reservation.attendanceStatus === 'rejected') {
      return { ok: false, error: 'attendance_rejected', attendanceStatus: 'rejected' }
    }
    if (!reservation.active) {
      return { ok: false, error: 'reservation_inactive', attendanceStatus: reservation.attendanceStatus }
    }
    return { ok: true, reservation }
  }

  async listDecisionsHistory(reservationId: string): Promise<BoothAttendanceDecisionDto[]> {
    const { rows } = await this.pool.query<{
      id: string
      reservation_id: string
      action: 'approve' | 'reject'
      from_status: AttendanceStatus
      to_status: AttendanceStatus
      reason: string | null
      decided_by: string
      created_at: Date | string
    }>(
      `SELECT id, reservation_id, action, from_status, to_status, reason, decided_by, created_at
       FROM dashboard.booth_attendance_decisions
       WHERE reservation_id = $1
       ORDER BY created_at ASC`,
      [reservationId],
    )
    return rows.map((r) => ({
      id: r.id,
      reservationId: r.reservation_id,
      action: r.action,
      fromStatus: r.from_status,
      toStatus: r.to_status,
      reason: r.reason,
      decidedBy: r.decided_by,
      createdAt: new Date(r.created_at).toISOString(),
    }))
  }
}

export class InMemoryBoothReservationRepository implements BoothReservationRepository {
  private readonly reservations = new Map<string, BoothReservationDto>()
  private readonly decisions = new Map<string, BoothAttendanceDecisionDto[]>()

  constructor(private readonly catalogue?: BoothCatalogueRepository) {
    if (catalogue && 'setReservationChecker' in catalogue && typeof (catalogue as { setReservationChecker: unknown }).setReservationChecker === 'function') {
      (catalogue as { setReservationChecker: (fn: (boothId: string) => boolean) => void }).setReservationChecker(
        (boothId: string) => this.hasActiveReservation(boothId),
      )
    }
  }

  hasActiveReservation(boothId: string): boolean {
    for (const res of this.reservations.values()) {
      if (res.boothId === boothId && res.active) return true
    }
    return false
  }

  async reserve(input: { exhibitionId: string; boothId: string; companyId: string; actorId: string }): Promise<ReserveResult> {
    let selectedBooth: Awaited<ReturnType<BoothCatalogueRepository['getBooth']>>
    if (this.catalogue) {
      const settings = await this.catalogue.getSettings(input.exhibitionId)
      if (!settings) return { ok: false, error: 'catalogue_not_configured' }

      const booth = await this.catalogue.getBooth(input.exhibitionId, input.boothId)
      if (!booth || !booth.priceVersionId || !booth.active || booth.status !== 'available' || this.hasActiveReservation(input.boothId)) {
        return { ok: false, error: 'booth_unavailable' }
      }

      let companyCount = 0
      for (const res of this.reservations.values()) {
        if (res.exhibitionId === input.exhibitionId && res.companyId === input.companyId && res.active) {
          companyCount++
        }
      }
      if (companyCount >= settings.companyBoothLimit) {
        return { ok: false, error: 'company_limit_reached' }
      }
      selectedBooth = booth
    } else if (this.hasActiveReservation(input.boothId)) {
      return { ok: false, error: 'booth_unavailable' }
    }

    const id = randomUUID()
    const now = new Date().toISOString()
    const reservation: BoothReservationDto = {
      id,
      boothId: input.boothId,
      exhibitionId: input.exhibitionId,
      companyId: input.companyId,
      requestedBy: input.actorId,
      priceVersionId: selectedBooth?.priceVersionId ?? randomUUID(),
      boothIdentifier: selectedBooth?.identifier,
      priceAmount: selectedBooth?.priceAmount,
      priceUnit: selectedBooth?.priceUnit,
      active: true,
      attendanceStatus: 'pending',
      attendanceReason: null,
      attendanceDecidedBy: null,
      attendanceDecidedAt: null,
      createdAt: now,
      allowedActions: computeReservationAllowedActions({ attendanceStatus: 'pending', active: true }),
    }
    this.reservations.set(id, reservation)
    return { ok: true, reservation }
  }

  async findById(id: string, role?: string): Promise<BoothReservationDto | null> {
    const res = this.reservations.get(id)
    if (!res) return null
    return {
      ...res,
      allowedActions: computeReservationAllowedActions(res, role),
    }
  }

  async listByExhibition(
    exhibitionId: string,
    options: { status?: AttendanceStatus | 'all'; companyId?: string } = {},
    role?: string,
  ): Promise<BoothReservationDto[]> {
    return [...this.reservations.values()]
      .filter((r) => r.exhibitionId === exhibitionId)
      .filter((r) => !options.status || options.status === 'all' || r.attendanceStatus === options.status)
      .filter((r) => !options.companyId || r.companyId === options.companyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({
        ...r,
        allowedActions: computeReservationAllowedActions(r, role),
      }))
  }

  async listByCompany(companyId: string, exhibitionId?: string, role?: string): Promise<BoothReservationDto[]> {
    return [...this.reservations.values()]
      .filter((r) => r.companyId === companyId)
      .filter((r) => !exhibitionId || r.exhibitionId === exhibitionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({
        ...r,
        allowedActions: computeReservationAllowedActions(r, role),
      }))
  }

  async decideAttendance(input: AttendanceDecisionInput): Promise<AttendanceDecisionResult> {
    if (input.action === 'reject' && (!input.reason || !input.reason.trim())) {
      return { ok: false, error: 'reason_required' }
    }
    const res = this.reservations.get(input.id)
    if (!res) return { ok: false, error: 'not_found' }
    if (res.attendanceStatus !== 'pending' || !res.active) return { ok: false, error: 'invalid_state' }

    const cleanReason = input.reason?.trim() ?? null
    const nextStatus: AttendanceStatus = input.action === 'approve' ? 'approved' : 'rejected'
    const nextActive = input.action === 'approve' ? true : false
    const now = new Date().toISOString()

    const updated: BoothReservationDto = {
      ...res,
      attendanceStatus: nextStatus,
      attendanceReason: cleanReason,
      attendanceDecidedBy: input.actorId,
      attendanceDecidedAt: now,
      active: nextActive,
      allowedActions: computeReservationAllowedActions({ attendanceStatus: nextStatus, active: nextActive }),
    }
    this.reservations.set(input.id, updated)

    const history = this.decisions.get(input.id) ?? []
    history.push({
      id: randomUUID(),
      reservationId: input.id,
      action: input.action,
      fromStatus: 'pending',
      toStatus: nextStatus,
      reason: cleanReason,
      decidedBy: input.actorId,
      createdAt: now,
    })
    this.decisions.set(input.id, history)

    return { ok: true, reservation: updated }
  }

  async canSubmitReceipt(reservationId: string, companyId: string): Promise<CanSubmitReceiptResult> {
    const res = this.reservations.get(reservationId)
    if (!res) return { ok: false, error: 'not_found' }
    if (res.companyId !== companyId) return { ok: false, error: 'forbidden' }
    if (res.attendanceStatus === 'pending') {
      return { ok: false, error: 'attendance_not_approved', attendanceStatus: 'pending' }
    }
    if (res.attendanceStatus === 'rejected') {
      return { ok: false, error: 'attendance_rejected', attendanceStatus: 'rejected' }
    }
    if (!res.active) {
      return { ok: false, error: 'reservation_inactive', attendanceStatus: res.attendanceStatus }
    }
    return { ok: true, reservation: res }
  }

  async listDecisionsHistory(reservationId: string): Promise<BoothAttendanceDecisionDto[]> {
    return this.decisions.get(reservationId) ?? []
  }
}
