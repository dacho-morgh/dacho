import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import type { Pool } from 'pg'

import { createTestApp } from './helpers.js'
import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { InMemoryVerificationStore } from '../src/dashboard/verification-repo.js'
import { InMemoryBoothCatalogueRepository } from '../src/exhibitions/catalogue-repo.js'
import { InMemoryBoothReservationRepository } from '../src/exhibitions/reservation-repo.js'

describe('T15: Re-verification and participation eligibility', () => {
  async function setup(
    initialStatus: 'unsubmitted' | 'pending' | 'approved' | 'returned' | 'rejected' = 'approved',
    poolOverride?: Pool,
  ) {
    const userStore = new InMemoryUserStore()
    const rep = await userStore.findOrCreateByPhone('09121111111')
    rep.operationalRole = 'representative'
    rep.roles = ['representative']

    const secretariat = await userStore.findOrCreateByPhone('09122222222')
    secretariat.operationalRole = 'central-secretariat'
    secretariat.roles = ['admin']

    const companyStore = new InMemoryCompanyStore([
      {
        name: 'شرکت فناور پیشرو',
        nationalId: '10101010101',
        registrationNumber: '998877',
        type: 'سهامی خاص',
        status: 'فعال',
        province: 'تهران',
        city: 'تهران',
        establishmentDate: '1398/01/01',
        representativeId: rep.id,
        legalEntityType: 'سهامی خاص',
        knowledgeBasedStatus: 'دانش‌بنیان نوپا',
        classification: 'فناوری اطلاعات',
        foundingYear: '1398',
        activityDomain: 'هوش مصنوعی',
        productsServices: ['سامانه ابری'],
        addresses: [
          {
            id: 'addr-1',
            title: 'دفتر مرکزی',
            province: 'تهران',
            city: 'تهران',
            postalCode: '1234567890',
            address: 'خیابان آزادی، پلاک ۱',
          },
        ],
        notAvailable: [
          'centerEstablishment',
          'website',
          'insuredEmployeeCount',
          'pastProjectsCustomers',
          'requestedServices',
          'catalogues',
          'certificatesLicenses',
          'amendmentNotices',
        ],
      },
    ])
    const company = (await companyStore.findByRepresentative(rep.id))!

    const verificationStore = new InMemoryVerificationStore()
    if (initialStatus !== 'unsubmitted') {
      const submitRes = await verificationStore.submit({
        companyId: company.id,
        representativeId: rep.id,
        snapshot: { company: { name: 'شرکت فناور پیشرو' } },
      })
      if (!submitRes.ok) throw new Error('submit failed in test setup')

      if (initialStatus === 'approved') {
        await verificationStore.decide({
          id: submitRes.verification.id,
          action: 'approve',
          reviewerId: secretariat.id,
        })
      } else if (initialStatus === 'returned') {
        await verificationStore.decide({
          id: submitRes.verification.id,
          action: 'return',
          reviewerId: secretariat.id,
          reason: 'مدارک ناقص است',
        })
      } else if (initialStatus === 'rejected') {
        await verificationStore.decide({
          id: submitRes.verification.id,
          action: 'reject',
          reviewerId: secretariat.id,
          reason: 'عدم تطابق اساسنامه',
        })
      }
    }

    const catalogue = new InMemoryBoothCatalogueRepository()
    await catalogue.upsertSettings('ex-1', { companyBoothLimit: 1, guideMapReference: null }, 'owner')
    const boothRes = await catalogue.createBooth({
      exhibitionId: 'ex-1',
      identifier: 'B-01',
      specification: 'غرفه استاندارد',
      location: null,
      status: 'available',
      active: true,
      priceAmount: 1000,
      priceUnit: 'toman',
      createdBy: 'owner',
    })
    if (!boothRes.ok) throw new Error('createBooth failed in setup')

    const boothReservations = new InMemoryBoothReservationRepository(catalogue)

    const testApp = await createTestApp({
      userStore,
      companyStore,
      verificationStore,
      boothCatalogue: catalogue,
      boothReservations,
      pool: poolOverride,
    })

    const repHeaders = {
      'x-internal-proxy-secret': 'test-proxy-secret',
      'x-user-id': rep.id,
    }
    const secHeaders = {
      'x-internal-proxy-secret': 'test-proxy-secret',
      'x-user-id': secretariat.id,
    }

    return {
      testApp,
      rep,
      secretariat,
      companyStore,
      company,
      verificationStore,
      catalogue,
      booth: boothRes.booth,
      repHeaders,
      secHeaders,
    }
  }

  describe('Eligibility Gate (Criterion 1)', () => {
    it('refuses booth reservation for unsubmitted company with 403 company_not_verified', async () => {
      const { testApp, booth, repHeaders } = await setup('unsubmitted')
      const res = await request(testApp.app)
        .post(`/exhibitions/ex-1/booths/${booth.id}/reserve`)
        .set(repHeaders)

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('company_not_verified')
    })

    it('refuses booth reservation for pending company with 403 company_not_verified', async () => {
      const { testApp, booth, repHeaders } = await setup('pending')
      const res = await request(testApp.app)
        .post(`/exhibitions/ex-1/booths/${booth.id}/reserve`)
        .set(repHeaders)

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('company_not_verified')
    })

    it('refuses booth reservation for returned company with 403 company_not_verified', async () => {
      const { testApp, booth, repHeaders } = await setup('returned')
      const res = await request(testApp.app)
        .post(`/exhibitions/ex-1/booths/${booth.id}/reserve`)
        .set(repHeaders)

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('company_not_verified')
    })

    it('refuses booth reservation for rejected company with 403 company_not_verified', async () => {
      const { testApp, booth, repHeaders } = await setup('rejected')
      const res = await request(testApp.app)
        .post(`/exhibitions/ex-1/booths/${booth.id}/reserve`)
        .set(repHeaders)

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('company_not_verified')
    })

    it('allows booth reservation for approved company', async () => {
      const { testApp, booth, repHeaders, company } = await setup('approved')
      const res = await request(testApp.app)
        .post(`/exhibitions/ex-1/booths/${booth.id}/reserve`)
        .set(repHeaders)

      expect(res.status).toBe(201)
      expect(res.body.reservation).toMatchObject({
        boothId: booth.id,
        companyId: company.id,
        attendanceStatus: 'pending',
      })
    })

    it.each(['unsubmitted', 'pending', 'returned', 'rejected'] as const)('refuses formal request submission for %s company without an eligibility override', async (status) => {
      // Pool stub returning a draft request
      const poolQuery = vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT') && sql.includes('FROM dashboard.requests')) {
          return {
            rows: [
              {
                id: '00000000-0000-4000-8000-000000000001',
                revision: 1,
                tracking_code: 'REQ-1',
                title: 'Formal event proposal',
                service_id: 'srv-1',
                service_key: 'event',
                service_name: 'Event',
                owner_id: 'user-1',
                company_id: '1',
                status: 'draft',
                current_step_index: 0,
                assigned_role: null,
                current_step: null,
                answers: {},
                submission_date: null,
                due_date: null,
                created_at: new Date(),
                updated_at: new Date(),
              },
            ],
          }
        }
        return { rows: [] }
      })

      const poolStub = { query: poolQuery, connect: vi.fn() } as unknown as Pool
      const { testApp, repHeaders } = await setup(status, poolStub)

      const reqRes = await request(testApp.app)
        .post('/requests/00000000-0000-4000-8000-000000000001/submit')
        .set(repHeaders)

      expect(reqRes.status).toBe(403)
      expect(reqRes.body.error).toBe('company_not_verified')
    })
  })

  describe('Identity Change Triggers Re-Verification (Criterion 2)', () => {
    it('invalidates approval when company legal name is changed via PATCH /profile', async () => {
      const { testApp, repHeaders, verificationStore, company } = await setup('approved')

      const before = await verificationStore.findCurrentByCompanyId(company.id)
      expect(before?.status).toBe('approved')

      const updateRes = await request(testApp.app)
        .patch('/profile')
        .set(repHeaders)
        .send({ company: { name: 'نام جدید شرکت' } })

      expect(updateRes.status).toBe(200)

      const after = await verificationStore.findCurrentByCompanyId(company.id)
      expect(after?.status).toBe('returned')
      expect(after?.reason).toContain('تغییر اطلاعات هویتی')
    })

    it('requires a new revision when identity changes during pending review', async () => {
      const { testApp, repHeaders, verificationStore, company, secretariat } = await setup('pending')
      const original = (await verificationStore.findCurrentByCompanyId(company.id))!
      await request(testApp.app).patch('/profile').set(repHeaders)
        .send({ company: { name: 'Changed while pending' } }).expect(200)
      expect(await verificationStore.decide({ id: original.id, action: 'approve', reviewerId: secretariat.id }))
        .toEqual({ ok: false, reason: 'not_pending' })
      const resubmitted = await verificationStore.submit({ companyId: company.id, representativeId: original.representativeId, snapshot: {} })
      expect(resubmitted).toMatchObject({ ok: true, verification: { revision: 2, status: 'pending' } })
    })

    it('revokes eligibility before a later contact update fails', async () => {
      const { testApp, repHeaders, verificationStore, company } = await setup('approved')
      vi.spyOn(testApp.userStore, 'update').mockRejectedValueOnce(new Error('Contact service unavailable'))
      await request(testApp.app).patch('/profile').set(repHeaders)
        .send({ company: { name: 'Changed identity' }, contacts: { email: 'new@example.invalid' } }).expect(500)
      expect((await testApp.companyStore.findById(company.id))?.name).toBe('Changed identity')
      expect(await verificationStore.isVerified(company.id)).toBe(false)
    })

    it('invalidates approval when company registrationNumber is changed via PATCH /profile', async () => {
      const { testApp, repHeaders, verificationStore, company } = await setup('approved')

      const updateRes = await request(testApp.app)
        .patch('/profile')
        .set(repHeaders)
        .send({ company: { registrationNumber: '112233' } })

      expect(updateRes.status).toBe(200)

      const after = await verificationStore.findCurrentByCompanyId(company.id)
      expect(after?.status).toBe('returned')
    })

    it('invalidates approval when legalEntityType is changed via PATCH /profile/dossier', async () => {
      const { testApp, repHeaders, verificationStore, company } = await setup('approved')

      const updateRes = await request(testApp.app)
        .patch('/profile/dossier')
        .set(repHeaders)
        .send({ legalEntityType: 'مسئولیت محدود' })

      expect(updateRes.status).toBe(200)

      const after = await verificationStore.findCurrentByCompanyId(company.id)
      expect(after?.status).toBe('returned')
    })

    it('does NOT invalidate approval when non-identity fields (phone, email) are updated', async () => {
      const { testApp, repHeaders, verificationStore, company } = await setup('approved')

      const updateRes = await request(testApp.app)
        .patch('/profile')
        .set(repHeaders)
        .send({ contacts: { phone: '09129999999', email: 'new@company.com' } })

      expect(updateRes.status).toBe(200)

      const after = await verificationStore.findCurrentByCompanyId(company.id)
      expect(after?.status).toBe('approved')
    })

    it('does NOT invalidate approval when the same identity values are submitted (idempotent)', async () => {
      const { testApp, repHeaders, verificationStore, company } = await setup('approved')

      const updateRes = await request(testApp.app)
        .patch('/profile')
        .set(repHeaders)
        .send({ company: { name: 'شرکت فناور پیشرو', registrationNumber: '998877' } })

      expect(updateRes.status).toBe(200)

      const after = await verificationStore.findCurrentByCompanyId(company.id)
      expect(after?.status).toBe('approved')
    })

    it('invalidates approval via explicit POST /profile/verification/invalidate', async () => {
      const { testApp, repHeaders, verificationStore, company } = await setup('approved')

      const res = await request(testApp.app)
        .post('/profile/verification/invalidate')
        .set(repHeaders)
        .send({ reason: 'تغییر ثبتی اساسی' })

      expect(res.status).toBe(200)
      expect(res.body.invalidated).toBe(true)

      const after = await verificationStore.findCurrentByCompanyId(company.id)
      expect(after?.status).toBe('returned')
      expect(after?.reason).toBe('تغییر ثبتی اساسی')
    })
  })

  describe('Post-Invalidation Loss of Eligibility and Full Re-Verification Cycle', () => {
    it('blocks subsequent booth reservation after identity edit until re-verified', async () => {
      const { testApp, booth, repHeaders, secHeaders, verificationStore, company } = await setup('approved')

      // 1. Identity edit invalidates verification
      await request(testApp.app)
        .patch('/profile')
        .set(repHeaders)
        .send({ company: { name: 'شرکت فناور دانا' } })
        .expect(200)

      expect(await verificationStore.isVerified(company.id)).toBe(false)

      // 2. Reservation is now refused
      const blockedRes = await request(testApp.app)
        .post(`/exhibitions/ex-1/booths/${booth.id}/reserve`)
        .set(repHeaders)
      expect(blockedRes.status).toBe(403)
      expect(blockedRes.body.error).toBe('company_not_verified')

      // 3. Representative resubmits verification (revision 2)
      testApp.dossierDocuments.add(company.id, 'articlesOfAssociation', 'statute.pdf', 1024)
      testApp.dossierDocuments.add(company.id, 'establishmentNotices', 'notice.pdf', 2048)

      const resubmit = await request(testApp.app)
        .post('/profile/verification/submit')
        .set(repHeaders)
      expect(resubmit.status).toBe(201)
      expect(resubmit.body.verification).toMatchObject({
        revision: 2,
        status: 'pending',
      })

      // Still pending: booth reservation still blocked
      const stillBlocked = await request(testApp.app)
        .post(`/exhibitions/ex-1/booths/${booth.id}/reserve`)
        .set(repHeaders)
      expect(stillBlocked.status).toBe(403)

      // 4. Secretariat approves revision 2
      const approveRes = await request(testApp.app)
        .post(`/admin/verifications/${resubmit.body.verification.id}/decision`)
        .set(secHeaders)
        .send({ action: 'approve' })
      expect(approveRes.status).toBe(200)
      expect(approveRes.body.verification).toMatchObject({
        revision: 2,
        status: 'approved',
      })

      expect(await verificationStore.isVerified(company.id)).toBe(true)

      // 5. Booth reservation is now allowed!
      const allowedRes = await request(testApp.app)
        .post(`/exhibitions/ex-1/booths/${booth.id}/reserve`)
        .set(repHeaders)
      expect(allowedRes.status).toBe(201)
      expect(allowedRes.body.reservation.attendanceStatus).toBe('pending')
    })
  })
})
