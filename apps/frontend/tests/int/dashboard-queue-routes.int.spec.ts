// @vitest-environment jsdom

import { getServerSideURL } from '@dacho/cms-core/utilities'
import { cleanup, render, screen } from '@testing-library/react'
import { extractJWT } from 'payload'
import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RequestDetailPage from '@/app/(frontend)/dashboard/requests/[id]/page'
import RequestsPage from '@/app/(frontend)/dashboard/requests/page'

const backend = vi.hoisted(() => ({ fetch: vi.fn(), auth: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ host: '192.168.1.20:3000', cookie: 'payload-token=review-session' }),
  cookies: async () => ({ toString: () => 'payload-token=review-session' }),
}))
vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: async () => ({ auth: backend.auth }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('@/utilities/dashboard-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utilities/dashboard-server')>()),
  serverDashboardFetchResult: backend.fetch,
}))
vi.mock('@/components/dashboard/admin-request-list', () => ({
  AdminRequestList: () => createElement('div', null, 'Internal request queue'),
}))
vi.mock('@/components/dashboard/reviewer/reviewer-queue', () => ({
  ReviewerQueue: ({ view, page }: { view: string; page: number }) =>
    createElement('div', null, `Assigned review queue ${view} ${page}`),
}))
vi.mock('@/components/dashboard/reviewer/reviewer-case-file', () => ({
  ReviewerCaseFile: ({ initial }: { initial: { kind: string } }) =>
    createElement('div', null, `Reviewer case file ${initial.kind}`),
}))
vi.mock('@/components/dashboard/request-dossier', () => ({
  RequestDossier: ({ role }: { role: string }) => createElement('div', null, `Dossier for ${role}`),
}))

