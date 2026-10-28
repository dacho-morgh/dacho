import type { Pool } from 'pg'

export type ReserveResult =
  | { ok: true; reservation: { id: string; boothId: string; exhibitionId: string; companyId: string; priceVersionId: string; createdAt: string } }
  | { ok: false; error: 'catalogue_not_configured' | 'booth_unavailable' | 'company_limit_reached' }

/** The caller must authorize the company and verify its eligibility first. */
export class BoothReservationRepository {
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
      if (!settings.rows[0]) { await client.query('ROLLBACK'); return { ok: false, error: 'catalogue_not_configured' } }
      const booth = await client.query<{ price_version_id: string | null }>(
        `SELECT price_version_id FROM dashboard.exhibition_booths
         WHERE id = $1 AND exhibition_id = $2 AND active AND status = 'available' FOR UPDATE`,
        [input.boothId, input.exhibitionId],
      )
      if (!booth.rows[0]?.price_version_id) { await client.query('ROLLBACK'); return { ok: false, error: 'booth_unavailable' } }
      const occupied = await client.query('SELECT 1 FROM dashboard.booth_reservations WHERE booth_id = $1 AND active', [input.boothId])
      if (occupied.rowCount) { await client.query('ROLLBACK'); return { ok: false, error: 'booth_unavailable' } }
      const count = await client.query<{ count: string }>(
        'SELECT count(*) AS count FROM dashboard.booth_reservations WHERE exhibition_id = $1 AND company_id = $2 AND active',
        [input.exhibitionId, input.companyId],
      )
      if (BigInt(count.rows[0]!.count) >= BigInt(settings.rows[0].company_booth_limit)) {
        await client.query('ROLLBACK'); return { ok: false, error: 'company_limit_reached' }
      }
      const created = await client.query<{ id: string; created_at: Date }>(
        `INSERT INTO dashboard.booth_reservations (exhibition_id, booth_id, company_id, requested_by, price_version_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
        [input.exhibitionId, input.boothId, input.companyId, input.actorId, booth.rows[0].price_version_id],
      )
      await client.query('COMMIT')
      return { ok: true, reservation: { id: created.rows[0]!.id, boothId: input.boothId, exhibitionId: input.exhibitionId, companyId: input.companyId, priceVersionId: booth.rows[0].price_version_id, createdAt: created.rows[0]!.created_at.toISOString() } }
    } catch (error) {
      await client.query('ROLLBACK')
      if ((error as { code?: string; constraint?: string }).code === '23505' && (error as { constraint?: string }).constraint === 'booth_reservations_one_active_booth') {
        return { ok: false, error: 'booth_unavailable' }
      }
      throw error
    } finally { client.release() }
  }
}
