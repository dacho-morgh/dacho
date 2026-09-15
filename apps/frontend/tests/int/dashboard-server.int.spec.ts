import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ toString: (): string => 'payload-token=valid-session' })),
}))

vi.mock('@dacho/cms-core/utilities', () => ({
  getServerSideURL: () => 'http://localhost:3000',
}))

import { extractJWT } from 'payload'
import { serverDashboardFetch } from '@/utilities/dashboard-server'

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
