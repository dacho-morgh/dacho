import { describe, expect, it } from 'vitest'
import request from 'supertest'

import { InMemoryUserStore, type User } from '../src/auth/user-store.js'
import {
  isReviewerRole,
  necessaryCompanyProfile,
  parseQueueView,
} from '../src/dashboard/review-case-repo.js'
import { createTestApp } from './helpers.js'

const REQUEST_ID = '00000000-0000-4000-8000-000000000001'
const ROUND_ID = '00000000-0000-4000-8000-0000000000aa'
const DOC_ID = '00000000-0000-4000-8000-0000000000d1'
const RFP_FILE_ID = '00000000-0000-4000-8000-0000000000f1'

const person = (id: string, operationalRole: User['operationalRole']): User => ({
  id, phone: id, name: id, operationalRole, isActive: true,
})
const USERS: User[] = [
  person('owner-1', 'system-owner'),
  person('secretariat-1', 'central-secretariat'),
  person('chief-1', 'chief-reviewer'),
  person('investment-1', 'investment-reviewer'),
  person('rep-1', 'representative'),
  person('reviewer-1', 'reviewer'),
  person('employer-1', 'employer-reviewer'),
]

const header = (userId: string) => ({ 'x-internal-proxy-secret': 'test-proxy-secret', 'x-user-id': userId })

const FULL_SNAPSHOT = {
  company: {
    name: 'شرکت فناور', nationalId: '10100', type: 'knowledge-based', province: 'تهران', city: 'تهران',
    phone: '021-000', email: 'secret@example.test', iban: 'IR000',
  },
  dossier: {
    legalEntityType: 'llc', classification: 'A', activityDomain: 'AI', productsServices: ['x'],
    keyMembers: [{ name: 'private person', role: 'ceo' }], insuredEmployeeCount: 40,
  },
  documents: [{ id: 'dossier-file' }],
}

function queueRow(overrides: Record<string, unknown> = {}) {
  return {
    request_id: REQUEST_ID, tracking_code: 'DCH-2026-0001', title: 'طرح', revision: 3, status: 'in_review',
    review_stage: 'triaged', submission_date: new Date('2026-10-01T00:00:00Z'),
    event_id: 'event-1', event_title: 'رویداد', subtopic_id: 'sub-1', subtopic_title: 'زیرعنوان',
    company_name: 'شرکت فناور', role: 'reviewer', slot: 'ordinary', assigned_at: new Date('2026-10-02T00:00:00Z'),
    round_id: ROUND_ID, round_request_revision: 3, round_proposal_revision: 2, proposal_revision: 2,
    actionable: true, evaluation_state: null, evaluation_revision: null, evaluation_updated_at: null,
    evaluation_finalized_at: null,
    ...overrides,
  }
}

async function setup(options: { row?: Record<string, unknown> | null; snapshot?: unknown } = {}) {
  const calls: { sql: string; params: unknown[] }[] = []
  const row = options.row === undefined ? queueRow() : options.row
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params })
    if (sql.includes('FILTER (WHERE actionable)')) return { rows: [{ open: '1', closed: '2' }] }
    if (sql.includes('SELECT * FROM (')) {
      const forRequest = sql.includes('WHERE request_id = $3')
      if (forRequest && params[2] !== REQUEST_ID) return { rows: [] }
      return { rows: row ? [row] : [] }
    }
    if (sql.includes('FROM dashboard.request_verifications WHERE request_id = $1')) {
      const snapshot = options.snapshot === undefined ? FULL_SNAPSHOT : options.snapshot
      return { rows: snapshot ? [{ snapshot }] : [] }
    }
    if (sql.includes('FROM dashboard.request_proposals WHERE request_id = $1 AND revision = $2')) {
      return {
        rows: [{
          revision: params[1], form_version: 'event-application-2026-v1',
          application_team: [{ name: 'سارا', role: 'مدیر' }],
          proposal_documents: [{ id: DOC_ID, filename: 'proposal.pdf', mimeType: 'application/pdf', sizeBytes: 12, logicalVersion: 1, createdAt: 'x' }],
          answers: { summary: 'خلاصه' }, created_at: new Date('2026-10-01T00:00:00Z'),
        }],
      }
    }
    if (sql.includes('FROM dashboard.request_rfps rfp') && sql.includes('rfp_files')) {
      return { rows: [{ version_id: 'rfp-v1', id: RFP_FILE_ID, filename: 'rfp.pdf', mime_type: 'application/pdf', size_bytes: 9 }] }
    }
    return { rows: [] }
  }
  const { app } = await createTestApp({ userStore: new InMemoryUserStore(USERS), pool: { query } as any })
  return { app, calls }
}