beforeEach(() => {
  backend.auth.mockResolvedValue({
    user: { id: 'representative-1', operationalRole: 'representative', isActive: true },
  })
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const companyRequest = (index: number, extra: Record<string, unknown> = {}) => ({
  id: `request-${index}`,
  trackingCode: `T-${index}`,
  title: `درخواست ${index}`,
  status: 'in_review',
  reviewStage: 'triaged',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...extra,
})

it('pages the company list by its stage filter through the API and keeps the stage on the links', async () => {
  // Page 2 of 3 of the requests in review, already filtered and paged by the API.
  const items = Array.from({ length: 50 }, (_, index) => companyRequest(50 + index))
  backend.fetch.mockImplementation(async (path: string) =>
    path.startsWith('/requests')
      ? { kind: 'ok', data: { items, total: 120, page: 2, totalPages: 3 } }
      : { kind: 'unavailable' },
  )
  render(await RequestsPage({ searchParams: Promise.resolve({ phase: 'reviewing', page: '2' }) }))
  expect(backend.fetch).toHaveBeenCalledWith('/requests?limit=50&page=2&phase=reviewing')
  // The counts read every stage, so the stage is not passed to them.
  expect(backend.fetch).toHaveBeenCalledWith('/stats')
  expect(screen.getByRole('link', { name: 'صفحه قبل' }).getAttribute('href')).toBe('/dashboard/requests?phase=reviewing')
  expect(screen.getByRole('link', { name: 'صفحه بعد' }).getAttribute('href')).toBe('/dashboard/requests?page=3&phase=reviewing')
  expect(screen.getByText('درخواست 50')).toBeTruthy()
  // The only search field is the real one: a GET form that keeps the stage (Figma placeholder, design QA #276).
  const search = screen.getByPlaceholderText('درخواست خود را جست و جو کنید')
  expect(screen.getAllByPlaceholderText('درخواست خود را جست و جو کنید')).toHaveLength(1)
  expect(search.closest('form')?.getAttribute('role')).toBe('search')
  expect(search.closest('form')?.querySelector('input[name="phase"]')?.getAttribute('value')).toBe('reviewing')
})

it('preserves page and stage in an unavailable retry link', async () => {
  backend.fetch.mockResolvedValue({ kind: 'unavailable' })
  render(await RequestsPage({ searchParams: Promise.resolve({ phase: 'finished', page: '2' }) }))
  expect(screen.getByRole('link', { name: 'تلاش دوباره' }).getAttribute('href')).toBe(
    '/dashboard/requests?page=2&phase=finished',
  )
})

it('renders a real missing dossier as not-found', async () => {
  backend.fetch.mockResolvedValue({ kind: 'unavailable', status: 404 })
  await expect(RequestDetailPage({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow(
    'NOT_FOUND',
  )
})

it('offers safe sign-in for an expired session instead of a missing dossier', async () => {
  backend.fetch.mockResolvedValue({ kind: 'unauthenticated' })
  render(await RequestDetailPage({ params: Promise.resolve({ id: 'request-1' }) }))
  expect(screen.getByRole('alert').getAttribute('data-state')).toBe('expired')
  const login = new URL(
    screen.getByRole('link', { name: 'ورود دوباره' }).getAttribute('href')!,
    'http://test.local',
  )
  expect(login.pathname).toBe('/login')
  expect(login.searchParams.get('returnUrl')).toBe('/dashboard/requests/request-1')
})

it('keeps internal authority on an HTTP mobile list navigation', async () => {
  const payload = {
    config: {
      cookiePrefix: 'payload',
      csrf: [getServerSideURL()],
      auth: { jwtOrder: ['cookie'] },
    },
  } as unknown as Parameters<typeof extractJWT>[0]['payload']
  backend.auth.mockImplementation(async ({ headers }: { headers: Headers }) => ({
    user: extractJWT({ headers, payload })
      ? { id: 'chief-1', operationalRole: 'chief-reviewer', isActive: true }
      : null,
  }))
  backend.fetch.mockResolvedValue({ kind: 'unavailable' })
  render(await RequestsPage({ searchParams: Promise.resolve({}) }))
  expect(screen.getByText('Internal request queue')).toBeTruthy()
  // The applicant queue stays unread; the internal list loads its own rows in the browser.
  expect(backend.fetch.mock.calls.filter(([path]) => String(path).startsWith('/requests'))).toEqual([])
})

it.each(['reviewer', 'employer-reviewer'])('gives %s only the assigned review queue', async (role) => {
  backend.auth.mockResolvedValue({ user: { id: 'user-1', operationalRole: role, isActive: true } })
  render(await RequestsPage({ searchParams: Promise.resolve({ view: 'closed', page: '2' }) }))
  expect(screen.getByText('Assigned review queue closed 2')).toBeTruthy()
  expect(screen.queryByText('Internal request queue')).toBeNull()
  // The queue reads `/review/queue` in the browser; the generic lists and counts stay unread.
  expect(backend.fetch).not.toHaveBeenCalled()
})

it.each([
  [{ kind: 'ok', data: { case: {} } }, 'ok'],
  [{ kind: 'unavailable', status: 404 }, 'not-assigned'],
  [{ kind: 'denied' }, 'denied'],
  [{ kind: 'unauthenticated' }, 'expired'],
  [{ kind: 'unavailable', status: 500 }, 'error'],
])('reads only the assigned case file for a reviewer (%o)', async (result, kind) => {
  for (const role of ['reviewer', 'employer-reviewer']) {
    backend.fetch.mockReset()
    backend.auth.mockResolvedValue({ user: { id: 'user-1', operationalRole: role, isActive: true } })
    backend.fetch.mockResolvedValue(result)
    render(await RequestDetailPage({ params: Promise.resolve({ id: 'request-1' }) }))
    // A 404 is a denied state for an unassigned or guessed id, never the generic not-found page.
    expect(screen.getByText(`Reviewer case file ${kind}`)).toBeTruthy()
    expect(backend.fetch.mock.calls.map(([path]) => path)).toEqual(['/review/cases/request-1'])
    cleanup()
  }
})

const dossierReads = async (role: string) => {
  backend.auth.mockResolvedValue({ user: { id: 'user-1', operationalRole: role, isActive: true } })
  backend.fetch.mockImplementation(async (path: string) =>
    path === '/requests/request-1'
      ? { kind: 'ok', data: { request: { id: 'request-1' }, timeline: [], workflow: [] } }
      : { kind: 'ok', data: {} },
  )
  render(await RequestDetailPage({ params: Promise.resolve({ id: 'request-1' }) }))
  expect(screen.getByText(`Dossier for ${role}`)).toBeTruthy()
  return backend.fetch.mock.calls.map(([path]) => String(path).replace('/requests/request-1', '')).sort()
}

it.each([
  ['representative', ['', '/proposal', '/result', '/supplementary-requests']],
  ['investment-reviewer', ['', '/proposal']],
  ['chief-reviewer', ['', '/evaluations', '/proposal', '/review-round', '/review-rounds', '/verification']],
  ['central-secretariat', ['', '/evaluations', '/proposal', '/review-round', '/review-rounds', '/verification']],
  ['system-owner', ['', '/evaluations', '/proposal', '/review-round', '/review-rounds', '/verification']],
])('reads only what %s may see on the shared dossier', async (role, reads) => {
  expect(await dossierReads(role)).toEqual(reads)
})
