import { describe, expect, it } from 'vitest'
import request from 'supertest'

import { createTestApp } from './helpers.js'
import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { COMPANY_EDIT_REVERIFICATION_REASON } from '../src/dashboard/company-edits.js'
import { InMemoryVerificationStore } from '../src/dashboard/verification-repo.js'

/** T59 (#221, slice S4 #242): every real dossier edit, not only identity fields, needs re-verification. */
describe('T59: any company dossier edit invalidates verification', () => {
  async function setup(initialStatus: 'approved' | 'pending' | 'returned' = 'approved') {
    const userStore = new InMemoryUserStore()
    const rep = await userStore.findOrCreateByPhone('09121111111')
    const secretariat = await userStore.findOrCreateByPhone('09122222222')
    secretariat.operationalRole = 'central-secretariat'
    secretariat.roles = ['admin']

    const companyStore = new InMemoryCompanyStore([
      {
        name: 'شرکت فناور پیشرو',
        nationalId: '10101010101',
        registrationNumber: '998877',
        economicCode: '411111111111',
        type: 'سهامی خاص',
        status: 'فعال',
        province: 'تهران',
        city: 'تهران',
        establishmentDate: '1398/01/01',
        representativeId: rep.id,
        legalEntityType: 'سهامی خاص',
        website: 'https://example.invalid',
        productsServices: ['سامانه ابری'],
        executives: [{ position: 'مدیرعامل', name: 'علی رضایی' }],
        addresses: [
          { id: 'addr-1', title: 'دفتر مرکزی', province: 'تهران', city: 'تهران', postalCode: '1234567890', address: 'خیابان آزادی' },
        ],
      },
    ])
    const company = (await companyStore.findByRepresentative(rep.id))!
    const verificationStore = new InMemoryVerificationStore()
    const submitted = await verificationStore.submit({ companyId: company.id, representativeId: rep.id, snapshot: {} })
    if (!submitted.ok) throw new Error('submit failed in setup')
    if (initialStatus !== 'pending') {
      await verificationStore.decide({
        id: submitted.verification.id,
        action: initialStatus === 'approved' ? 'approve' : 'return',
        reviewerId: secretariat.id,
        reason: initialStatus === 'returned' ? 'مدارک ناقص است' : null,
      })
    }
    const testApp = await createTestApp({ userStore, companyStore, verificationStore })
    const headers = { 'x-internal-proxy-secret': 'test-proxy-secret', 'x-user-id': rep.id }
    const current = () => verificationStore.findCurrentByCompanyId(company.id)
    return { app: testApp.app, headers, current, testApp, company }
  }

  it('returns an approved company to re-verification when a non-identity company field changes', async () => {
    const { app, headers, current } = await setup()
    await request(app).patch('/profile').set(headers).send({ company: { economicCode: '422222222222' } }).expect(200)
    expect(await current()).toMatchObject({ status: 'returned', reason: COMPANY_EDIT_REVERIFICATION_REASON })
  })

  it('also withdraws a pending submission, so the next approval reviews a new revision', async () => {
    const { app, headers, current } = await setup('pending')
    await request(app).patch('/profile/dossier').set(headers).send({ website: 'https://new.example.invalid' }).expect(200)
    expect((await current())?.status).toBe('returned')
  })

  it('invalidates on executive and dossier list edits through PATCH /profile', async () => {
    const executives = await setup()
    await request(executives.app).patch('/profile').set(executives.headers)
      .send({ executives: [{ role: 'مدیرعامل', name: 'مریم احمدی' }] }).expect(200)
    expect((await executives.current())?.status).toBe('returned')

    const products = await setup()
    await request(products.app).patch('/profile').set(products.headers)
      .send({ dossier: { productsServices: ['سامانه ابری', 'مشاوره'] } }).expect(200)
    expect((await products.current())?.status).toBe('returned')
  })

  it('invalidates when an address is added, changed or removed', async () => {
    const added = await setup()
    await request(added.app).post('/profile/addresses').set(added.headers)
      .send({ title: 'کارخانه', province: 'بوشهر', city: 'بوشهر', postalCode: '7514', address: 'شهرک صنعتی' }).expect(201)
    expect((await added.current())?.status).toBe('returned')

    const changed = await setup()
    await request(changed.app).put('/profile/addresses/addr-1').set(changed.headers)
      .send({ address: 'خیابان انقلاب' }).expect(200)
    expect((await changed.current())?.status).toBe('returned')

    const removed = await setup()
    await request(removed.app).delete('/profile/addresses/addr-1').set(removed.headers).expect(200)
    expect((await removed.current())?.status).toBe('returned')
  })

  it('keeps approval when a save carries no real change', async () => {
    const { app, headers, current } = await setup()
    await request(app).patch('/profile').set(headers).send({
      company: { economicCode: '411111111111', name: 'شرکت فناور پیشرو' },
      executives: [{ role: 'مدیرعامل', name: 'علی رضایی' }],
      dossier: { website: 'https://example.invalid', productsServices: ['سامانه ابری'] },
    }).expect(200)
    await request(app).patch('/profile/dossier').set(headers).send({ website: 'https://example.invalid' }).expect(200)
    await request(app).put('/profile/addresses/addr-1').set(headers).send({ address: 'خیابان آزادی' }).expect(200)
    expect((await current())?.status).toBe('approved')
  })

  it('does not treat the representative own contact details as a company edit', async () => {
    const { app, headers, current } = await setup()
    await request(app).patch('/profile').set(headers).send({ contacts: { email: 'rep@example.invalid' } }).expect(200)
    expect((await current())?.status).toBe('approved')
  })

  it('leaves an already returned verification and its reason untouched', async () => {
    const { app, headers, current } = await setup('returned')
    await request(app).patch('/profile').set(headers).send({ company: { economicCode: '433333333333' } }).expect(200)
    expect(await current()).toMatchObject({ status: 'returned', reason: 'مدارک ناقص است' })
  })

  it('reports the new state and the reason on GET /profile/verification after the edit', async () => {
    const { app, headers } = await setup()
    await request(app).patch('/profile/dossier').set(headers).send({ productsServices: ['تجهیزات'] }).expect(200)
    const res = await request(app).get('/profile/verification').set(headers).expect(200)
    expect(res.body).toMatchObject({ status: 'returned', reason: COMPANY_EDIT_REVERIFICATION_REASON })
  })
})
