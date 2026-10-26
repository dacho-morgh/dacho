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

  describe('company dossier', () => {
    const requiredValues = {
      legalEntityType: 'سهامی خاص',
      knowledgeBasedStatus: 'دانش‌بنیان نوع یک',
      classification: 'فناوری اطلاعات',
      foundingYear: '1398',
      activityDomain: 'نرم‌افزار',
      productsServices: ['سامانه ابری'],
      keyMembers: [{ name: 'نام عضو', role: 'فنی' }],
    }
    const optionalAbsent = [
      'centerEstablishment',
      'website',
      'insuredEmployeeCount',
      'pastProjectsCustomers',
      'requestedServices',
      'catalogues',
      'certificatesLicenses',
      'amendmentNotices',
    ] as const

    async function createDossierTestApp() {
      const testApp = await createProfileTestApp()
      const user = await testApp.userStore.findOrCreateByPhone('09120000001')
      const company = await testApp.companyStore.create({ name: 'شرکت دوسیه', representativeId: user.id })
      await testApp.companyStore.update(company.id, {
        registrationNumber: '12345',
        status: 'فعال',
        addresses: [{ title: 'دفتر', province: 'بوشهر', city: 'بوشهر', postalCode: '7514', address: 'نشانی' }],
      })
      testApp.dossierDocuments.add(company.id, 'articlesOfAssociation')
      testApp.dossierDocuments.add(company.id, 'establishmentNotices')
      return {
        ...testApp,
        company,
        headers: {
          'x-internal-proxy-secret': 'test-proxy-secret',
          'x-user-id': user.id,
          'x-user-roles': 'representative',
        },
      }
    }

    it('GET /profile/dossier reports required gaps and missing optional answers', async () => {
      const { app, headers } = await createDossierTestApp()

      const res = await request(app).get('/profile/dossier').set(headers)

      expect(res.status).toBe(200)
      expect(res.body.dossier).toMatchObject({ legalEntityType: '', productsServices: [], notAvailable: [] })
      expect(res.body.documents).toHaveLength(2)
      expect(res.body.missing.required).toEqual(
        expect.arrayContaining(['legalEntityType', 'foundingYear', 'knowledgeBasedStatus', 'productsServices', 'keyMembers']),
      )
      expect(res.body.missing.required).not.toContain('registrationNumber')
      expect(res.body.missing.optional).toContain('website')
      expect(res.body.missing.canRequestVerification).toBe(false)
    })

    it('persists dossier values, keeps legal entity type separate, and records permitted absence', async () => {
      const { app, headers } = await createDossierTestApp()

      const patch = await request(app)
        .patch('/profile/dossier')
        .set(headers)
        .send({ ...requiredValues, notAvailable: optionalAbsent })

      expect(patch.status, JSON.stringify(patch.body)).toBe(200)
      expect(patch.body.dossier).toMatchObject(requiredValues)
      expect(patch.body.dossier.legalEntityType).toBe('سهامی خاص')
      expect(patch.body.dossier.knowledgeBasedStatus).toBe('دانش‌بنیان نوع یک')
      expect(patch.body.dossier.notAvailable).toEqual([...optionalAbsent])
      expect(patch.body.missing.required).toEqual([])
      expect(patch.body.missing.optional).toEqual([])
      expect(patch.body.missing.canRequestVerification).toBe(true)

      const get = await request(app).get('/profile/dossier').set(headers)
      expect(get.body.dossier).toMatchObject({ ...requiredValues, notAvailable: [...optionalAbsent] })
    })

    it('clears a value when it is declared absent and restores it when a value returns', async () => {
      const { app, headers } = await createDossierTestApp()

      await request(app).patch('/profile/dossier').set(headers).send({ website: 'https://example.invalid' })
      let res = await request(app).patch('/profile/dossier').set(headers).send({ notAvailable: ['website'] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.dossier.website).toBe('')
      expect(res.body.dossier.notAvailable).toContain('website')

      res = await request(app).patch('/profile/dossier').set(headers).send({ website: 'https://example.invalid' })
      expect(res.body.dossier.website).toBe('https://example.invalid')
      expect(res.body.dossier.notAvailable).not.toContain('website')
    })

    it('rejects conflicting or invalid absence answers without changing the dossier', async () => {
      const { app, headers } = await createDossierTestApp()
      await request(app).patch('/profile/dossier').set(headers).send({ website: 'https://example.invalid' })

      const conflict = await request(app)
        .patch('/profile/dossier')
        .set(headers)
        .send({ website: 'https://example.invalid', notAvailable: ['website'] })
      expect(conflict.status).toBe(400)
      expect(conflict.body.error).toBe('conflicting_absence')

      const invalid = await request(app)
        .patch('/profile/dossier')
        .set(headers)
        .send({ notAvailable: ['notAField'] })
      expect(invalid.status).toBe(400)
      expect(invalid.body.error).toBe('invalid_absence_field')

      const get = await request(app).get('/profile/dossier').set(headers)
      expect(get.body.dossier.website).toBe('https://example.invalid')
      expect(get.body.dossier.notAvailable).not.toContain('website')
    })

    it('also accepts dossier fields through PATCH /profile', async () => {
      const { app, headers } = await createDossierTestApp()

      const res = await request(app)
        .patch('/profile')
        .set(headers)
        .send({ company: { name: 'شرکت به‌روز' }, legalEntityType: 'سهامی خاص' })

      expect(res.status).toBe(200)
      expect(res.body.company.name).toBe('شرکت به‌روز')
      expect(res.body.dossier.legalEntityType).toBe('سهامی خاص')
    })

    it('rejects an invalid combined PATCH before persisting company, contacts or executives', async () => {
      const { app, headers } = await createDossierTestApp()

      const res = await request(app)
        .patch('/profile')
        .set(headers)
        .send({
          company: { name: 'نباید ذخیره شود' },
          contacts: { email: 'should-not-save@example.invalid' },
          executives: [{ position: 'مدیرعامل', name: 'نباید ذخیره شود' }],
          website: 'https://example.invalid',
          notAvailable: ['website'],
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('conflicting_absence')

      const profile = await request(app).get('/profile').set(headers)
      expect(profile.body.company.name).toBe('شرکت دوسیه')
      expect(profile.body.contacts.email).toBe('')
      expect(profile.body.executives).toEqual([])
      expect(profile.body.dossier.website).toBe('')
    })

    it('rejects a founding year that is not a plausible four-digit year', async () => {
      const { app, headers } = await createDossierTestApp()

      for (const foundingYear of ['139', 'abcd', '9999']) {
        const res = await request(app).patch('/profile/dossier').set(headers).send({ foundingYear })
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('invalid_foundingYear')
      }
    })
  })
})
