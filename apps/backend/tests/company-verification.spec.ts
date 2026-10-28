import { describe, expect, it } from 'vitest'
import request from 'supertest'

import { createTestApp } from './helpers.js'

describe('Company Verification and Secretariat Queue (T14)', () => {
  async function setup() {
    const testApp = await createTestApp()

    // 1. Company Representative user
    const repUser = await testApp.userStore.findOrCreateByPhone('09121111111')
    repUser.name = 'نماینده شرکت پیشرو'
    repUser.operationalRole = 'representative'
    repUser.roles = ['representative']

    // Company owned by repUser
    const company = await testApp.companyStore.create({
      name: 'شرکت دانش‌بنیان پیشرو',
      nationalId: '14001111111',
      activityDomain: 'نرم‌افزار و هوش مصنوعی',
      registrationNumber: '123456',
      status: 'فعال',
      type: 'سهامی خاص',
      province: 'تهران',
      city: 'تهران',
      establishmentDate: '1398/01/01',
      representativeId: repUser.id,
      legalEntityType: 'سهامی خاص',
      knowledgeBasedStatus: 'دانش‌بنیان نوپا',
      classification: 'فناوری اطلاعات',
      foundingYear: '1398',
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
    })

    // Seed required documents in dossierDocuments (articlesOfAssociation, establishmentNotices)
    testApp.dossierDocuments.add(company.id, 'articlesOfAssociation', 'statute.pdf', 1024)
    testApp.dossierDocuments.add(company.id, 'establishmentNotices', 'notice.pdf', 2048)

    // 2. Secretariat user
    const secretariat = await testApp.userStore.findOrCreateByPhone('09122222222')
    secretariat.name = 'مسئول دبیرخانه'
    secretariat.operationalRole = 'central-secretariat'
    secretariat.roles = ['admin']

    // 3. System Owner user
    const owner = await testApp.userStore.findOrCreateByPhone('09123333333')
    owner.name = 'صاحب سیستم'
    owner.operationalRole = 'system-owner'
    owner.roles = ['admin']

    // 4. Ordinary reviewer user (unauthorized for verification queue/decisions)
    const reviewer = await testApp.userStore.findOrCreateByPhone('09124444444')
    reviewer.name = 'داور علمی'
    reviewer.operationalRole = 'reviewer'
    reviewer.roles = ['referee']

    const repHeaders = {
      'x-internal-proxy-secret': 'test-proxy-secret',
      'x-user-id': repUser.id,
      'x-user-roles': 'representative',
    }
    const secretariatHeaders = {
      'x-internal-proxy-secret': 'test-proxy-secret',
      'x-user-id': secretariat.id,
      'x-user-roles': 'central-secretariat',
    }
    const ownerHeaders = {
      'x-internal-proxy-secret': 'test-proxy-secret',
      'x-user-id': owner.id,
      'x-user-roles': 'system-owner',
    }
    const reviewerHeaders = {
      'x-internal-proxy-secret': 'test-proxy-secret',
      'x-user-id': reviewer.id,
      'x-user-roles': 'reviewer',
    }

    return {
      ...testApp,
      repUser,
      company,
      secretariat,
      owner,
      reviewer,
      repHeaders,
      secretariatHeaders,
      ownerHeaders,
      reviewerHeaders,
    }
  }

  describe('Verification Submission', () => {
    it('blocks submission when required dossier fields or documents are missing', async () => {
      const { app, repHeaders, company, companyStore } = await setup()
      // Remove registrationNumber to make dossier incomplete
      await companyStore.update(company.id, { registrationNumber: '' })

      const res = await request(app)
        .post('/profile/verification/submit')
        .set(repHeaders)

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('incomplete_dossier')
      expect(res.body.missing).toContain('registrationNumber')
    })

    it('denies non-representative users from submitting company verification', async () => {
      const { app, secretariatHeaders } = await setup()
      const res = await request(app)
        .post('/profile/verification/submit')
        .set(secretariatHeaders)

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('forbidden')
    })

    it('submits complete company dossier for verification and creates revision 1 snapshot', async () => {
      const { app, repHeaders } = await setup()

      const res = await request(app)
        .post('/profile/verification/submit')
        .set(repHeaders)

      expect(res.status).toBe(201)
      expect(res.body.verification).toMatchObject({
        status: 'pending',
        revision: 1,
        reason: null,
        reviewerId: null,
        decidedAt: null,
      })
      expect(res.body.verification.submittedAt).toBeTruthy()
      expect(res.body.verification.snapshot.company.name).toBe('شرکت دانش‌بنیان پیشرو')
      expect(res.body.verification.snapshot.documents).toHaveLength(2)

      // Query verification status
      const statusRes = await request(app).get('/profile/verification').set(repHeaders)
      expect(statusRes.status).toBe(200)
      expect(statusRes.body).toMatchObject({
        status: 'pending',
        revision: 1,
        canRequestVerification: false,
      })
      expect(statusRes.body.history).toHaveLength(1)
    })

    it('rejects duplicate submission while status is already pending', async () => {
      const { app, repHeaders } = await setup()
      await request(app).post('/profile/verification/submit').set(repHeaders).expect(201)

      const duplicateRes = await request(app)
        .post('/profile/verification/submit')
        .set(repHeaders)

      expect(duplicateRes.status).toBe(409)
      expect(duplicateRes.body.error).toBe('already_submitted')
    })
  })

  describe('Secretariat Cartable Queue', () => {
    it('restricts queue access to company administrators (Secretariat and System Owner)', async () => {
      const { app, repHeaders, reviewerHeaders, secretariatHeaders, ownerHeaders } = await setup()

      await request(app).get('/admin/verifications').set(repHeaders).expect(403)
      await request(app).get('/admin/verifications').set(reviewerHeaders).expect(403)

      const secRes = await request(app).get('/admin/verifications').set(secretariatHeaders)
      expect(secRes.status).toBe(200)

      const ownerRes = await request(app).get('/admin/verifications').set(ownerHeaders)
      expect(ownerRes.status).toBe(200)
    })

    it('lists pending verifications in the Secretariat queue with search and status filtering', async () => {
      const { app, repHeaders, secretariatHeaders } = await setup()
      await request(app).post('/profile/verification/submit').set(repHeaders).expect(201)

      const queueRes = await request(app)
        .get('/admin/verifications?status=pending')
        .set(secretariatHeaders)

      expect(queueRes.status).toBe(200)
      expect(queueRes.body.items).toHaveLength(1)
      expect(queueRes.body.items[0]).toMatchObject({
        companyName: 'شرکت دانش‌بنیان پیشرو',
        nationalId: '14001111111',
        status: 'pending',
        revision: 1,
      })

      // Search by national ID
      const searchRes = await request(app)
        .get('/admin/verifications?search=14001111111')
        .set(secretariatHeaders)
      expect(searchRes.body.items).toHaveLength(1)

      // Search non-matching
      const emptySearch = await request(app)
        .get('/admin/verifications?search=999999999')
        .set(secretariatHeaders)
      expect(emptySearch.body.items).toHaveLength(0)
    })

    it('exposes submitted snapshot and allowed actions on single verification detail', async () => {
      const { app, repHeaders, secretariatHeaders } = await setup()
      const submitRes = await request(app).post('/profile/verification/submit').set(repHeaders)
      const verificationId = submitRes.body.verification.id

      const detailRes = await request(app)
        .get(`/admin/verifications/${verificationId}`)
        .set(secretariatHeaders)

      expect(detailRes.status).toBe(200)
      expect(detailRes.body.verification.id).toBe(verificationId)
      expect(detailRes.body.verification.snapshot.company.nationalId).toBe('14001111111')
      expect(detailRes.body.allowedActions).toEqual(['read', 'approve', 'return', 'reject'])
    })
  })

  describe('Verification Decisions & Self-Approval Prohibition', () => {
    it('prohibits company self-approval even if representative holds admin role', async () => {
      const { app, userStore, companyStore, dossierDocuments } = await setup()

      // User who is Secretariat
      const dualUser = await userStore.findOrCreateByPhone('09129999999')
      dualUser.name = 'دبیرخانه و نماینده'
      dualUser.operationalRole = 'representative'
      dualUser.roles = ['representative', 'admin']

      // But dualUser is ALSO the representative of this company:
      const dualCompany = await companyStore.create({
        name: 'شرکت شخصی مسئول دبیرخانه',
        nationalId: '14009999999',
        activityDomain: 'فناوری و نرم‌افزار',
        registrationNumber: '9999',
        representativeId: dualUser.id,
        status: 'فعال',
        type: 'سهامی خاص',
        legalEntityType: 'سهامی خاص',
        knowledgeBasedStatus: 'دانش‌بنیان',
        classification: 'نرم‌افزار',
        foundingYear: '1400',
        productsServices: ['سرویس'],
        addresses: [{ id: 'a1', title: 'دفتر', province: 'تهران', city: 'تهران', postalCode: '1111111111', address: 'خ ۱' }],
        notAvailable: [
          'centerEstablishment', 'website', 'insuredEmployeeCount', 'pastProjectsCustomers',
          'requestedServices', 'catalogues', 'certificatesLicenses', 'amendmentNotices',
        ],
      })
      dossierDocuments.add(dualCompany.id, 'articlesOfAssociation', 'statute.pdf', 1024)
      dossierDocuments.add(dualCompany.id, 'establishmentNotices', 'notice.pdf', 2048)

      // Dual user submits verification as representative
      const dualRepHeaders = {
        'x-internal-proxy-secret': 'test-proxy-secret',
        'x-user-id': dualUser.id,
        'x-user-roles': 'representative',
      }
      const submit = await request(app).post('/profile/verification/submit').set(dualRepHeaders).expect(201)
      const verifId = submit.body.verification.id

      // Now dualUser acts as Secretariat and attempts to approve their own company:
      dualUser.operationalRole = 'central-secretariat'
      const dualSecHeaders = {
        'x-internal-proxy-secret': 'test-proxy-secret',
        'x-user-id': dualUser.id,
        'x-user-roles': 'central-secretariat',
      }
      const selfDecision = await request(app)
        .post(`/admin/verifications/${verifId}/decision`)
        .set(dualSecHeaders)
        .send({ action: 'approve' })

      expect(selfDecision.status).toBe(403)
      expect(selfDecision.body.error).toBe('self_approval_prohibited')
    })

    it('requires a reason when returning or rejecting verification', async () => {
      const { app, repHeaders, secretariatHeaders } = await setup()
      const submit = await request(app).post('/profile/verification/submit').set(repHeaders)
      const verifId = submit.body.verification.id

      const returnWithoutReason = await request(app)
        .post(`/admin/verifications/${verifId}/decision`)
        .set(secretariatHeaders)
        .send({ action: 'return' })

      expect(returnWithoutReason.status).toBe(400)
      expect(returnWithoutReason.body.error).toBe('reason_required')

      const rejectWithoutReason = await request(app)
        .post(`/admin/verifications/${verifId}/decision`)
        .set(secretariatHeaders)
        .send({ action: 'reject', reason: '   ' })

      expect(rejectWithoutReason.status).toBe(400)
      expect(rejectWithoutReason.body.error).toBe('reason_required')
    })

    it('rejects decisions with stale revision numbers', async () => {
      const { app, repHeaders, secretariatHeaders } = await setup()
      const submit = await request(app).post('/profile/verification/submit').set(repHeaders)
      const verifId = submit.body.verification.id

      const staleDecision = await request(app)
        .post(`/admin/verifications/${verifId}/decision`)
        .set(secretariatHeaders)
        .send({ action: 'return', reason: 'نیاز به اصلاح', expectedRevision: 99 })

      expect(staleDecision.status).toBe(409)
      expect(staleDecision.body.error).toBe('stale_revision')
    })

    it('returns verification with reason, creates a needs_fix letter, and allows company correction and resubmission', async () => {
      const { app, repHeaders, secretariatHeaders, secretariat } = await setup()

      // 1. Submit initial revision 1
      const submit1 = await request(app).post('/profile/verification/submit').set(repHeaders)
      const verifId = submit1.body.verification.id

      // 2. Secretariat returns with reason
      const returnRes = await request(app)
        .post(`/admin/verifications/${verifId}/decision`)
        .set(secretariatHeaders)
        .send({
          action: 'return',
          reason: 'تصویر اساسنامه ناخوانا است، لطفاً نسخه باکیفیت بارگذاری کنید.',
          expectedRevision: 1,
        })

      expect(returnRes.status).toBe(200)
      expect(returnRes.body.verification).toMatchObject({
        status: 'returned',
        revision: 1,
        reviewerId: secretariat.id,
        reason: 'تصویر اساسنامه ناخوانا است، لطفاً نسخه باکیفیت بارگذاری کنید.',
      })
      expect(returnRes.body.verification.decidedAt).toBeTruthy()

      // 3. Representative sees returned status & reason
      const repCheck = await request(app).get('/profile/verification').set(repHeaders)
      expect(repCheck.body).toMatchObject({
        status: 'returned',
        revision: 1,
        reason: 'تصویر اساسنامه ناخوانا است، لطفاً نسخه باکیفیت بارگذاری کنید.',
        canRequestVerification: true,
      })

      // 4. Representative corrects profile
      await request(app)
        .patch('/profile')
        .set(repHeaders)
        .send({ company: { name: 'شرکت دانش‌بنیان پیشرو (اصلاح‌شده)' } })
        .expect(200)

      // 5. Representative resubmits for verification on the same profile
      const resubmit = await request(app).post('/profile/verification/submit').set(repHeaders)
      expect(resubmit.status).toBe(201)
      expect(resubmit.body.verification).toMatchObject({
        status: 'pending',
        revision: 2,
        reason: null,
        reviewerId: null,
      })
      expect(resubmit.body.verification.snapshot.company.name).toBe('شرکت دانش‌بنیان پیشرو (اصلاح‌شده)')

      // History preserves revision 1 with its return reason
      const updatedStatus = await request(app).get('/profile/verification').set(repHeaders)
      expect(updatedStatus.body.status).toBe('pending')
      expect(updatedStatus.body.revision).toBe(2)
      expect(updatedStatus.body.history).toHaveLength(2)
      expect(updatedStatus.body.history[1]).toMatchObject({
        revision: 1,
        status: 'returned',
        reason: 'تصویر اساسنامه ناخوانا است، لطفاً نسخه باکیفیت بارگذاری کنید.',
      })
    })

    it('approves verification, creates approved letter, and prevents re-submission once approved', async () => {
      const { app, repHeaders, secretariatHeaders, secretariat } = await setup()
      const submit = await request(app).post('/profile/verification/submit').set(repHeaders)
      const verifId = submit.body.verification.id

      const approveRes = await request(app)
        .post(`/admin/verifications/${verifId}/decision`)
        .set(secretariatHeaders)
        .send({ action: 'approve' })

      expect(approveRes.status).toBe(200)
      expect(approveRes.body.verification).toMatchObject({
        status: 'approved',
        revision: 1,
        reviewerId: secretariat.id,
      })
      expect(approveRes.body.verification.decidedAt).toBeTruthy()

      // Subsequent submit blocked once approved
      const resubmitOnceApproved = await request(app)
        .post('/profile/verification/submit')
        .set(repHeaders)
      expect(resubmitOnceApproved.status).toBe(409)
      expect(resubmitOnceApproved.body.error).toBe('already_approved')
    })
  })
})
