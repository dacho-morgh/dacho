// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const backend = vi.hoisted(() => ({
  auth: vi.fn(),
  find: vi.fn(),
  findByID: vi.fn(),
  requestHeaders: new Headers(),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => backend }))
vi.mock('next/headers', () => ({ headers: async () => backend.requestHeaders }))
const redirectTo = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectTo(url)
    throw new Error('REDIRECT')
  },
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
}))
vi.mock('@/components/dashboard/events-view', () => ({
  EventsView: ({
    initialEventsList,
    isOwner,
  }: {
    initialEventsList: { id: string }[]
    isOwner: boolean
  }) =>
    createElement(
      'div',
      null,
      `${isOwner ? 'Manage' : 'Discover'} ${initialEventsList.map((item) => item.id).join(',')}`,
    ),
}))
vi.mock('@/components/dashboard/exhibition-admin/exhibition-booth-admin', () => ({
  ExhibitionBoothAdmin: ({ exhibition }: { exhibition: { title: string } }) =>
    createElement('div', null, exhibition.title),
}))
vi.mock('@/components/dashboard/exhibition-booths/booth-requests-queue', () => ({
  BoothRequestsQueue: ({ exhibition }: { exhibition: { title: string } }) =>
    createElement('div', null, `Queue ${exhibition.title}`),
}))
vi.mock('@/components/dashboard/exhibition-booths/booth-booking', () => ({
  BoothBooking: ({ exhibition }: { exhibition: { title: string } }) =>
    createElement('div', null, `Booking ${exhibition.title}`),
}))
import ExhibitionAdminPage from '@/app/(frontend)/dashboard/exhibitions/[id]/page'
import OwnerExhibitionsPage from '@/app/(frontend)/dashboard/exhibitions/page'

beforeEach(() => {
  backend.requestHeaders = new Headers()
  backend.auth.mockResolvedValue({ user: { operationalRole: 'system-owner', isActive: true } })
  backend.find.mockResolvedValue({ docs: [{ id: 17, title: 'Exhibition' }], hasNextPage: false })
  backend.findByID.mockResolvedValue({ id: 17, title: 'Exhibition' })
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('sends the owner to the one events and exhibitions list (S5, FE40)', async () => {
  await expect(OwnerExhibitionsPage()).rejects.toThrow('REDIRECT')
  expect(redirectTo).toHaveBeenLastCalledWith('/dashboard/events?type=exhibition')
  expect(backend.find).not.toHaveBeenCalled()
})
it.each(['chief-reviewer', 'reviewer', 'investment-reviewer'])(
  'denies %s both exhibition pages',
  async (role) => {
    backend.auth.mockResolvedValue({ user: { operationalRole: role, isActive: true } })
    await expect(OwnerExhibitionsPage()).rejects.toThrow('REDIRECT')
    await expect(ExhibitionAdminPage({ params: Promise.resolve({ id: '17' }) })).rejects.toThrow(
      'REDIRECT',
    )
    expect(backend.findByID).not.toHaveBeenCalled()
  },
)
it('pads the exhibition pages 16px at the sides and 40px at the top (design QA #281)', async () => {
  backend.auth.mockResolvedValue({ user: { operationalRole: 'representative', isActive: true } })
  const detail = render(await ExhibitionAdminPage({ params: Promise.resolve({ id: '17' }) }))
  expect(detail.container.firstElementChild!.className).toMatch(/\bpx-4\b.*\bpt-10\b/)
  cleanup()
  const list = render(await OwnerExhibitionsPage())
  const main = list.container.querySelector('main')!
  expect(main.className).toMatch(/\bpx-4\b/)
  expect(main.className).toMatch(/\bpt-10\b/)
  expect(main.className).not.toMatch(/\bp-4\b/)
})
it('gives the Secretariat the booth request queue instead of booth administration', async () => {
  backend.auth.mockResolvedValue({ user: { operationalRole: 'central-secretariat', isActive: true } })
  render(await ExhibitionAdminPage({ params: Promise.resolve({ id: '17' }) }))
  expect(screen.getByText('Queue Exhibition')).toBeTruthy()
  cleanup()
  render(await OwnerExhibitionsPage())
  expect(screen.getByRole('link', { name: 'بررسی درخواست‌ها' }).getAttribute('href')).toBe(
    '/dashboard/exhibitions/17',
  )
})
it('gives a company the booth request page and lists only exhibitions that have not ended', async () => {
  backend.auth.mockResolvedValue({ user: { operationalRole: 'representative', isActive: true } })
  render(await ExhibitionAdminPage({ params: Promise.resolve({ id: '17' }) }))
  expect(screen.getByText('Booking Exhibition')).toBeTruthy()
  cleanup()
  backend.find.mockResolvedValue({
    docs: [
      { id: 17, title: 'Open', status: 'upcoming' },
      { id: 18, title: 'Ended', status: 'past' },
    ],
    hasNextPage: false,
  })
  render(await OwnerExhibitionsPage())
  expect(screen.getByText('Open')).toBeTruthy()
  expect(screen.queryByText('Ended')).toBeNull()
})
it('preserves owner cookie authentication when mobile HTTP omits browser fetch metadata', async () => {
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
  render(await ExhibitionAdminPage({ params: Promise.resolve({ id: '17' }) }))
  expect(screen.getByText('Exhibition')).toBeTruthy()
})
it('keeps CMS failure distinct from a missing exhibition', async () => {
  backend.findByID.mockRejectedValue(new Error('Database unavailable'))
  await expect(ExhibitionAdminPage({ params: Promise.resolve({ id: '17' }) })).rejects.toThrow(
    'Database unavailable',
  )
  backend.findByID.mockRejectedValue({ status: 404 })
  await expect(ExhibitionAdminPage({ params: Promise.resolve({ id: '17' }) })).rejects.toThrow(
    'NOT_FOUND',
  )
})
