import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'

import type { User } from '../src/auth/user-store.js'
import { InMemoryExhibitionStore } from '../src/exhibitions/exhibition-store.js'
import { createTestApp } from './helpers.js'

const EXHIBITION = 'exhibition-1'
const OTHER_EXHIBITION = 'exhibition-2'

const boothBody = (overrides: Record<string, unknown> = {}) => ({
  identifier: 'A-1',
  specification: '۳ متر × ۳ متر',
  location: 'سالن اصلی',
  status: 'available',
  active: true,
  priceAmount: 15_000_000,
  priceUnit: 'toman',
  ...overrides,
})

function headers(user: User) {
  return {
    'x-internal-proxy-secret': 'test-proxy-secret',
    'x-user-id': user.id,
    'x-user-roles': user.roles?.join(',') ?? '',
  }
}

async function setup() {
  const testApp = await createTestApp()
  const owner = await testApp.userStore.findOrCreateByPhone('09120000001')
  owner.operationalRole = 'system-owner'
  owner.roles = ['admin']
  const representative = await testApp.userStore.findOrCreateByPhone('09120000002')
  representative.operationalRole = 'representative'
  representative.roles = ['representative']
  const secretariat = await testApp.userStore.findOrCreateByPhone('09120000003')
  secretariat.operationalRole = 'central-secretariat'
  secretariat.roles = ['admin']

  return { ...testApp, owner, representative, secretariat }
}

