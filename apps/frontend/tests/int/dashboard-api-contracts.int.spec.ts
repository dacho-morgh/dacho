import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => 'payload-token=test-session' }),
}))

import { mapRequestItem, REQUEST_STATUS_LABELS, type RequestDto } from '@/utilities/dashboard-api'
import { unavailableReasonFor } from '@/utilities/dashboard-fetch-result'
import { serverDashboardFetchResult } from '@/utilities/dashboard-server'
import { parseRequestStatus, REQUEST_STATUS_VALUES } from '@/components/dashboard/requests'

// FE30 — dashboard API contracts. Covers the seams every queue depends on:
// transport outcome → surface notice (denied is not empty), status filter
// validation, and DTO → row mapping. No mocks are accepted as release
// evidence; these assert the client's contract handling, not backend policy.

const dto: RequestDto = {
  id: 'req-1',
  trackingCode: 'TRK-1001',
  title: 'طرح نمونه',
  serviceId: 'svc-1',
  serviceKey: 'financing',
  serviceName: 'تأمین مالی و سرمایه‌گذاری',
  ownerId: 'user-1',
  status: 'action_needed',
  currentStepIndex: 2,
  assignedRole: 'reviewer',
  currentStep: 'بررسی کارشناس',
  answers: { plan: 'x' },
  submissionDate: '2026-09-01T00:00:00.000Z',
  dueDate: null,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  allowedActions: ['read', 'uploadDocument'],
}

function respond(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('serverDashboardFetchResult — denied vs empty vs unavailable', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns ok with the parsed payload for 200', async () => {
    fetchMock.mockResolvedValue(respond(200, { items: [dto], total: 1, page: 1, totalPages: 1 }))

    const result = await serverDashboardFetchResult<{ items: RequestDto[] }>('/requests?limit=10')

    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') expect(result.data.items).toHaveLength(1)
  })

  it('distinguishes a missing session (401) from an empty list', async () => {
    fetchMock.mockResolvedValue(respond(401, { error: 'unauthenticated' }))
    expect((await serverDashboardFetchResult('/requests')).kind).toBe('unauthenticated')
  })

  it('distinguishes a denied read (403) from an empty list', async () => {
    fetchMock.mockResolvedValue(respond(403, { error: 'forbidden' }))
    expect((await serverDashboardFetchResult('/requests')).kind).toBe('denied')
  })

  it('treats 404 and 5xx as unavailable rather than "no records"', async () => {
    fetchMock.mockResolvedValueOnce(respond(404, { error: 'not_found' }))
    expect((await serverDashboardFetchResult('/requests/missing')).kind).toBe('unavailable')

    fetchMock.mockResolvedValueOnce(respond(500, { error: 'boom' }))
    expect((await serverDashboardFetchResult('/stats')).kind).toBe('unavailable')
  })

  it('maps a transport failure to unavailable without throwing', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    expect((await serverDashboardFetchResult('/activities')).kind).toBe('unavailable')
  })

  it('forwards the session cookie and disables caching', async () => {
    fetchMock.mockResolvedValue(respond(200, {}))
    await serverDashboardFetchResult('/stats')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect(init.headers.cookie).toBe('payload-token=test-session')
    expect(init.headers['sec-fetch-site']).toBe('same-origin')
    expect(init.cache).toBe('no-store')
  })
})

describe('unavailableReasonFor', () => {
  it('keeps every failure kind distinct and silences success', () => {
    expect(unavailableReasonFor({ kind: 'ok', data: {} })).toBeUndefined()
    expect(unavailableReasonFor({ kind: 'unauthenticated' })).toBe('expired')
    expect(unavailableReasonFor({ kind: 'denied' })).toBe('denied')
    expect(unavailableReasonFor({ kind: 'unavailable' })).toBe('unavailable')
  })
})

describe('parseRequestStatus — queue filter contract', () => {
  it('accepts exactly the statuses the API and labels know', () => {
    expect(new Set(REQUEST_STATUS_VALUES)).toEqual(new Set(Object.keys(REQUEST_STATUS_LABELS)))
    for (const status of REQUEST_STATUS_VALUES) {
      expect(parseRequestStatus(status)).toBe(status)
    }
  })

  it('ignores unknown, repeated or non-string query values', () => {
    expect(parseRequestStatus('deleted')).toBeUndefined()
    expect(parseRequestStatus('')).toBeUndefined()
    expect(parseRequestStatus(undefined)).toBeUndefined()
    expect(parseRequestStatus(['in_review', 'approved'])).toBeUndefined()
  })
})

describe('mapRequestItem', () => {
  it('carries the tracking code, current stage and permitted actions to the row', () => {
    const item = mapRequestItem(dto)

    expect(item.trackingCode).toBe('TRK-1001')
    expect(item.currentStep).toBe('بررسی کارشناس')
    expect(item.allowedActions).toEqual(['read', 'uploadDocument'])
    expect(item.statusLabel).toBe(REQUEST_STATUS_LABELS.action_needed)
  })

  it('defaults a missing stage/actions without inventing permissions', () => {
    const item = mapRequestItem({
      ...dto,
      currentStep: null,
      allowedActions: undefined,
    })

    expect(item.currentStep).toBe('')
    expect(item.allowedActions).toEqual([])
    expect(item.dueDate).toBe('')
  })
})
