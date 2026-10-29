import express, { type ErrorRequestHandler } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

import { createDashboardRouter } from '../src/dashboard/router.js'
import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore } from '../src/auth/user-store.js'
import { InMemoryServiceCatalog } from '../src/catalog/service-catalog.js'
import { InMemoryVerificationStore } from '../src/dashboard/verification-repo.js'
import { PrivateDocumentStorage } from '../src/documents/storage.js'
import {
  DEFAULT_EVENT_RULES_VERSION,
  DEFAULT_NON_COMPETE_VERSION,
  APPLICATION_FORM_VERSION,
} from '../src/dashboard/request-repo.js'

const PROXY_SECRET = 'phase0-internal-secret'

async function buildFixture(role = 'representative') {
  const reqId = randomUUID()
  const repId = 'rep-1'
  const companyId = '1'

  const userStore = new InMemoryUserStore()
  const user = await userStore.findOrCreateByPhone('09121111111')
  const originalId = user.id
  user.id = repId
  user.operationalRole = role as any
  user.roles = [role as any]
  user.isActive = true
  ;(userStore as any).users.delete(originalId)
  ;(userStore as any).users.set(repId, user)

  const companyStore = new InMemoryCompanyStore([
    { name: 'تست شرکت', nationalId: '10101010101', representativeId: repId },
  ])
  const verificationStore = new InMemoryVerificationStore()
  const submitRes = await verificationStore.submit({
    companyId,
    representativeId: repId,
    snapshot: { company: { name: 'تست شرکت' } },
  })
  if (!submitRes.ok) throw new Error('Verification submit failed')
  await verificationStore.decide({
    id: submitRes.verification.id,
    action: 'approve',
    reviewerId: 'secretariat',
    reason: null,
  })
  const serviceCatalog = new InMemoryServiceCatalog([
    {
      id: 'srv-event',
      key: 'event-application',
      title: 'ثبت‌نام در رویداد',
      workflow: [{ title: 'بررسی سردبیر', role: 'chief-reviewer', roleName: 'chief-reviewer', order: 1 }],
      formFields: null,
    },
  ])

  let currentRequest: any = {
    id: reqId,
    revision: 1,
    tracking_code: 'DCH-2026-0001',
    title: 'پیش‌نویس طرح',
    service_id: 'srv-event',
    service_key: 'event-application',
    service_name: 'ثبت‌نام در رویداد',
    owner_id: repId,
    company_id: companyId,
    status: 'draft',
    current_step_index: 0,
    assigned_role: null,
    current_step: null,
    answers: {},
    submission_date: null,
    due_date: null,
    submitted_by: null,
    created_at: new Date('2026-10-29T10:00:00Z'),
    updated_at: new Date('2026-10-29T10:00:00Z'),
  }

  const query = vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
    if (sql.includes('FROM dashboard.requests')) {
      if (currentRequest && currentRequest.id === params?.[0]) {
        return Promise.resolve({ rows: [currentRequest] })
      }
      return Promise.resolve({ rows: [] })
    }
    if (sql.includes('SELECT 1 FROM dashboard.request_rfps WHERE request_id = $1')) {
      return Promise.resolve({ rows: [{ exists: 1 }], rowCount: 1 })
    }
    if (sql.includes('FROM dashboard.private_documents') && sql.includes("category = 'proposal'")) {
      return Promise.resolve({
        rows: [
          {
            id: randomUUID(),
            original_filename: 'proposal.pdf',
            mime_type: 'application/pdf',
            size_bytes: 2048,
            storage_key: 'key-1',
            logical_version: 1,
            created_at: new Date(),
          },
        ],
        rowCount: 1,
      })
    }
    if (sql.includes('UPDATE dashboard.requests') && sql.includes("status = 'draft'")) {
      if (currentRequest.status !== 'draft') {
        return Promise.resolve({ rows: [] })
      }
      currentRequest = {
        ...currentRequest,
        title: params?.[2] ?? currentRequest.title,
        answers: params?.[3] ? JSON.parse(params[3] as string) : currentRequest.answers,
        updated_at: new Date(),
      }
      return Promise.resolve({ rows: [currentRequest] })
    }
    if (sql.includes('UPDATE dashboard.requests') && sql.includes("SET status = 'in_review'")) {
      currentRequest = {
        ...currentRequest,
        status: 'in_review',
        revision: currentRequest.revision + 1,
        submission_date: new Date(),
        submitted_by: params?.[1],
        assigned_role: params?.[2],
        current_step: params?.[3],
      }
      return Promise.resolve({ rows: [currentRequest] })
    }
    if (sql.includes('FROM dashboard.request_agreements')) {
      return Promise.resolve({
        rows: [
          {
            id: randomUUID(),
            request_id: reqId,
            revision: 2,
            agreement_type: 'non_compete',
            text_version_id: DEFAULT_NON_COMPETE_VERSION,
            accepted_by: repId,
            accepted_at: new Date(),
          },
          {
            id: randomUUID(),
            request_id: reqId,
            revision: 2,
            agreement_type: 'event_rules',
            text_version_id: DEFAULT_EVENT_RULES_VERSION,
            accepted_by: repId,
            accepted_at: new Date(),
          },
        ],
      })
    }
    if (sql.includes('FROM dashboard.request_proposals')) {
      return Promise.resolve({
        rows: [
          {
            request_id: reqId,
            revision: 2,
            form_version: APPLICATION_FORM_VERSION,
            application_team: currentRequest.answers?.applicationTeam ?? [],
            proposal_documents: [{ id: 'doc-1', filename: 'proposal.pdf' }],
            created_at: new Date(),
          },
        ],
      })
    }
    return Promise.resolve({ rows: [], rowCount: 0 })
  })

  const client = {
    query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
      if (sql.includes('SELECT nextval')) return Promise.resolve({ rows: [{ seq: '0002' }] })
      return query(sql, params)
    }),
    release: vi.fn(),
  }

  const pool = {
    query,
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as Pool

  const app = express().use(express.json())

  app.use(
    createDashboardRouter({
      pool,
      userStore,
      companyStore,
      serviceCatalog,
      verificationStore,
      privateDocumentStorage: new PrivateDocumentStorage('/tmp/unused-storage'),
      proxySecret: PROXY_SECRET,
    }),
  )

  const errorHandler = vi.fn<ErrorRequestHandler>((error, _req, res, _next) => {
    res.status(500).json({ error: (error as Error).message })
  })
  app.use(errorHandler)

  const authHeaders = {
    'x-internal-proxy-secret': PROXY_SECRET,
    'x-user-id': repId,
    'x-user-roles': role,
  }

  return {
    app,
    pool,
    client,
    query,
    reqId,
    repId,
    companyId,
    authHeaders,
    getCurrentRequest: () => currentRequest,
    setCurrentRequest: (r: any) => { currentRequest = r },
  }
}