describe('[T23] review queue helpers', () => {
  it('recognises only the two evaluating roles', () => {
    expect(isReviewerRole('reviewer')).toBe(true)
    expect(isReviewerRole('employer-reviewer')).toBe(true)
    for (const role of ['chief-reviewer', 'investment-reviewer', 'system-owner', 'central-secretariat', 'representative', '', undefined]) {
      expect(isReviewerRole(role)).toBe(false)
    }
  })

  it('parses the queue view with an open default and rejects unknown values', () => {
    expect(parseQueueView(undefined)).toBe('open')
    expect(parseQueueView('open')).toBe('open')
    expect(parseQueueView('closed')).toBe('closed')
    expect(parseQueueView('all')).toBe('all')
    expect(parseQueueView('everything')).toBeNull()
    expect(parseQueueView(['open'])).toBeNull()
  })

  it('projects only the necessary company profile fields', () => {
    const profile = necessaryCompanyProfile(FULL_SNAPSHOT)
    expect(profile).toEqual({
      company: { name: 'شرکت فناور', nationalId: '10100', type: 'knowledge-based', province: 'تهران', city: 'تهران' },
      dossier: { legalEntityType: 'llc', classification: 'A', activityDomain: 'AI', productsServices: ['x'] },
    })
    const text = JSON.stringify(profile)
    for (const leaked of ['secret@example.test', 'IR000', '021-000', 'private person', 'dossier-file', 'insuredEmployeeCount']) {
      expect(text).not.toContain(leaked)
    }
    expect(necessaryCompanyProfile(null)).toEqual({
      company: { name: undefined, nationalId: undefined, type: undefined, province: undefined, city: undefined },
      dossier: { legalEntityType: undefined, classification: undefined, activityDomain: undefined, productsServices: undefined },
    })
  })
})

describe('[T23] GET /review/queue', () => {
  it.each(['owner-1', 'secretariat-1', 'chief-1', 'investment-1', 'rep-1'])('is closed to %s', async (userId) => {
    const { app, calls } = await setup()
    const res = await request(app).get('/review/queue').set(header(userId))
    expect(res.status).toBe(403)
    expect(calls).toHaveLength(0)
  })

  it('needs the proxy secret', async () => {
    const { app } = await setup()
    expect((await request(app).get('/review/queue').set({ 'x-user-id': 'reviewer-1' })).status).toBe(403)
  })

  it.each([['reviewer-1', 'reviewer'], ['employer-1', 'employer-reviewer']])(
    'is fed by the persisted assignment of %s and nothing the client sends',
    async (userId, role) => {
      const { app, calls } = await setup({ row: queueRow({ role }) })
      const res = await request(app)
        .get('/review/queue?userId=reviewer-2&role=chief-reviewer')
        .set({ ...header(userId), 'x-user-roles': 'system-owner' })
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toContain('no-store')
      expect(res.body.counts).toEqual({ open: 1, closed: 2, all: 3 })
      expect(res.body.total).toBe(1)
      expect(res.body.items).toHaveLength(1)
      for (const call of calls) expect(call.params.slice(0, 2)).toEqual([userId, role])
      expect(calls.every((call) => call.sql.includes('a.user_id = $1 AND a.role = $2 AND a.active'))).toBe(true)
    },
  )

  it('shows the case without any roster, owner, evaluation content or dossier data', async () => {
    const { app } = await setup({ row: queueRow({ evaluation_state: 'draft', evaluation_revision: 3, evaluation_updated_at: new Date('2026-10-03T00:00:00Z') }) })
    const res = await request(app).get('/review/queue?view=all').set(header('reviewer-1'))
    expect(res.status).toBe(200)
    expect(res.body.items[0]).toEqual({
      requestId: REQUEST_ID, trackingCode: 'DCH-2026-0001', title: 'طرح', revision: 3, status: 'in_review',
      reviewStage: 'triaged', submissionDate: '2026-10-01T00:00:00.000Z',
      event: { id: 'event-1', title: 'رویداد' }, subtopic: { id: 'sub-1', title: 'زیرعنوان' },
      companyName: 'شرکت فناور',
      assignment: { role: 'reviewer', slot: 'ordinary', assignedAt: '2026-10-02T00:00:00.000Z' },
      round: { id: ROUND_ID, requestRevision: 3, proposalRevision: 2, current: true },
      proposalRevision: 2, actionable: true,
      evaluation: { state: 'draft', revision: 3, updatedAt: '2026-10-03T00:00:00.000Z', finalizedAt: null },
    })
    const text = JSON.stringify(res.body)
    for (const leaked of ['ownerId', 'secret@example.test', 'IR000', 'answers', 'scores']) expect(text).not.toContain(leaked)
  })

  it('marks a round for an older revision as closed work', async () => {
    const { app } = await setup({ row: queueRow({ revision: 5, actionable: false }) })
    const res = await request(app).get('/review/queue?view=closed').set(header('reviewer-1'))
    expect(res.body.items[0]).toMatchObject({ actionable: false, round: { requestRevision: 3, current: false } })
  })

  it('rejects an unknown view and clamps the page size', async () => {
    const { app, calls } = await setup()
    expect((await request(app).get('/review/queue?view=mine').set(header('reviewer-1'))).status).toBe(400)
    await request(app).get('/review/queue?limit=5000&page=2').set(header('reviewer-1')).expect(200)
    const paged = calls.find((call) => call.sql.includes('LIMIT $3 OFFSET $4'))!
    expect(paged.params).toEqual(['reviewer-1', 'reviewer', 100, 100])
  })
})

