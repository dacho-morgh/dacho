import { cleanup, render, screen } from '@testing-library/react'
// @vitest-environment jsdom
import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const backend = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), requestHeaders: new Headers() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => backend }))
vi.mock('next/headers', () => ({ headers: async () => backend.requestHeaders }))
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('REDIRECT')
  },
}))
vi.mock('@/components/dashboard/employee-list', () => ({
  EmployeeList: ({ canManage }: { canManage?: boolean }) =>
    createElement('div', null, canManage ? 'Manage personnel' : 'Read personnel'),
}))
vi.mock('@/components/dashboard/owner-events-list', () => ({
  OwnerEventsList: () => createElement('div', null, 'Manage operational events'),
}))
vi.mock('@/components/dashboard/events-view', () => ({
  EventsView: ({ initialEventsList }: { initialEventsList: { id: string }[] }) =>
    createElement('div', null, `Discover ${initialEventsList.map((item) => item.id).join(',')}`),
}))
import EmployeesPage from '@/app/(frontend)/dashboard/employees/page'
import EventsPage from '@/app/(frontend)/dashboard/events/page'

beforeEach(() => {
  backend.requestHeaders = new Headers()
  backend.find.mockResolvedValue({ docs: [{ id: 17, title: 'Public event' }] })
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('routes active owner to personnel management', async () => {
  backend.auth.mockResolvedValue({ user: { operationalRole: 'system-owner', isActive: true } })
  render(await EmployeesPage())
  expect(screen.getByText('Manage personnel')).toBeTruthy()
})
it('routes the active owner to the one events and exhibitions list (S5)', async () => {
  backend.auth.mockResolvedValue({ user: { operationalRole: 'system-owner', isActive: true } })
  render(await EventsPage())
  expect(screen.getByText('Manage operational events')).toBeTruthy()
  // The list loads its own data; the page reads nothing from the CMS for the owner.
  expect(backend.find).not.toHaveBeenCalled()
})
it('pads the company events page 16px at the sides and 40px at the top (design QA #281)', async () => {
  backend.auth.mockResolvedValue({ user: { operationalRole: 'representative', isActive: true } })
  const { container } = render(await EventsPage())
  const page = container.firstElementChild!
  expect(page.className).toContain('px-4')
  expect(page.className).toContain('pt-10')
  expect(page.className).not.toMatch(/(^|\s)(sm:|lg:)?(px|pt)-(6|8)(\s|$)/)
  expect(page.className).not.toContain('#')
})
it.each(['employees', 'events'])(
  'preserves owner cookie authentication on mobile HTTP navigation to %s',
  async (route) => {
    const { extractJWT } = await vi.importActual<typeof import('payload')>('payload')
    const payload = {
      config: {
        cookiePrefix: 'payload',
        csrf: ['http://localhost:3000'],
        auth: { jwtOrder: ['JWT', 'Bearer', 'cookie'] },
      },
    } as unknown as Parameters<typeof extractJWT>[0]['payload']
    backend.requestHeaders = new Headers({
      host: '192.168.100.14:3000',
      cookie: 'payload-token=owner-session',
    })
    backend.auth.mockImplementation(async ({ headers }: { headers: Headers }) => ({
      user:
        extractJWT({ headers, payload }) === 'owner-session'
          ? { operationalRole: 'system-owner', isActive: true }
          : null,
    }))
    render(route === 'employees' ? await EmployeesPage() : await EventsPage())
    expect(
      screen.getByText(route === 'employees' ? 'Manage personnel' : 'Manage operational events'),
    ).toBeTruthy()
    expect(backend.requestHeaders.has('sec-fetch-site')).toBe(false)
  },
)
it('keeps Secretariat personnel read-only', async () => {
  backend.auth.mockResolvedValue({
    user: { operationalRole: 'central-secretariat', isActive: true },
  })
  render(await EmployeesPage())
  expect(screen.getByText('Read personnel')).toBeTruthy()
})
it.each([
  'reviewer',
  'representative',
  'chief-reviewer',
  'investment-reviewer',
  'employer-reviewer',
])('denies %s personnel route and preserves public-event discovery', async (role) => {
  backend.auth.mockResolvedValue({ user: { operationalRole: role, isActive: true } })
  await expect(EmployeesPage()).rejects.toThrow('REDIRECT')
  render(await EventsPage())
  expect(screen.getByText('Discover events-17,exhibitions-17')).toBeTruthy()
  expect(screen.queryByText('Manage operational events')).toBeNull()
})
it.each([
  null,
  { operationalRole: 'system-owner', isActive: false },
  { operationalRole: 'system-owner', isActive: true, backendService: true },
])('never grants management to absent, inactive or service sessions: %j', async (user) => {
  backend.auth.mockResolvedValue({ user })
  await expect(EmployeesPage()).rejects.toThrow('REDIRECT')
  render(await EventsPage())
  expect(screen.queryByText('Manage operational events')).toBeNull()
})
