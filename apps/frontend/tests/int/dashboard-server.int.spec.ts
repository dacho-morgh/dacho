import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ toString: (): string => 'payload-token=valid-session' })),
}))

vi.mock('@dacho/cms-core/utilities', () => ({
  getServerSideURL: () => 'http://localhost:3000',
}))

import { extractJWT } from 'payload'
import { isSeniorManagerUser, serverDashboardFetch } from '@/utilities/dashboard-server'

describe('serverDashboardFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('preserves the same-origin context required for Payload cookie authentication', async () => {
    const profile = { company: { name: 'شرکت نمونه' } }

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const token = extractJWT({
          headers: new Headers(init?.headers),
          payload: {
            config: {
              auth: { jwtOrder: ['cookie'] },
              cookiePrefix: 'payload',
              csrf: ['http://localhost:3000'],
            },
          },
        } as never)

        return token
          ? new Response(JSON.stringify(profile), { status: 200 })
          : new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
      }),
    )

    await expect(serverDashboardFetch('/profile')).resolves.toEqual(profile)
  })
})

describe('isSeniorManagerUser', () => {
  const mockPayload = {
    findByID: vi.fn(async ({ id }: { id: number | string }) => {
      if (id === 6 || id === '6') return { id: 6, name: 'مدیر ارشد' }
      return { id, name: 'کارشناس' }
    }),
  } as never

  it('returns false when user is null or undefined', async () => {
    await expect(isSeniorManagerUser(mockPayload, null)).resolves.toBe(false)
    await expect(isSeniorManagerUser(mockPayload, undefined)).resolves.toBe(false)
  })

  it('returns true when the user holds the admin role', async () => {
    await expect(isSeniorManagerUser(mockPayload, { operationalRole: 'system-owner', isActive: true })).resolves.toBe(true)
  })

  it('returns true when admin sits alongside another role', async () => {
    await expect(
      isSeniorManagerUser(mockPayload, { operationalRole: 'system-owner', isActive: true, roles: ['representative', 'referee'] }),
    ).resolves.toBe(true)
  })

  it('returns false for a company representative', async () => {
    await expect(
      isSeniorManagerUser(mockPayload, { operationalRole: 'representative', isActive: true }),
    ).resolves.toBe(false)
  })

  it('returns false for a referee', async () => {
    await expect(isSeniorManagerUser(mockPayload, { operationalRole: 'reviewer', isActive: true })).resolves.toBe(false)
  })

  it('returns false for a user with no roles at all', async () => {
    await expect(isSeniorManagerUser(mockPayload, {})).resolves.toBe(false)
  })
})
