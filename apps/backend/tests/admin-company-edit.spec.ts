import { describe, expect, it } from 'vitest'
import request from 'supertest'

import { createTestApp } from './helpers.js'
import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { COMPANY_EDIT_REVERIFICATION_REASON } from '../src/dashboard/company-edits.js'
import { InMemoryVerificationStore } from '../src/dashboard/verification-repo.js'

/** The Secretariat edits a company and its addresses from the company detail page. */
describe('admin company edits', () => {
  async function setup() {
    const userStore = new InMemoryUserStore()
    const rep = await userStore.findOrCreateByPhone('09121111111')
    const secretariat = await userStore.findOrCreateByPhone('09122222222')
    secretariat.operationalRole = 'central-secretariat'
    secretariat.roles = ['admin']
    const other = await userStore.findOrCreateByPhone('09123333333')

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
        executives: [],
        addresses: [
          { id: 'addr-1', title: 'دفتر مرکزی', province: 'تهران', city: 'تهران', postalCode: '1234567890', address: 'خیابان آزادی' },
        ],
      },
    ])
    const company = (await companyStore.findByRepresentative(rep.id))!
    const verificationStore = new InMemoryVerificationStore()
    const submitted = await verificationStore.submit({ companyId: company.id, representativeId: rep.id, snapshot: {} })
    if (!submitted.ok) throw new Error('submit failed in setup')
    await verificationStore.decide({ id: submitted.verification.id, action: 'approve', reviewerId: secretariat.id, reason: null })

    const testApp = await createTestApp({ userStore, companyStore, verificationStore })
    const as = (user: { id: string }) => ({ 'x-internal-proxy-secret': 'test-proxy-secret', 'x-user-id': user.id })
    return {
      app: testApp.app,
      admin: as(secretariat),
      representative: as(rep),
      rep,
      other,
      companyStore,
      current: () => verificationStore.findCurrentByCompanyId(company.id),
    }
  }

  it('edits the company fields and withdraws the approval', async () => {
    const { app, admin, rep, companyStore, current } = await setup()
    const response = await request(app)
      .patch(`/admin/companies/${rep.id}`)
      .set(admin)
      .send({ company: { name: '  شرکت نوین  ', economicCode: '422222222222' } })
      .expect(200)
    expect(response.body.company).toMatchObject({ name: 'شرکت نوین', economicCode: '422222222222' })
    expect((await companyStore.findByRepresentative(rep.id))?.name).toBe('شرکت نوین')
    expect(await current()).toMatchObject({ status: 'returned', reason: COMPANY_EDIT_REVERIFICATION_REASON })
  })

  it('keeps the approval when nothing really changed', async () => {
    const { app, admin, rep, current } = await setup()
    await request(app).patch(`/admin/companies/${rep.id}`).set(admin).send({ company: { name: 'شرکت فناور پیشرو' } }).expect(200)
    expect((await current())?.status).toBe('approved')
  })

  it('refuses a changed national id, an empty name, bad values and an empty body', async () => {
    const { app, admin, rep } = await setup()
    const patch = (body: unknown) => request(app).patch(`/admin/companies/${rep.id}`).set(admin).send(body as object)
    await patch({ company: { nationalId: '99999999999' } }).expect(403)
    await patch({ company: { name: '   ' } }).expect(400)
    await patch({ company: { type: 12 } }).expect(400)
    await patch({ company: { status: 'x'.repeat(201) } }).expect(400)
    await patch({ company: {} }).expect(400)
  })

  it('is closed to a representative and to ids that are not a company representative', async () => {
    const { app, representative, admin, other } = await setup()
    await request(app).patch('/admin/companies/1').set(representative).send({ company: { name: 'x' } }).expect(403)
    await request(app).patch(`/admin/companies/${other.id}`).set(admin).send({ company: { name: 'x' } }).expect(404)
    await request(app).patch('/admin/companies/does-not-exist').set(admin).send({ company: { name: 'x' } }).expect(404)
  })

  it('adds, changes and removes addresses, each withdrawing the approval', async () => {
    const added = await setup()
    const created = await request(added.app).post(`/admin/companies/${added.rep.id}/addresses`).set(added.admin)
      .send({ title: 'کارخانه', province: 'بوشهر', city: 'بوشهر', postalCode: '7514', address: 'شهرک صنعتی' }).expect(201)
    expect(created.body.address).toMatchObject({ title: 'کارخانه' })
    expect((await added.current())?.status).toBe('returned')

    const changed = await setup()
    await request(changed.app).put(`/admin/companies/${changed.rep.id}/addresses/addr-1`).set(changed.admin)
      .send({ address: 'خیابان انقلاب' }).expect(200)
    expect((await changed.current())?.status).toBe('returned')
    const after = await request(changed.app).get(`/admin/companies/${changed.rep.id}`).set(changed.admin).expect(200)
    expect(after.body.addresses[0]).toMatchObject({ id: 'addr-1', address: 'خیابان انقلاب' })

    const removed = await setup()
    await request(removed.app).delete(`/admin/companies/${removed.rep.id}/addresses/addr-1`).set(removed.admin).expect(200)
    expect((await removed.current())?.status).toBe('returned')
    expect((await request(removed.app).get(`/admin/companies/${removed.rep.id}`).set(removed.admin)).body.addresses).toHaveLength(0)
  })

  it('refuses invalid or unknown addresses without touching the approval', async () => {
    const { app, admin, rep, current } = await setup()
    await request(app).post(`/admin/companies/${rep.id}/addresses`).set(admin).send({ title: 'فقط عنوان' }).expect(400)
    await request(app).put(`/admin/companies/${rep.id}/addresses/addr-1`).set(admin).send({ address: '' }).expect(400)
    await request(app).put(`/admin/companies/${rep.id}/addresses/missing`).set(admin).send({ address: 'x' }).expect(404)
    await request(app).delete(`/admin/companies/${rep.id}/addresses/missing`).set(admin).expect(404)
    expect((await current())?.status).toBe('approved')
  })
})
