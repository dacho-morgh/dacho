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
vi.mock('next/navigation', () => ({
  redirect: () => {
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

it('keeps owner booth navigation independent of the operational events workspace and paginates CMS data', async () => {
  backend.find
    .mockResolvedValueOnce({ docs: [{ id: 17, title: 'First' }], hasNextPage: true })
    .mockResolvedValueOnce({ docs: [{ id: 18, title: 'Last' }], hasNextPage: false })
  render(await OwnerExhibitionsPage())
  expect(screen.getByText('Manage exhibitions-17,exhibitions-18')).toBeTruthy()
  expect(backend.find).toHaveBeenCalledTimes(2)
  expect(
    screen.getByRole('link', { name: 'مدیریت اطلاعات نمایشگاه در CMS' }).getAttribute('href'),
  ).toBe('/admin/collections/exhibitions')
})
it.each(['representative', 'chief-reviewer', 'central-secretariat'])(
  'denies %s both exhibition administration pages',
  async (role) => {
    backend.auth.mockResolvedValue({ user: { operationalRole: role, isActive: true } })
    await expect(OwnerExhibitionsPage()).rejects.toThrow('REDIRECT')
    await expect(ExhibitionAdminPage({ params: Promise.resolve({ id: '17' }) })).rejects.toThrow(
      'REDIRECT',
    )
    expect(backend.findByID).not.toHaveBeenCalled()
  },
)
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
