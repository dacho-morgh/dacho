import { describe, expect, it } from 'vitest'
import type { Pool } from 'pg'

import {
  mapRequestRow,
  RequestRepository,
  type CreateRequestInput,
  type RequestRow,
} from '../src/dashboard/request-repo.js'

describe('T19: Independent application per subtopic (unit)', () => {
  const baseRow: RequestRow = {
    id: 'req-1',
    revision: 1,
    tracking_code: 'DCH-2026-0001',
    title: 'درخواست',
    service_id: 'srv-1',
    service_key: 'event-app',
    service_name: 'خدمت رویداد',
    owner_id: 'user-1',
    company_id: 'company-1',
    status: 'draft',
    current_step_index: 0,
    assigned_role: null,
    current_step: null,
    answers: { plan: 'test' },
    submission_date: null,
    due_date: null,
    submitted_by: null,
    created_at: new Date('2026-10-29T00:00:00Z'),
    updated_at: new Date('2026-10-29T00:00:00Z'),
  }

  it('maps submittedBy from row correctly', () => {
    const unsubmitted = mapRequestRow(baseRow)
    expect(unsubmitted.submittedBy).toBeNull()

    const submitted = mapRequestRow({
      ...baseRow,
      status: 'in_review',
      submission_date: new Date('2026-10-29T12:00:00Z'),
      submitted_by: 'user-1',
    })
    expect(submitted.submittedBy).toBe('user-1')
  })

  it('detects mismatched event subtopic and throws invalid_event_subtopic', async () => {
    const mockClient = {
      query: (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
        if (sql.includes('FROM dashboard.event_subtopics')) {
          return Promise.resolve({
            rows: [{ id: 'sub-1', event_id: 'other-event', current_rfp_version_id: 'ver-1' }],
          })
        }
        return Promise.resolve({ rows: [] })
      },
      release: () => undefined,
    }
    const mockPool = {
      connect: () => Promise.resolve(mockClient),
    } as unknown as Pool

    const repo = new RequestRepository(mockPool, {} as never)
    const input: CreateRequestInput = {
      serviceId: 'srv-1',
      serviceKey: 'event-app',
      serviceName: 'خدمت رویداد',
      title: 'درخواست',
      ownerId: 'user-1',
      companyId: 'company-1',
      answers: {},
      rfp: {
        eventId: 'event-1',
        subtopicId: 'sub-1',
        versionId: 'ver-1',
      },
    }

    await expect(repo.create(input)).rejects.toThrow('invalid_event_subtopic')
  })

  it('detects missing subtopic and throws invalid_event_subtopic', async () => {
    const mockClient = {
      query: (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
        if (sql.includes('FROM dashboard.event_subtopics')) {
          return Promise.resolve({ rows: [] })
        }
        return Promise.resolve({ rows: [] })
      },
      release: () => undefined,
    }
    const mockPool = {
      connect: () => Promise.resolve(mockClient),
    } as unknown as Pool

    const repo = new RequestRepository(mockPool, {} as never)
    const input: CreateRequestInput = {
      serviceId: 'srv-1',
      serviceKey: 'event-app',
      serviceName: 'خدمت رویداد',
      title: 'درخواست',
      ownerId: 'user-1',
      companyId: 'company-1',
      answers: {},
      rfp: {
        eventId: 'event-1',
        subtopicId: 'sub-nonexistent',
        versionId: 'ver-1',
      },
    }

    await expect(repo.create(input)).rejects.toThrow('invalid_event_subtopic')
  })

  it('detects duplicate subtopic request and throws duplicate_subtopic_request', async () => {
    const mockClient = {
      query: (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
        if (sql.includes('FROM dashboard.event_subtopics')) {
          return Promise.resolve({
            rows: [{ id: 'sub-1', event_id: 'event-1', current_rfp_version_id: 'ver-1' }],
          })
        }
        if (sql.includes('FROM dashboard.request_rfps')) {
          return Promise.resolve({ rows: [{ 1: 1 }] })
        }
        return Promise.resolve({ rows: [] })
      },
      release: () => undefined,
    }
    const mockPool = {
      connect: () => Promise.resolve(mockClient),
    } as unknown as Pool

    const repo = new RequestRepository(mockPool, {} as never)
    const input: CreateRequestInput = {
      serviceId: 'srv-1',
      serviceKey: 'event-app',
      serviceName: 'خدمت رویداد',
      title: 'درخواست تکراری',
      ownerId: 'user-1',
      companyId: 'company-1',
      answers: {},
      rfp: {
        eventId: 'event-1',
        subtopicId: 'sub-1',
        versionId: 'ver-1',
      },
    }

    await expect(repo.create(input)).rejects.toThrow('duplicate_subtopic_request')
  })

  it('catches unique violation 23505 and throws duplicate_subtopic_request', async () => {
    const mockClient = {
      query: (sql: string) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return Promise.resolve({ rows: [] })
        if (sql.includes('FROM dashboard.event_subtopics')) {
          return Promise.resolve({
            rows: [{ id: 'sub-1', event_id: 'event-1', current_rfp_version_id: 'ver-1' }],
          })
        }
        if (sql.includes('FROM dashboard.request_rfps WHERE company_id')) {
          return Promise.resolve({ rows: [] })
        }
        if (sql.includes('request_tracking_code_seq')) {
          return Promise.resolve({ rows: [{ seq: '1' }] })
        }
        if (sql.includes('INSERT INTO dashboard.requests')) {
          return Promise.resolve({ rows: [baseRow] })
        }
        if (sql.includes('INSERT INTO dashboard.request_rfps')) {
          const err = new Error('duplicate key value') as Error & { code: string; constraint: string }
          err.code = '23505'
          err.constraint = 'request_rfps_company_subtopic_unique'
          return Promise.reject(err)
        }
        return Promise.resolve({ rows: [] })
      },
      release: () => undefined,
    }
    const mockPool = {
      connect: () => Promise.resolve(mockClient),
    } as unknown as Pool

    const repo = new RequestRepository(mockPool, {} as never)
    const input: CreateRequestInput = {
      serviceId: 'srv-1',
      serviceKey: 'event-app',
      serviceName: 'خدمت رویداد',
      title: 'درخواست تکراری همزمان',
      ownerId: 'user-1',
      companyId: 'company-1',
      answers: {},
      rfp: {
        eventId: 'event-1',
        subtopicId: 'sub-1',
        versionId: 'ver-1',
      },
    }

    await expect(repo.create(input)).rejects.toThrow('duplicate_subtopic_request')
  })
})
