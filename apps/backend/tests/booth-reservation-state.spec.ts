import { describe, expect, it } from 'vitest'
import { InMemoryBoothCatalogueRepository } from '../src/exhibitions/catalogue-repo.js'
import { computeReservationAllowedActions, InMemoryBoothReservationRepository } from '../src/exhibitions/reservation-repo.js'

describe('booth reservation state', () => {
  it('uses the catalogue price version and preserves it after a price change', async () => {
    const catalogue = new InMemoryBoothCatalogueRepository()
    const reservations = new InMemoryBoothReservationRepository(catalogue)
    await catalogue.upsertSettings('exhibition', { companyBoothLimit: 2, guideMapReference: null }, 'owner')
    const created = await catalogue.createBooth({
      exhibitionId: 'exhibition', identifier: 'A', specification: 'test', location: null,
      active: true, status: 'available', priceAmount: 500, priceUnit: 'toman', createdBy: 'owner',
    })
    if (!created.ok) throw new Error('booth fixture failed')
    const result = await reservations.reserve({
      exhibitionId: 'exhibition', boothId: created.booth.id, companyId: 'company', actorId: 'representative',
    })
    if (!result.ok) throw new Error('reservation fixture failed')
    expect(result.reservation).toMatchObject({ priceVersionId: created.booth.priceVersionId, priceAmount: 500, priceUnit: 'toman' })
    expect(await catalogue.findPriceVersion(result.reservation.priceVersionId)).toMatchObject({ priceAmount: 500 })
    await catalogue.updateBooth({ exhibitionId: 'exhibition', boothId: created.booth.id, priceAmount: 900, updatedBy: 'owner' })
    expect(await reservations.findById(result.reservation.id)).toMatchObject({ priceAmount: 500, priceVersionId: created.booth.priceVersionId })
  })

  it('does not offer attendance decisions for inactive pending reservations', () => {
    expect(computeReservationAllowedActions({ attendanceStatus: 'pending', active: false }, 'central-secretariat')).toEqual(['read'])
  })
})
