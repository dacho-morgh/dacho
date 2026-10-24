import { describe, expect, it } from 'vitest'
import request from 'supertest'

import { createTestApp } from './helpers.js'

describe('Dashboard Profile Endpoints', () => {
  async function createProfileTestApp() {
    const testApp = await createTestApp()
    const user = await testApp.userStore.findOrCreateByPhone('۰۹۱۲۳۴۵۶۷۸۹')
    // The profile's company half reads the company this user represents.
    await testApp.companyStore.create({ name: 'شرکت پایه', representativeId: user.id })
    return {
      ...testApp,
      headers: {
        'x-internal-proxy-secret': 'test-proxy-secret',
        'x-user-id': user.id,
        'x-user-roles': 'representative',
      },
    }
  }

  it('GET /profile returns default profile structure with company and addresses', async () => {
    const { app, headers } = await createProfileTestApp()
    const res = await request(app).get('/profile').set(headers)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('company')
    expect(res.body.company.name).toBe('شرکت پایه')
    expect(res.body.company.status).toBe('')
    expect(res.body).toHaveProperty('contacts')
    expect(res.body.contacts.phone).toBe('۰۹۱۲۳۴۵۶۷۸۹')
    expect(res.body).toHaveProperty('addresses')
    expect(Array.isArray(res.body.addresses)).toBe(true)
    expect(res.body.addresses).toEqual([])
  })

  it('PATCH /profile updates basic company info and contacts', async () => {
    const { app, headers } = await createProfileTestApp()

    const updateRes = await request(app)
      .patch('/profile')
      .set(headers)
      .send({
        company: { name: 'شرکت فناوران بوشهر' },
        contacts: { email: 'info@fannavaran.ir' },
      })

    expect(updateRes.status).toBe(200)
    expect(updateRes.body.company.name).toBe('شرکت فناوران بوشهر')
    expect(updateRes.body.contacts.email).toBe('info@fannavaran.ir')

    // Confirm persisted for this user
    const getRes = await request(app).get('/profile').set(headers)
    expect(getRes.body.company.name).toBe('شرکت فناوران بوشهر')
    expect(getRes.body.contacts.email).toBe('info@fannavaran.ir')
  })

  it('POST, PUT, DELETE /profile/addresses manages user addresses', async () => {
    const { app, headers } = await createProfileTestApp()

    // Add address
    const addRes = await request(app)
      .post('/profile/addresses')
      .set(headers)
      .send({
        title: 'دفتر فنی',
        province: 'بوشهر',
        city: 'بوشهر',
        postalCode: '7514112345',
        address: 'بلوار خلیج فارس، ساختمان مروارید',
      })

    expect(addRes.status).toBe(201)
    expect(addRes.body.address.title).toBe('دفتر فنی')
    const addressId = addRes.body.address.id

    // Update address
    const updateRes = await request(app)
      .put(`/profile/addresses/${addressId}`)
      .set(headers)
      .send({
        title: 'دفتر فنی و مهندسی',
      })

    expect(updateRes.status).toBe(200)
    expect(updateRes.body.address.title).toBe('دفتر فنی و مهندسی')

    // Delete address
    const deleteRes = await request(app)
      .delete(`/profile/addresses/${addressId}`)
      .set(headers)

    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body).toEqual({ success: true })

    // Verify it was removed
    const getRes = await request(app).get('/profile').set(headers)
    const exists = getRes.body.addresses.some((a: { id: string }) => a.id === addressId)
    expect(exists).toBe(false)
  })

  it('rejects identity changes before applying any profile/contact edits', async () => {
    const { app, headers } = await createProfileTestApp()
    const response = await request(app).patch('/profile').set(headers).send({
      company: { nationalId: 'new-identity', name: 'نام نامعتبر' },
      contacts: { email: 'changed@example.invalid' },
    })
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('protected_company_identity')
    const profile = await request(app).get('/profile').set(headers)
    expect(profile.body.company.name).toBe('شرکت پایه')
    expect(profile.body.contacts.email).toBe('')
  })

  it('ignores client-selected company and representative identifiers', async () => {
    const { app, headers, userStore, companyStore } = await createProfileTestApp()
    const otherUser = await userStore.findOrCreateByPhone('09910000099')
    const otherCompany = await companyStore.create({ name: 'شرکت دیگر', representativeId: otherUser.id })
    const response = await request(app).patch('/profile').set(headers).send({
      company: { id: otherCompany.id, representativeId: otherUser.id, representative: otherUser.id, name: 'شرکت خودم' },
    })
    expect(response.status).toBe(200)
    expect(response.body.company.name).toBe('شرکت خودم')
    expect((await companyStore.findById(otherCompany.id))?.name).toBe('شرکت دیگر')
    expect((await companyStore.findByRepresentative(headers['x-user-id']))?.representativeId).toBe(headers['x-user-id'])
  })

  it('rechecks current roles for profile and admin company reads', async () => {
    const { app, headers, userStore } = await createProfileTestApp()
    const spoofed = { ...headers, 'x-user-roles': 'admin' }
    expect((await request(app).get('/admin/companies').set(spoofed)).status).toBe(403)
    expect((await request(app).get('/admin/companies/1').set(spoofed)).status).toBe(403)

    const actor = await userStore.findById(headers['x-user-id'])
    actor!.operationalRole = 'reviewer'
    actor!.roles = ['referee']
    expect((await request(app).get('/profile').set(headers)).status).toBe(403)
    expect((await request(app).patch('/profile').set(headers).send({ executives: [] })).status).toBe(403)
    expect((await request(app).post('/profile/addresses').set(headers).send({ title: 'x', address: 'y' })).status).toBe(403)
  })

  it('returns an error instead of acknowledging a write for a missing company', async () => {
    const { app, userStore } = await createTestApp()
    const actor = await userStore.findOrCreateByPhone('09910000098')
    const response = await request(app).post('/profile/addresses').set({
      'x-internal-proxy-secret': 'test-proxy-secret', 'x-user-id': actor.id, 'x-user-roles': 'representative',
    }).send({ title: 'x', address: 'y' })
    expect(response.status).toBe(404)
    expect(response.body.error).toBe('company_not_found')
  })
})