describe('booth catalogue', () => {
  it.each([
    ['get', `/exhibitions/${EXHIBITION}/catalogue`, 'getSettings', undefined],
    ['get', `/exhibitions/${EXHIBITION}/catalogue`, 'listBooths', undefined],
    ['get', `/admin/exhibitions/${EXHIBITION}/catalogue`, 'getSettings', undefined],
    ['get', `/admin/exhibitions/${EXHIBITION}/catalogue`, 'listBooths', undefined],
    ['put', `/admin/exhibitions/${EXHIBITION}/settings`, 'upsertSettings', { companyBoothLimit: 2 }],
    ['post', `/admin/exhibitions/${EXHIBITION}/booths`, 'createBooth', boothBody()],
    ['patch', `/admin/exhibitions/${EXHIBITION}/booths/11111111-1111-4111-8111-111111111111`, 'updateBooth', { identifier: 'B-2' }],
  ] as const)('returns HTTP 500 when %s %s rejects in %s', async (method, path, operation, body) => {
    const { app, owner, boothCatalogue } = await setup()
    vi.spyOn(boothCatalogue, operation).mockRejectedValueOnce(new Error('connection terminated unexpectedly'))
    const response = await request(app)[method](path)
      .set(headers(owner))
      .send(body)
      .timeout({ response: 500, deadline: 1000 })
    expect(response.status).toBe(500)
  })

  it('lets the owner configure the limit, guide map and fixed toman prices', async () => {
    const { app, owner, representative } = await setup()

    const settings = await request(app)
      .put(`/admin/exhibitions/${EXHIBITION}/settings`)
      .set(headers(owner))
      .send({ companyBoothLimit: 2, guideMapReference: '/guides/exhibition-1.pdf' })
    expect(settings.status).toBe(200)
    expect(settings.body.settings).toMatchObject({
      exhibitionId: EXHIBITION,
      companyBoothLimit: 2,
      guideMapReference: '/guides/exhibition-1.pdf',
    })

    const first = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody())
    expect(first.status).toBe(201)
    expect(first.body.booth).toMatchObject({
      identifier: 'A-1',
      specification: '۳ متر × ۳ متر',
      location: 'سالن اصلی',
      status: 'available',
      active: true,
      available: true,
      priceAmount: 15_000_000,
      priceUnit: 'toman',
    })
    expect(first.body.booth.priceVersionId).toEqual(expect.any(String))

    const second = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody({ identifier: 'B-2', status: 'unavailable', priceAmount: 22_500_000 }))
    expect(second.status).toBe(201)

    const catalogue = await request(app)
      .get(`/exhibitions/${EXHIBITION}/catalogue`)
      .set(headers(representative))
    expect(catalogue.status).toBe(200)
    expect(catalogue.body.companyBoothLimit).toBe(2)
    expect(catalogue.body.guideMapReference).toBe('/guides/exhibition-1.pdf')
    expect(catalogue.body.booths).toHaveLength(2)
    expect(catalogue.body.booths[0]).toMatchObject({
      identifier: 'A-1',
      available: true,
      priceAmount: 15_000_000,
      priceUnit: 'toman',
    })
    expect(catalogue.body.booths[1]).toMatchObject({
      identifier: 'B-2',
      available: false,
      priceAmount: 22_500_000,
    })
  })

  it('creates a booth from the required fields only', async () => {
    const { app, owner } = await setup()

    const response = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send({
        identifier: 'ONLY-REQUIRED',
        specification: '۲ متر × ۲ متر',
        priceAmount: 7_500_000,
        priceUnit: 'toman',
      })

    expect(response.status).toBe(201)
    expect(response.body.booth).toMatchObject({
      identifier: 'ONLY-REQUIRED',
      specification: '۲ متر × ۲ متر',
      location: null,
      status: 'available',
      active: true,
      available: true,
      priceAmount: 7_500_000,
      priceUnit: 'toman',
    })
  })

  it('keeps catalogue writes owner-only while allowing company reads', async () => {
    const { app, owner, representative, secretariat } = await setup()

    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody())
      .expect(201)

    for (const user of [representative, secretariat]) {
      const create = await request(app)
        .post(`/admin/exhibitions/${EXHIBITION}/booths`)
        .set(headers(user))
        .send(boothBody({ identifier: 'NOPE' }))
      expect(create.status).toBe(403)

      const settings = await request(app)
        .put(`/admin/exhibitions/${EXHIBITION}/settings`)
        .set(headers(user))
        .send({ companyBoothLimit: 5 })
      expect(settings.status).toBe(403)

      const adminRead = await request(app)
        .get(`/admin/exhibitions/${EXHIBITION}/catalogue`)
        .set(headers(user))
      expect(adminRead.status).toBe(403)
    }

    const companyRead = await request(app)
      .get(`/exhibitions/${EXHIBITION}/catalogue`)
      .set(headers(secretariat))
    expect(companyRead.status).toBe(200)
  })

  it('rejects duplicate booth identifiers within one exhibition only', async () => {
    const { app, owner } = await setup()

    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody({ identifier: 'A-1' }))
      .expect(201)

    const duplicate = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody({ identifier: ' a-1 ' }))
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error).toBe('duplicate_identifier')

    await request(app)
      .post(`/admin/exhibitions/${OTHER_EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody({ identifier: 'A-1' }))
      .expect(201)

    const second = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody({ identifier: 'B-1' }))
      .expect(201)

    const rename = await request(app)
      .patch(`/admin/exhibitions/${EXHIBITION}/booths/${second.body.booth.id}`)
      .set(headers(owner))
      .send({ identifier: 'A-1' })
    expect(rename.status).toBe(409)
    expect(rename.body.error).toBe('duplicate_identifier')
  })

  it('rejects invalid prices, units and company limits', async () => {
    const { app, owner } = await setup()

    for (const priceAmount of [0, -1, 1.5, '1000', null]) {
      const response = await request(app)
        .post(`/admin/exhibitions/${EXHIBITION}/booths`)
        .set(headers(owner))
        .send(boothBody({ priceAmount }))
      expect(response.status).toBe(400)
      expect(response.body.error).toBe('invalid_price_amount')
    }

    for (const priceUnit of [undefined, 'rial', 'IRR', null]) {
      const response = await request(app)
        .post(`/admin/exhibitions/${EXHIBITION}/booths`)
        .set(headers(owner))
        .send(boothBody({ priceUnit }))
      expect(response.status).toBe(400)
      expect(response.body.error).toBe('invalid_price_unit')
    }

    for (const companyBoothLimit of [0, -2, 1.5, '2', null]) {
      const response = await request(app)
        .put(`/admin/exhibitions/${EXHIBITION}/settings`)
        .set(headers(owner))
        .send({ companyBoothLimit })
      expect(response.status).toBe(400)
      expect(response.body.error).toBe('invalid_company_booth_limit')
    }

    for (const location of [123, true, ['Hall']]) {
      const response = await request(app)
        .post(`/admin/exhibitions/${EXHIBITION}/booths`)
        .set(headers(owner))
        .send(boothBody({ location }))
      expect(response.status).toBe(400)
      expect(response.body.error).toBe('invalid_booth_location')
    }
  })

  it('edits the current price without rewriting an already captured version', async () => {
    const { app, owner, boothCatalogue } = await setup()

    const created = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody({ priceAmount: 10_000_000 }))
      .expect(201)
    const boothId = created.body.booth.id as string
    const capturedVersionId = created.body.booth.priceVersionId as string

    const edited = await request(app)
      .patch(`/admin/exhibitions/${EXHIBITION}/booths/${boothId}`)
      .set(headers(owner))
      .send({ priceAmount: 12_000_000, priceUnit: 'toman' })
    expect(edited.status).toBe(200)
    expect(edited.body.booth.priceAmount).toBe(12_000_000)
    expect(edited.body.booth.priceVersionId).not.toBe(capturedVersionId)

    const captured = await boothCatalogue.findPriceVersion(capturedVersionId)
    expect(captured).toMatchObject({
      boothId,
      priceAmount: 10_000_000,
      priceUnit: 'toman',
    })

    const current = await boothCatalogue.findPriceVersion(edited.body.booth.priceVersionId)
    expect(current).toMatchObject({ priceAmount: 12_000_000, priceUnit: 'toman' })

    const noPriceChange = await request(app)
      .patch(`/admin/exhibitions/${EXHIBITION}/booths/${boothId}`)
      .set(headers(owner))
      .send({ specification: '۴ متر × ۴ متر' })
    expect(noPriceChange.status).toBe(200)
    expect(noPriceChange.body.booth.priceVersionId).toBe(edited.body.booth.priceVersionId)
  })

  it('hides inactive booths from companies but keeps them in the owner view', async () => {
    const { app, owner, representative } = await setup()

    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody({ identifier: 'PUBLIC' }))
      .expect(201)
    await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody({ identifier: 'HIDDEN', active: false }))
      .expect(201)

    const companyView = await request(app)
      .get(`/exhibitions/${EXHIBITION}/catalogue`)
      .set(headers(representative))
    expect(companyView.body.booths.map((booth: { identifier: string }) => booth.identifier)).toEqual([
      'PUBLIC',
    ])

    const ownerView = await request(app)
      .get(`/admin/exhibitions/${EXHIBITION}/catalogue`)
      .set(headers(owner))
    expect(ownerView.body.booths).toHaveLength(2)
    const hidden = ownerView.body.booths.find(
      (booth: { identifier: string }) => booth.identifier === 'HIDDEN',
    )
    expect(hidden).toMatchObject({ active: false, available: false })
  })

  it('returns not found for an unknown booth and rejects an empty patch', async () => {
    const { app, owner } = await setup()

    const missing = await request(app)
      .patch(`/admin/exhibitions/${EXHIBITION}/booths/00000000-0000-0000-0000-000000000000`)
      .set(headers(owner))
      .send({ status: 'unavailable' })
    expect(missing.status).toBe(404)
    expect(missing.body.error).toBe('booth_not_found')

    const created = await request(app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody())
      .expect(201)
    const empty = await request(app)
      .patch(`/admin/exhibitions/${EXHIBITION}/booths/${created.body.booth.id}`)
      .set(headers(owner))
      .send({})
    expect(empty.status).toBe(400)
    expect(empty.body.error).toBe('invalid_booth_update')
  })

  it('rejects a malformed booth id before touching the repository', async () => {
    const { app, owner } = await setup()

    const response = await request(app)
      .patch(`/admin/exhibitions/${EXHIBITION}/booths/not-a-uuid`)
      .set(headers(owner))
      .send({ status: 'unavailable' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('invalid_booth_id')
  })

  it('validates the exhibition before creating settings or booths', async () => {
    const exhibitionStore = new InMemoryExhibitionStore()
    const testApp = await createTestApp({ exhibitionStore })
    const owner = await testApp.userStore.findOrCreateByPhone('09120000009')
    owner.operationalRole = 'system-owner'
    owner.roles = ['admin']

    const missingSettings = await request(testApp.app)
      .put(`/admin/exhibitions/${EXHIBITION}/settings`)
      .set(headers(owner))
      .send({ companyBoothLimit: 2 })
    expect(missingSettings.status).toBe(404)
    expect(missingSettings.body.error).toBe('exhibition_not_found')

    const missingBooth = await request(testApp.app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody())
    expect(missingBooth.status).toBe(404)
    expect(missingBooth.body.error).toBe('exhibition_not_found')

    exhibitionStore.add(EXHIBITION)

    const settings = await request(testApp.app)
      .put(`/admin/exhibitions/${EXHIBITION}/settings`)
      .set(headers(owner))
      .send({ companyBoothLimit: 2 })
    expect(settings.status).toBe(200)

    const booth = await request(testApp.app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody())
    expect(booth.status).toBe(201)
  })

  it('returns a controlled error when the exhibition lookup rejects', async () => {
    const testApp = await createTestApp({
      exhibitionStore: {
        async exists(): Promise<boolean> {
          throw new Error('cms unavailable')
        },
      },
    })
    const owner = await testApp.userStore.findOrCreateByPhone('09120000010')
    owner.operationalRole = 'system-owner'
    owner.roles = ['admin']

    const settings = await request(testApp.app)
      .put(`/admin/exhibitions/${EXHIBITION}/settings`)
      .set(headers(owner))
      .send({ companyBoothLimit: 2 })
    expect(settings.status).toBe(503)
    expect(settings.body.error).toBe('exhibition_lookup_failed')

    const booth = await request(testApp.app)
      .post(`/admin/exhibitions/${EXHIBITION}/booths`)
      .set(headers(owner))
      .send(boothBody())
    expect(booth.status).toBe(503)
    expect(booth.body.error).toBe('exhibition_lookup_failed')
  })
})
