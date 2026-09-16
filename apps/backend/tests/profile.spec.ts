import { describe, expect, it } from 'vitest'
import request from 'supertest'

import { createTestApp } from './helpers.js'

describe('Dashboard Profile Endpoints', () => {
  async function createProfileTestApp() {
    const testApp = await createTestApp()
    const user = await testApp.userStore.findOrCreateByPhone('۰۹۱۲۳۴۵۶۷۸۹')
    return {
      ...testApp,
      headers: {
        'x-internal-proxy-secret': 'test-proxy-secret',
        'x-user-id': user.id,
      },
    }
  }

  it('GET /profile returns default profile structure with company and addresses', async () => {
    const { app, headers } = await createProfileTestApp()
    const res = await request(app).get('/profile').set(headers)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('company')
    expect(res.body.company.name).toBe('')
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
})
