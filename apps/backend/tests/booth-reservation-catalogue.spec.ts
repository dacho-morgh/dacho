import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { PostgresBoothCatalogueRepository } from '../src/exhibitions/catalogue-repo.js'

const row = {
  id: 'booth', exhibition_id: 'exhibition', identifier: 'A1', specification: 'test', location: null,
  status: 'available', active: true, price_amount: '100', price_unit: 'toman', price_version_id: 'price',
  created_at: new Date(), updated_at: new Date(), has_active_reservation: true,
}

describe('effective catalogue availability', () => {
  it('does not advertise a held booth in either detail or list while preserving its administrative status', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] })
    const catalogue = new PostgresBoothCatalogueRepository({ query } as unknown as Pool)
    expect(await catalogue.getBooth('exhibition', 'booth')).toMatchObject({ available: false, status: 'available', active: true })
    expect(await catalogue.listBooths('exhibition')).toMatchObject([{ available: false, status: 'available' }])
    // Both projections must obtain current reservation state from storage.
    for (const [sql] of query.mock.calls) expect(sql).toContain('dashboard.booth_reservations')
  })

  it('restores released inventory only when the owner also permits sale', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ ...row, has_active_reservation: false }] })
      .mockResolvedValueOnce({ rows: [{ ...row, has_active_reservation: false, status: 'unavailable' }] })
    const catalogue = new PostgresBoothCatalogueRepository({ query } as unknown as Pool)
    expect((await catalogue.getBooth('exhibition', 'booth'))?.available).toBe(true)
    expect((await catalogue.getBooth('exhibition', 'booth'))?.available).toBe(false)
  })
})
