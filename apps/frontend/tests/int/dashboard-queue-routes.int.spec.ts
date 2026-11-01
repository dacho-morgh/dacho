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

it('preserves the selected status across request pages and retries', async () => {
  backend.fetch.mockResolvedValue({
    kind: 'ok',
    data: { items: [], total: 100, page: 2, totalPages: 2 },
  })
  render(await RequestsPage({ searchParams: Promise.resolve({ status: 'approved', page: '2' }) }))
  expect(backend.fetch).toHaveBeenCalledWith('/requests?limit=50&page=2&status=approved')
  expect(screen.getByRole('link', { name: 'صفحه قبل' }).getAttribute('href')).toBe(
    '/dashboard/requests?status=approved',
  )
  expect(screen.queryByPlaceholderText('درخواست خود را جست و جو کنید')).toBeNull()
})

it('preserves page and status in an unavailable retry link', async () => {
  backend.fetch.mockResolvedValue({ kind: 'unavailable' })
  render(await RequestsPage({ searchParams: Promise.resolve({ status: 'approved', page: '2' }) }))
  expect(screen.getByRole('link', { name: 'تلاش دوباره' }).getAttribute('href')).toBe(
    '/dashboard/requests?status=approved&page=2',
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
      ? { id: 'reviewer-1', operationalRole: 'reviewer', isActive: true }
      : null,
  }))
  backend.fetch.mockResolvedValue({ kind: 'unavailable' })
  render(await RequestsPage({ searchParams: Promise.resolve({}) }))
  expect(screen.getByText('Internal request queue')).toBeTruthy()
  // The applicant queue stays unread; the internal list loads its own rows in the browser.
  expect(backend.fetch.mock.calls.filter(([path]) => String(path).startsWith('/requests'))).toEqual([])
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
  ['reviewer', ['', '/proposal']],
  ['employer-reviewer', ['', '/proposal']],
  ['investment-reviewer', ['', '/proposal']],
  ['chief-reviewer', ['', '/evaluations', '/proposal', '/review-round']],
  ['central-secretariat', ['', '/evaluations', '/proposal', '/review-round']],
  ['system-owner', ['', '/evaluations', '/proposal', '/review-round']],
])('reads only what %s may see on the shared dossier', async (role, reads) => {
  expect(await dossierReads(role)).toEqual(reads)
})
