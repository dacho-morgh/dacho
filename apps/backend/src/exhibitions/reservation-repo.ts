import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { BoothCatalogueRepository } from './catalogue-repo.js'
import { lockApprovedVerification } from '../dashboard/verification-repo.js'

export type AttendanceStatus = 'pending' | 'approved' | 'rejected'
export type PaymentStatus = 'unpaid' | 'pending_verification' | 'returned' | 'confirmed' | 'cancelled'
export type ReceiptStatus = 'pending_verification' | 'returned' | 'confirmed'

/** T09 supplies authoritative verification; profile completeness is insufficient. */
export interface BoothCompanyEligibility {
  isVerified(companyId: string): Promise<boolean>
}

export interface BoothReceiptFileDto {
  id: string
  receiptId: string
  filename: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface BoothPaymentReceiptDto {
  id: string
  reservationId: string
  version: number
  trackingCode: string | null
  amountToman: number | null
  paidAt: string | null
  description: string | null
  status: ReceiptStatus
  submittedBy: string
  createdAt: string
  files: BoothReceiptFileDto[]
}

export interface SubmitReceiptFileInput {
  filename: string
  mimeType: string
  sizeBytes: number
  storageKey: string
  fileHash: string
}

export interface SubmitReceiptInput {
  reservationId: string
  companyId: string
  actorId: string
  trackingCode?: string | null
  amountToman?: number | null
  paidAt?: string | null
  description?: string | null
  files: SubmitReceiptFileInput[]
}

export type SubmitReceiptResult =
  | { ok: true; receipt: BoothPaymentReceiptDto; reservation: BoothReservationDto }
  | {
      ok: false
      error:
        | 'not_found'
        | 'forbidden'
        | 'attendance_not_approved'
        | 'attendance_rejected'
        | 'reservation_inactive'
        | 'no_files'
        | 'duplicate_receipt'
      reason?: 'tracking_code_already_used' | 'file_already_used'
      attendanceStatus?: AttendanceStatus
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
  paymentStatus: PaymentStatus
  latestReceipt?: BoothPaymentReceiptDto | null
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
  | { ok: false; error: 'catalogue_not_configured' | 'booth_unavailable' | 'company_limit_reached' | 'company_not_verified' }

export type CanSubmitReceiptResult =
  | { ok: true; reservation: BoothReservationDto }
  | {
      ok: false
      error: 'not_found' | 'forbidden' | 'attendance_not_approved' | 'attendance_rejected' | 'reservation_inactive'
      attendanceStatus?: AttendanceStatus
    }

export function computeReservationAllowedActions(
  reservation: { attendanceStatus: AttendanceStatus; active: boolean; paymentStatus?: PaymentStatus },
  role?: string,
): string[] {
  if (role === 'system-owner' || role === 'central-secretariat') {
    const actions = ['read']
    if (reservation.attendanceStatus === 'pending' && reservation.active) {
      actions.push('approve', 'reject')
    }
    if (reservation.paymentStatus === 'pending_verification' && reservation.active) {
      actions.push('verify_receipt', 'return_receipt')
    }
    return actions
  }
  if (role === 'representative') {
    if (reservation.attendanceStatus === 'approved' && reservation.active && reservation.paymentStatus !== 'confirmed') {
      return ['read', 'submit_receipt']
    }
    return ['read']
  }
  return ['read']
}

export interface ReserveInput {
  exhibitionId: string
  boothId: string
  companyId: string
  actorId: string
  requireVerification?: boolean
}

export interface BoothReservationRepository {
  reserve(input: ReserveInput): Promise<ReserveResult>
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
  submitReceipt(input: SubmitReceiptInput): Promise<SubmitReceiptResult>
  listReceipts(reservationId: string): Promise<BoothPaymentReceiptDto[]>
  getLatestReceipt(reservationId: string): Promise<BoothPaymentReceiptDto | null>
  findReceiptFile(fileId: string): Promise<(BoothReceiptFileDto & { storageKey: string; reservationId: string; companyId: string }) | null>
}

interface ReservationRow {
  id: string
  exhibition_id: string
  booth_id: string
  booth_identifier?: string
  company_id: string
  company_name?: string
  requested_by: string
  price_version_id: string
  price_amount?: number
  price_unit?: string
  active: boolean
  attendance_status: AttendanceStatus
  attendance_reason: string | null
  attendance_decided_by: string | null
  attendance_decided_at: Date | string | null
  payment_status?: PaymentStatus
  created_at: Date | string
}

function mapReservationRow(row: ReservationRow, role?: string): BoothReservationDto {
  const attendanceStatus = row.attendance_status ?? 'pending'
  const active = Boolean(row.active)
  const paymentStatus: PaymentStatus = (row.payment_status as PaymentStatus) ?? 'unpaid'
  return {
    id: row.id,
    boothId: row.booth_id,
    boothIdentifier: row.booth_identifier,
    exhibitionId: row.exhibition_id,
    companyId: row.company_id,
    companyName: row.company_name,
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
    paymentStatus,
    createdAt: new Date(row.created_at).toISOString(),
    allowedActions: computeReservationAllowedActions({ attendanceStatus, active, paymentStatus }, role),
  }
}

export class PostgresBoothReservationRepository implements BoothReservationRepository {
  constructor(private readonly pool: Pool) {}

  async reserve(input: ReserveInput): Promise<ReserveResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      if (input.requireVerification && !await lockApprovedVerification(client, input.companyId)) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'company_not_verified' }
      }
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
        `INSERT INTO dashboard.booth_reservations (exhibition_id, booth_id, company_id, requested_by, price_version_id, attendance_status, payment_status, active)
         VALUES ($1, $2, $3, $4, $5, 'pending', 'unpaid', true)
         RETURNING id, exhibition_id, booth_id, company_id, requested_by, price_version_id, active, attendance_status, attendance_reason, attendance_decided_by, attendance_decided_at, payment_status, created_at,
           (SELECT pv.price_amount FROM dashboard.booth_price_versions pv WHERE pv.id = price_version_id) AS price_amount,
           (SELECT pv.price_unit FROM dashboard.booth_price_versions pv WHERE pv.id = price_version_id) AS price_unit`,
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
         RETURNING *,
           (SELECT pv.price_amount FROM dashboard.booth_price_versions pv WHERE pv.id = price_version_id) AS price_amount,
           (SELECT pv.price_unit FROM dashboard.booth_price_versions pv WHERE pv.id = price_version_id) AS price_unit`,
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

  async submitReceipt(input: SubmitReceiptInput): Promise<SubmitReceiptResult> {
    if (!input.files || input.files.length === 0) {
      return { ok: false, error: 'no_files' }
    }
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const existing = await client.query<ReservationRow>(
        'SELECT * FROM dashboard.booth_reservations WHERE id = $1 FOR UPDATE',
        [input.reservationId],
      )
      const res = existing.rows[0]
      if (!res) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'not_found' }
      }
      if (res.company_id !== input.companyId) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'forbidden' }
      }
      if (res.attendance_status === 'pending') {
        await client.query('ROLLBACK')
        return { ok: false, error: 'attendance_not_approved', attendanceStatus: 'pending' }
      }
      if (res.attendance_status === 'rejected') {
        await client.query('ROLLBACK')
        return { ok: false, error: 'attendance_rejected', attendanceStatus: 'rejected' }
      }
      if (!res.active) {
        await client.query('ROLLBACK')
        return { ok: false, error: 'reservation_inactive', attendanceStatus: res.attendance_status }
      }

      // Check duplicate tracking code across other reservations
      const cleanTracking = input.trackingCode?.trim() || null
      if (cleanTracking) {
        const dupTracking = await client.query(
          'SELECT reservation_id FROM dashboard.booth_payment_receipts WHERE tracking_code = $1 AND reservation_id != $2 LIMIT 1',
          [cleanTracking, input.reservationId],
        )
        if (dupTracking.rowCount) {
          await client.query('ROLLBACK')
          return { ok: false, error: 'duplicate_receipt', reason: 'tracking_code_already_used' }
        }
      }

      // Check duplicate file hashes across other reservations
      for (const file of input.files) {
        const dupFile = await client.query(
          'SELECT reservation_id FROM dashboard.booth_receipt_files WHERE file_hash = $1 AND reservation_id != $2 LIMIT 1',
          [file.fileHash, input.reservationId],
        )
        if (dupFile.rowCount) {
          await client.query('ROLLBACK')
          return { ok: false, error: 'duplicate_receipt', reason: 'file_already_used' }
        }
      }

      // Next version
      const verRes = await client.query<{ next_version: string }>(
        'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM dashboard.booth_payment_receipts WHERE reservation_id = $1',
        [input.reservationId],
      )
      const version = Number(verRes.rows[0]?.next_version ?? 1)

      const receiptInsert = await client.query<{
        id: string
        reservation_id: string
        version: number
        tracking_code: string | null
        amount_toman: string | null
        paid_at: Date | string | null
        description: string | null
        status: ReceiptStatus
        submitted_by: string
        created_at: Date | string
      }>(
        `INSERT INTO dashboard.booth_payment_receipts (reservation_id, version, tracking_code, amount_toman, paid_at, description, status, submitted_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending_verification', $7)
         RETURNING id, reservation_id, version, tracking_code, amount_toman, paid_at, description, status, submitted_by, created_at`,
        [
          input.reservationId,
          version,
          cleanTracking,
          input.amountToman ?? null,
          input.paidAt ? new Date(input.paidAt) : null,
          input.description?.trim() || null,
          input.actorId,
        ],
      )
      const receiptRow = receiptInsert.rows[0]!

      const insertedFiles: BoothReceiptFileDto[] = []
      for (const file of input.files) {
        const fileInsert = await client.query<{
          id: string
          receipt_id: string
          filename: string
          mime_type: string
          size_bytes: number
          created_at: Date | string
        }>(
          `INSERT INTO dashboard.booth_receipt_files (receipt_id, reservation_id, storage_key, filename, mime_type, size_bytes, file_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, receipt_id, filename, mime_type, size_bytes, created_at`,
          [receiptRow.id, input.reservationId, file.storageKey, file.filename, file.mimeType, file.sizeBytes, file.fileHash],
        )
        const fRow = fileInsert.rows[0]!
        insertedFiles.push({
          id: fRow.id,
          receiptId: fRow.receipt_id,
          filename: fRow.filename,
          mimeType: fRow.mime_type,
          sizeBytes: fRow.size_bytes,
          createdAt: new Date(fRow.created_at).toISOString(),
        })
      }

      // Update reservation status to pending_verification
      const updatedRes = await client.query<ReservationRow>(
        `UPDATE dashboard.booth_reservations
         SET payment_status = 'pending_verification'
         WHERE id = $1
         RETURNING *,
           (SELECT pv.price_amount FROM dashboard.booth_price_versions pv WHERE pv.id = price_version_id) AS price_amount,
           (SELECT pv.price_unit FROM dashboard.booth_price_versions pv WHERE pv.id = price_version_id) AS price_unit`,
        [input.reservationId],
      )

      await client.query('COMMIT')

      const receiptDto: BoothPaymentReceiptDto = {
        id: receiptRow.id,
        reservationId: receiptRow.reservation_id,
        version: receiptRow.version,
        trackingCode: receiptRow.tracking_code,
        amountToman: receiptRow.amount_toman ? Number(receiptRow.amount_toman) : null,
        paidAt: receiptRow.paid_at ? new Date(receiptRow.paid_at).toISOString() : null,
        description: receiptRow.description,
        status: receiptRow.status,
        submittedBy: receiptRow.submitted_by,
        createdAt: new Date(receiptRow.created_at).toISOString(),
        files: insertedFiles,
      }

      return {
        ok: true,
        receipt: receiptDto,
        reservation: mapReservationRow(updatedRes.rows[0]!),
      }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }

  async listReceipts(reservationId: string): Promise<BoothPaymentReceiptDto[]> {
    const receiptsResult = await this.pool.query<{
      id: string
      reservation_id: string
      version: number
      tracking_code: string | null
      amount_toman: string | null
      paid_at: Date | string | null
      description: string | null
      status: ReceiptStatus
      submitted_by: string
      created_at: Date | string
    }>(
      `SELECT id, reservation_id, version, tracking_code, amount_toman, paid_at, description, status, submitted_by, created_at
       FROM dashboard.booth_payment_receipts
       WHERE reservation_id = $1
       ORDER BY version ASC`,
      [reservationId],
    )
    if (receiptsResult.rows.length === 0) return []

    const filesResult = await this.pool.query<{
      id: string
      receipt_id: string
      filename: string
      mime_type: string
      size_bytes: number
      created_at: Date | string
    }>(
      `SELECT id, receipt_id, filename, mime_type, size_bytes, created_at
       FROM dashboard.booth_receipt_files
       WHERE reservation_id = $1
       ORDER BY created_at ASC`,
      [reservationId],
    )

    const filesByReceipt = new Map<string, BoothReceiptFileDto[]>()
    for (const f of filesResult.rows) {
      const list = filesByReceipt.get(f.receipt_id) ?? []
      list.push({
        id: f.id,
        receiptId: f.receipt_id,
        filename: f.filename,
        mimeType: f.mime_type,
        sizeBytes: f.size_bytes,
        createdAt: new Date(f.created_at).toISOString(),
      })
      filesByReceipt.set(f.receipt_id, list)
    }

    return receiptsResult.rows.map((r) => ({
      id: r.id,
      reservationId: r.reservation_id,
      version: r.version,
      trackingCode: r.tracking_code,
      amountToman: r.amount_toman ? Number(r.amount_toman) : null,
      paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : null,
      description: r.description,
      status: r.status,
      submittedBy: r.submitted_by,
      createdAt: new Date(r.created_at).toISOString(),
      files: filesByReceipt.get(r.id) ?? [],
    }))
  }

  async getLatestReceipt(reservationId: string): Promise<BoothPaymentReceiptDto | null> {
    const list = await this.listReceipts(reservationId)
    return list[list.length - 1] ?? null
  }

  async findReceiptFile(fileId: string): Promise<(BoothReceiptFileDto & { storageKey: string; reservationId: string; companyId: string }) | null> {
    const { rows } = await this.pool.query<{
      id: string
      receipt_id: string
      filename: string
      mime_type: string
      size_bytes: number
      storage_key: string
      created_at: Date | string
      reservation_id: string
      company_id: string
    }>(
      `SELECT f.id, f.receipt_id, f.filename, f.mime_type, f.size_bytes, f.storage_key, f.created_at,
              r.id AS reservation_id, r.company_id
       FROM dashboard.booth_receipt_files f
       JOIN dashboard.booth_reservations r ON r.id = f.reservation_id
       WHERE f.id = $1`,
      [fileId],
    )
    const row = rows[0]
    if (!row) return null
    return {
      id: row.id,
      receiptId: row.receipt_id,
      filename: row.filename,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      storageKey: row.storage_key,
      reservationId: row.reservation_id,
      companyId: row.company_id,
      createdAt: new Date(row.created_at).toISOString(),
    }
  }
}

export class InMemoryBoothReservationRepository implements BoothReservationRepository {
  private readonly reservations = new Map<string, BoothReservationDto>()
  private readonly decisions = new Map<string, BoothAttendanceDecisionDto[]>()
  private readonly receipts = new Map<string, BoothPaymentReceiptDto[]>()
  private readonly receiptFiles = new Map<
    string,
    BoothReceiptFileDto & { storageKey: string; reservationId: string; companyId: string; fileHash: string }
  >()

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

  async reserve(input: ReserveInput): Promise<ReserveResult> {
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
      paymentStatus: 'unpaid',
      createdAt: now,
      allowedActions: computeReservationAllowedActions({ attendanceStatus: 'pending', active: true, paymentStatus: 'unpaid' }),
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
      allowedActions: computeReservationAllowedActions({ attendanceStatus: nextStatus, active: nextActive, paymentStatus: res.paymentStatus }),
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

  async submitReceipt(input: SubmitReceiptInput): Promise<SubmitReceiptResult> {
    const eligibility = await this.canSubmitReceipt(input.reservationId, input.companyId)
    if (!eligibility.ok) {
      return {
        ok: false,
        error: eligibility.error,
        attendanceStatus: eligibility.attendanceStatus,
      }
    }
    if (!input.files || input.files.length === 0) {
      return { ok: false, error: 'no_files' }
    }

    const cleanTracking = input.trackingCode?.trim() || null
    if (cleanTracking) {
      for (const [resId, list] of this.receipts.entries()) {
        if (resId !== input.reservationId) {
          if (list.some((r) => r.trackingCode && r.trackingCode.toLowerCase() === cleanTracking.toLowerCase())) {
            return { ok: false, error: 'duplicate_receipt', reason: 'tracking_code_already_used' }
          }
        }
      }
    }

    for (const file of input.files) {
      for (const stored of this.receiptFiles.values()) {
        if (stored.reservationId !== input.reservationId && stored.fileHash === file.fileHash) {
          return { ok: false, error: 'duplicate_receipt', reason: 'file_already_used' }
        }
      }
    }

    const existing = this.receipts.get(input.reservationId) ?? []
    const version = existing.length + 1
    const receiptId = randomUUID()
    const now = new Date().toISOString()

    const filesDto: BoothReceiptFileDto[] = []
    for (const f of input.files) {
      const fileId = randomUUID()
      const fileDto: BoothReceiptFileDto = {
        id: fileId,
        receiptId,
        filename: f.filename,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        createdAt: now,
      }
      filesDto.push(fileDto)
      this.receiptFiles.set(fileId, {
        ...fileDto,
        storageKey: f.storageKey,
        reservationId: input.reservationId,
        companyId: input.companyId,
        fileHash: f.fileHash,
      })
    }

    const receipt: BoothPaymentReceiptDto = {
      id: receiptId,
      reservationId: input.reservationId,
      version,
      trackingCode: cleanTracking,
      amountToman: input.amountToman ?? null,
      paidAt: input.paidAt ?? null,
      description: input.description?.trim() || null,
      status: 'pending_verification',
      submittedBy: input.actorId,
      createdAt: now,
      files: filesDto,
    }

    existing.push(receipt)
    this.receipts.set(input.reservationId, existing)

    const reservation = this.reservations.get(input.reservationId)!
    const updatedRes: BoothReservationDto = {
      ...reservation,
      paymentStatus: 'pending_verification',
      allowedActions: computeReservationAllowedActions({
        attendanceStatus: reservation.attendanceStatus,
        active: reservation.active,
        paymentStatus: 'pending_verification',
      }),
    }
    this.reservations.set(input.reservationId, updatedRes)

    return {
      ok: true,
      receipt,
      reservation: updatedRes,
    }
  }

  async listReceipts(reservationId: string): Promise<BoothPaymentReceiptDto[]> {
    return this.receipts.get(reservationId) ?? []
  }

  async getLatestReceipt(reservationId: string): Promise<BoothPaymentReceiptDto | null> {
    const list = this.receipts.get(reservationId) ?? []
    return list[list.length - 1] ?? null
  }

  async findReceiptFile(fileId: string): Promise<(BoothReceiptFileDto & { storageKey: string; reservationId: string; companyId: string }) | null> {
    const f = this.receiptFiles.get(fileId)
    if (!f) return null
    return f
  }
}