describe('T20: Fixed form, draft saving, server validation and versioned proposal/agreements (unit)', () => {
  it('updates draft title and answers via PATCH /requests/:id', async () => {
    const { app, reqId, authHeaders } = await buildFixture()
    const payload = {
      title: 'عنوان به‌روز شده طرح',
      answers: {
        applicationTeam: [
          { name: 'علی رضایی', role: 'مدیر فنی' },
          { name: 'مریم احمدی', role: 'طراح الگوریتم' },
        ],
      },
    }

    const res = await request(app).patch(`/requests/${reqId}`).set(authHeaders).send(payload)
    expect(res.status).toBe(200)
    expect(res.body.request.title).toBe('عنوان به‌روز شده طرح')
    expect(res.body.request.answers.applicationTeam).toHaveLength(2)
  })

  it('rejects PATCH /requests/:id with 409 if request is not in draft status', async () => {
    const { app, reqId, authHeaders, setCurrentRequest, getCurrentRequest } = await buildFixture()
    setCurrentRequest({ ...getCurrentRequest(), status: 'in_review' })

    const res = await request(app).patch(`/requests/${reqId}`).set(authHeaders).send({ title: 'تغییر غیرمجاز' })
    expect(res.status).toBe(409)
    expect(res.body).toEqual({ error: 'request_not_draft' })
  })

  it('rejects PATCH /requests/:id with 400 on invalid input types', async () => {
    const { app, reqId, authHeaders } = await buildFixture()
    const resEmptyTitle = await request(app).patch(`/requests/${reqId}`).set(authHeaders).send({ title: '   ' })
    expect(resEmptyTitle.status).toBe(400)
    expect(resEmptyTitle.body).toEqual({ error: 'invalid_title' })

    const resBadAnswers = await request(app).patch(`/requests/${reqId}`).set(authHeaders).send({ answers: 'invalid' })
    expect(resBadAnswers.status).toBe(400)
    expect(resBadAnswers.body).toEqual({ error: 'invalid_answers' })
  })

  it('blocks final submission with 400 and identifies missing items when required fields/agreements absent', async () => {
    const { app, reqId, authHeaders, query } = await buildFixture()
    // Override proposal documents to empty
    query.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('FROM dashboard.requests')) {
        return Promise.resolve({
          rows: [
            {
              id: reqId,
              revision: 1,
              title: 'پیش‌نویس',
              status: 'draft',
              owner_id: 'rep-1',
              company_id: '1',
              service_id: 'srv-event',
              answers: {}, // No applicationTeam
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
      }
      if (sql.includes('FROM dashboard.request_rfps')) {
        return Promise.resolve({
          rows: [{ version_id: 'ver-1', current_rfp_version_id: 'ver-1' }],
          rowCount: 1,
        })
      }
      if (sql.includes('FROM dashboard.private_documents') && sql.includes("category = 'proposal'")) {
        return Promise.resolve({ rows: [], rowCount: 0 }) // No proposal documents
      }
      return Promise.resolve({ rows: [], rowCount: 0 })
    })

    const res = await request(app).post(`/requests/${reqId}/submit`).set(authHeaders).send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_answers')
    expect(res.body.missingFields).toContain('applicationTeam')
    expect(res.body.missingFields).toContain('proposalDocuments')
    expect(res.body.missingFields).toContain('nonCompeteAcceptance')
    expect(res.body.missingFields).toContain('eventRulesAcceptance')
  })

  it('blocks final submission if non-compete or event rules acceptance is false', async () => {
    const { app, reqId, authHeaders, query } = await buildFixture()
    query.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('FROM dashboard.requests')) {
        return Promise.resolve({
          rows: [
            {
              id: reqId,
              revision: 1,
              title: 'پیش‌نویس',
              status: 'draft',
              owner_id: 'rep-1',
              company_id: '1',
              service_id: 'srv-event',
              answers: {
                applicationTeam: [{ name: 'کارشناس', role: 'توسعه‌دهنده' }],
              },
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
      }
      if (sql.includes('FROM dashboard.request_rfps')) {
        return Promise.resolve({
          rows: [{ version_id: 'ver-1', current_rfp_version_id: 'ver-1' }],
          rowCount: 1,
        })
      }
      if (sql.includes('FROM dashboard.private_documents') && sql.includes("category = 'proposal'")) {
        return Promise.resolve({
          rows: [{ id: 'doc-1', original_filename: 'proposal.pdf' }],
          rowCount: 1,
        })
      }
      return Promise.resolve({ rows: [], rowCount: 0 })
    })

    const res = await request(app).post(`/requests/${reqId}/submit`).set(authHeaders).send({
      nonCompeteAcceptance: { accepted: false },
      eventRulesAcceptance: { accepted: true },
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_answers')
    expect(res.body.missingFields).toEqual(['nonCompeteAcceptance'])
  })

  it('submits successfully when team, proposal document and agreements are accepted', async () => {
    const { app, reqId, authHeaders, query } = await buildFixture()
    query.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('FROM dashboard.requests') && sql.includes('WHERE r.id = $1')) {
        return Promise.resolve({
          rows: [
            {
              id: reqId,
              revision: 1,
              title: 'پیش‌نویس با تیم',
              status: 'draft',
              owner_id: 'rep-1',
              company_id: '1',
              service_id: 'srv-event',
              answers: {
                applicationTeam: [{ name: 'محمد محمدی', role: 'مدیر پروژه' }],
              },
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
      }
      if (sql.includes('FROM dashboard.company_verifications')) {
        return Promise.resolve({
          rows: [
            {
              id: randomUUID(),
              company_id: '1',
              representative_id: 'rep-1',
              status: 'approved',
              revision: 1,
              snapshot: { company: { name: 'تست شرکت' } },
            },
          ],
        })
      }
      if (sql.includes('SELECT 1 FROM dashboard.request_rfps')) {
        return Promise.resolve({ rows: [{ exists: 1 }], rowCount: 1 })
      }
      if (sql.includes('FROM dashboard.private_documents') && sql.includes("category = 'proposal'")) {
        return Promise.resolve({
          rows: [{ id: 'doc-1', original_filename: 'proposal.pdf', mime_type: 'application/pdf', size_bytes: 1024, storage_key: 'k-1', logical_version: 1, created_at: new Date() }],
          rowCount: 1,
        })
      }
      if (sql.includes('UPDATE dashboard.requests') && sql.includes("SET status = 'in_review'")) {
        return Promise.resolve({
          rows: [
            {
              id: reqId,
              revision: 2,
              title: 'پیش‌نویس با تیم',
              status: 'in_review',
              owner_id: 'rep-1',
              company_id: '1',
              service_id: 'srv-event',
              service_key: 'event-application',
              service_name: 'ثبت‌نام در رویداد',
              answers: {
                applicationTeam: [{ name: 'محمد محمدی', role: 'مدیر پروژه' }],
              },
              current_step_index: 0,
              assigned_role: 'chief-reviewer',
              current_step: 'بررسی سردبیر',
              submission_date: new Date(),
              due_date: null,
              submitted_by: 'rep-1',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
      }
      if (sql.includes('INSERT INTO dashboard.request_verifications')) {
        return Promise.resolve({ rows: [] })
      }
      if (sql.includes('INSERT INTO dashboard.request_proposals')) {
        return Promise.resolve({ rows: [] })
      }
      if (sql.includes('FROM dashboard.request_rfps c')) {
        return Promise.resolve({
          rows: [{ version_id: 'ver-1', current_rfp_version_id: 'ver-1' }],
        })
      }
      if (sql.includes('INSERT INTO dashboard.request_agreements')) {
        return Promise.resolve({ rows: [] })
      }
      if (sql.includes('INSERT INTO dashboard.notification_jobs')) {
        return Promise.resolve({
          rows: [
            {
              id: 'job-1',
              request_id: reqId,
              recipient_id: 'rep-1',
              actor_id: 'rep-1',
              action: 'submit',
              from_state: 'draft',
              to_state: 'in_review',
              revision: 2,
              channel: 'in_app',
              title: 'ارسال',
              body: 'ارسال',
              status: 'pending',
              attempts: 0,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        })
      }
      return Promise.resolve({ rows: [], rowCount: 0 })
    })

    const res = await request(app).post(`/requests/${reqId}/submit`).set(authHeaders).send({
      nonCompeteAcceptance: { accepted: true, textVersionId: DEFAULT_NON_COMPETE_VERSION },
      eventRulesAcceptance: { accepted: true, textVersionId: DEFAULT_EVENT_RULES_VERSION },
    })

    expect(res.status).toBe(200)
    expect(res.body.request.status).toBe('in_review')
    expect(res.body.request.revision).toBe(2)
  })

  it('exposes GET /agreements returning default agreement versions and metadata', async () => {
    const { app, authHeaders } = await buildFixture()
    const res = await request(app).get('/agreements').set(authHeaders)
    expect(res.status).toBe(200)
    expect(res.body.agreements).toHaveLength(2)
    expect(res.body.agreements.find((a: any) => a.type === 'non_compete')).toMatchObject({
      type: 'non_compete',
      version: DEFAULT_NON_COMPETE_VERSION,
    })
    expect(res.body.agreements.find((a: any) => a.type === 'event_rules')).toMatchObject({
      type: 'event_rules',
      version: DEFAULT_EVENT_RULES_VERSION,
    })
  })

  it('exposes GET /requests/:id/proposal returning proposal snapshot and agreements', async () => {
    const { app, reqId, authHeaders } = await buildFixture()
    const res = await request(app).get(`/requests/${reqId}/proposal`).set(authHeaders)
    expect(res.status).toBe(200)
    expect(res.body.proposal).toBeDefined()
    expect(res.body.proposal.formVersion).toBe(APPLICATION_FORM_VERSION)
    expect(res.body.agreements).toHaveLength(2)
  })
})
