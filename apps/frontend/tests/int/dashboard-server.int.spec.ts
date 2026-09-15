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

  it('returns true when user has cmsRole admin', async () => {
    await expect(isSeniorManagerUser(mockPayload, { cmsRole: 'admin' })).resolves.toBe(true)
  })

  it('returns true when user position is مدیر ارشد', async () => {
    await expect(isSeniorManagerUser(mockPayload, { position: 'مدیر ارشد' })).resolves.toBe(true)
  })

  it('returns true when user has role staff', async () => {
    await expect(isSeniorManagerUser(mockPayload, { role: 'staff' })).resolves.toBe(true)
  })

  it('returns true when user.roles contains a role object with name مدیر ارشد', async () => {
    await expect(
      isSeniorManagerUser(mockPayload, {
        role: 'applicant',
        roles: [{ id: 6, name: 'مدیر ارشد' }],
      }),
    ).resolves.toBe(true)
  })

  it('returns true when user.roles contains role id referencing مدیر ارشد', async () => {
    await expect(
      isSeniorManagerUser(mockPayload, {
        role: 'applicant',
        roles: [6],
      }),
    ).resolves.toBe(true)
  })

  it('returns false for regular applicant without senior manager role', async () => {
    await expect(
      isSeniorManagerUser(mockPayload, {
        role: 'applicant',
        roles: [1],
      }),
    ).resolves.toBe(false)
  })
})