describe('[T23] GET /review/cases/:id', () => {
  it.each(['owner-1', 'secretariat-1', 'chief-1', 'investment-1', 'rep-1'])('is closed to %s', async (userId) => {
    const { app, calls } = await setup()
    expect((await request(app).get(`/review/cases/${REQUEST_ID}`).set(header(userId))).status).toBe(403)
    expect(calls).toHaveLength(0)
  })

  it('answers 404 for a malformed id, an unassigned case and a guessed id alike', async () => {
    const { app } = await setup()
    for (const id of ['not-a-uuid', '00000000-0000-4000-8000-0000000000ff']) {
      const res = await request(app).get(`/review/cases/${id}`).set(header('reviewer-1'))
      expect(res.status, id).toBe(404)
      expect(res.body).toEqual({ error: 'not_found' })
    }
    const none = await setup({ row: null })
    expect((await request(none.app).get(`/review/cases/${REQUEST_ID}`).set(header('employer-1'))).status).toBe(404)
  })

  it('returns the reviewed revision, pinned files, RFP and the necessary profile only', async () => {
    const { app, calls } = await setup()
    const res = await request(app).get(`/review/cases/${REQUEST_ID}`).set(header('reviewer-1'))
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toContain('no-store')
    expect(res.body.case).toMatchObject({ requestId: REQUEST_ID, proposalRevision: 2, actionable: true })
    expect(res.body.proposal).toMatchObject({
      revision: 2,
      applicationTeam: [{ name: 'سارا', role: 'مدیر' }],
      answers: { summary: 'خلاصه' },
      documents: [{ id: DOC_ID, filename: 'proposal.pdf', downloadUrl: `/api/dashboard/documents/${DOC_ID}/download` }],
    })
    expect(res.body.rfp).toEqual({
      versionId: 'rfp-v1',
      files: [{
        id: RFP_FILE_ID, filename: 'rfp.pdf', mimeType: 'application/pdf', sizeBytes: 9,
        downloadUrl: `/api/dashboard/requests/${REQUEST_ID}/rfp/files/${RFP_FILE_ID}`,
      }],
    })
    expect(res.body.company).toEqual(necessaryCompanyProfile(FULL_SNAPSHOT))
    const text = JSON.stringify(res.body)
    for (const leaked of ['secret@example.test', 'IR000', 'private person', 'dossier-file', 'ownerId', 'startedBy', 'reviewer-2']) {
      expect(text).not.toContain(leaked)
    }
    // The proposal is read at the round's revision, not whatever is newest.
    const proposalCall = calls.find((call) => call.sql.includes('FROM dashboard.request_proposals WHERE request_id = $1 AND revision = $2'))!
    expect(proposalCall.params).toEqual([REQUEST_ID, 2])
  })

  it('has no proposal or profile for a case that never reached a pinned submission', async () => {
    const { app } = await setup({ snapshot: null, row: queueRow({ proposal_revision: null, company_name: null, round_id: null, round_request_revision: null, round_proposal_revision: null }) })
    const res = await request(app).get(`/review/cases/${REQUEST_ID}`).set(header('reviewer-1'))
    expect(res.status).toBe(200)
    expect(res.body.proposal).toBeNull()
    expect(res.body.company).toBeNull()
    expect(res.body.case.round).toBeNull()
  })
})
