import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { runMigrations } from '../../src/db/migrate.js'
import { PostgresVerificationStore } from '../../src/dashboard/verification-repo.js'
import { RequestRepository } from '../../src/dashboard/request-repo.js'

const connectionString = process.env.DATABASE_URL ?? 'postgres://dacho:***@localhost:5432/dacho-cms'
const pool = new Pool({ connectionString, application_name: 're-verification-int-test' })
const verificationStore = new PostgresVerificationStore(pool)
const requestRepo = new RequestRepository(pool)

const companyId = 'reverif-comp-int-01'
const representativeId = 'reverif-user-int-01'
const secretariatId = 'reverif-sec-int-01'

async function clearFixtures() {
  await pool.query('DELETE FROM dashboard.request_verifications WHERE company_id = $1', [companyId])
  await pool.query('DELETE FROM dashboard.requests WHERE company_id = $1', [companyId])
  await pool.query('DELETE FROM dashboard.company_verifications WHERE company_id = $1', [companyId])
  await pool.query('DELETE FROM dashboard.activities WHERE owner_id = $1', [representativeId])
}

describe('T15: Re-verification and participation eligibility (PostgreSQL Integration)', () => {
  beforeAll(async () => {
    await runMigrations(connectionString)
  })

  beforeEach(clearFixtures)

  afterAll(async () => {
    await clearFixtures()
    await pool.end()
  })

  it('verifies company, pins immutable snapshot on request submit, invalidates on identity change, and preserves historical snapshot', async () => {
    // 1. Initial verification submission and approval
    const submitResult = await verificationStore.submit({
      companyId,
      representativeId,
      snapshot: {
        company: { name: 'فناوران نسل نو', registrationNumber: '12345' },
        dossier: { legalEntityType: 'سهامی خاص' },
      },
    })
    expect(submitResult.ok).toBe(true)
    if (!submitResult.ok) return

    const decideResult = await verificationStore.decide({
      id: submitResult.verification.id,
      action: 'approve',
      reviewerId: secretariatId,
      expectedRevision: 1,
    })
    expect(decideResult.ok).toBe(true)

    // Verification is now approved
    expect(await verificationStore.isVerified(companyId)).toBe(true)
    const currentVerif = await verificationStore.findCurrentByCompanyId(companyId)
    expect(currentVerif?.status).toBe('approved')
    expect(currentVerif?.revision).toBe(1)

    // 2. Create and submit a formal request
    const createdRequest = await requestRepo.create({
      serviceId: 'srv-event',
      serviceKey: 'event',
      serviceName: 'Event',
      title: 'درخواست حضور در رویداد ملی',
      ownerId: representativeId,
      companyId,
      answers: { topic: 'AI' },
    })

    const submitReqResult = await requestRepo.submit(
      createdRequest.id,
      representativeId,
      { assignedRole: 'دبیرخانه', currentStep: 'بررسی اولیه' },
      companyId,
      {
        id: currentVerif!.id,
        revision: currentVerif!.revision,
        snapshot: currentVerif!.snapshot,
      },
    )

    expect(typeof submitReqResult).toBe('object')
    expect((submitReqResult as { status: string }).status).toBe('in_review')

    // 3. Pinned verification snapshot exists in database
    const pinned = await requestRepo.findRequestVerification(createdRequest.id)
    expect(pinned).not.toBeNull()
    expect(pinned).toMatchObject({
      requestId: createdRequest.id,
      companyId,
      verificationId: currentVerif!.id,
      revision: 1,
      snapshot: {
        company: { name: 'فناوران نسل نو', registrationNumber: '12345' },
        dossier: { legalEntityType: 'سهامی خاص' },
      },
    })

    // 4. Verify trigger: UPDATE on request_verifications is rejected
    await expect(
      pool.query(
        'UPDATE dashboard.request_verifications SET revision = 99 WHERE request_id = $1',
        [createdRequest.id],
      ),
    ).rejects.toThrow('Request verification snapshots are immutable')

    // 5. Identity change invalidates verification approval
    const invalidationResult = await verificationStore.invalidateApproval(
      companyId,
      'تغییر نام ثبتی شرکت به فناوران داده گستر',
    )
    expect(invalidationResult).toBe(true)

    // Verification is now returned (requiring re-verification)
    expect(await verificationStore.isVerified(companyId)).toBe(false)
    const afterInvalidation = await verificationStore.findCurrentByCompanyId(companyId)
    expect(afterInvalidation?.status).toBe('returned')
    expect(afterInvalidation?.reason).toBe('تغییر نام ثبتی شرکت به فناوران داده گستر')

    // Activity transition was recorded
    const activities = await pool.query<{ action: string; from_state: string; to_state: string }>(
      'SELECT action, from_state, to_state FROM dashboard.activities WHERE owner_id = $1 AND action = $2',
      [representativeId, 'verification_return'],
    )
    expect(activities.rows[0]).toMatchObject({
      action: 'verification_return',
      from_state: 'approved',
      to_state: 'returned',
    })

    // 6. The previous request STILL retains its original revision 1 approved snapshot!
    const pinnedAfter = await requestRepo.findRequestVerification(createdRequest.id)
    expect(pinnedAfter).not.toBeNull()
    expect(pinnedAfter?.revision).toBe(1)
    expect(pinnedAfter?.snapshot).toEqual(currentVerif?.snapshot)

    // 7. Resubmission of verification advances revision
    const resubmitResult = await verificationStore.submit({
      companyId,
      representativeId,
      snapshot: {
        company: { name: 'فناوران داده گستر', registrationNumber: '12345' },
        dossier: { legalEntityType: 'سهامی خاص' },
      },
    })
    expect(resubmitResult.ok).toBe(true)
    if (!resubmitResult.ok) return
    expect(resubmitResult.verification.revision).toBe(2)
    expect(resubmitResult.verification.status).toBe('pending')

    // 8. Approval of revision 2 restores eligibility
    const decideResult2 = await verificationStore.decide({
      id: resubmitResult.verification.id,
      action: 'approve',
      reviewerId: secretariatId,
      expectedRevision: 2,
    })
    expect(decideResult2.ok).toBe(true)
    expect(await verificationStore.isVerified(companyId)).toBe(true)
  })
})
