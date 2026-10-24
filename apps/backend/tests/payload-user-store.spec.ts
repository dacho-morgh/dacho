import { describe, expect, it } from 'vitest'

import { PayloadUserStore, type HttpFetcher } from '../src/auth/payload-user-store.js'
import { USER_ROLES } from '../src/auth/user-store.js'

interface Call {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
}

function mockFetcher(handler: (url: string, init?: { method?: string }) => { status: number; body: unknown }) {
  const calls: Call[] = []
  const fetcher: HttpFetcher = async (url, init) => {
    calls.push({ url, method: init?.method ?? 'GET', headers: init?.headers, body: init?.body })
    const r = handler(url, init)
    return { ok: r.status < 400, status: r.status, json: async () => r.body }
  }
  return { fetcher, calls }
}

describe('PayloadUserStore', () => {
  it('finds an existing user by phone without creating', async () => {
    const { fetcher, calls } = mockFetcher((url) =>
      url.includes('where%5Bphone%5D')
        ? { status: 200, body: { docs: [{ id: 'u1', phone: '0912', name: 'Ali' }] } }
        : { status: 404, body: {} },
    )
    const store = new PayloadUserStore({ baseUrl: 'http://cms:3000/', apiKey: 'KEY', fetcher })

    const user = await store.findOrCreateByPhone('0912')

    expect(user).toMatchObject({ id: 'u1', phone: '0912', name: 'Ali', isActive: false, roles: [] })
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('creates a user when none exists for the phone', async () => {
    const { fetcher, calls } = mockFetcher((url, init) => {
      if (url.includes('where%5Bphone%5D')) return { status: 200, body: { docs: [] } }
      if (init?.method === 'POST') return { status: 200, body: { doc: { id: 'u2', phone: '0912' } } }
      return { status: 404, body: {} }
    })
    const store = new PayloadUserStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    const user = await store.findOrCreateByPhone('0912')

    expect(user.id).toBe('u2')
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url).toBe('http://cms:3000/api/users')
    const body = JSON.parse(post.body!)
    expect(body.phone).toBe('0912')
    expect(body.email).toBe('0912@dacho.local')
    expect(body.password).toBeTruthy() // placeholders Payload requires
  })

  it('authenticates with the users API key', async () => {
    const { fetcher, calls } = mockFetcher((url) =>
      url.includes('where%5Bphone%5D')
        ? { status: 200, body: { docs: [{ id: 'u', phone: '0912' }] } }
        : { status: 404, body: {} },
    )
    const store = new PayloadUserStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    await store.findOrCreateByPhone('0912')

    for (const call of calls) {
      expect(call.headers?.Authorization).toBe('users API-Key KEY')
    }
  })

  it('findById returns undefined on 404', async () => {
    const { fetcher } = mockFetcher(() => ({ status: 404, body: {} }))
    const store = new PayloadUserStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    await expect(store.findById('missing')).resolves.toBeUndefined()
  })

  it('update sends a PATCH and returns the updated user', async () => {
    const { fetcher, calls } = mockFetcher((_url, init) =>
      init?.method === 'PATCH'
        ? { status: 200, body: { doc: { id: 'u1', phone: '0912', name: 'Ali', operationalRole: 'representative', isActive: true, roles: ['admin'] } } }
        : { status: 404, body: {} },
    )
    const store = new PayloadUserStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    const user = await store.update('u1', { name: 'Ali' })

    expect(user.name).toBe('Ali')
    expect(user.roles).toEqual(['representative'])
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.url).toBe('http://cms:3000/api/users/backend-profile/u1')
    expect(JSON.parse(patch.body!)).toEqual({ name: 'Ali' })
  })

  it('derives roles from the active scalar role, ignoring legacy/client arrays', async () => {
    const { fetcher } = mockFetcher(() => ({
      status: 200,
      body: { doc: { id: 'u1', phone: '0912', operationalRole: 'reviewer', isActive: true, roles: ['admin', 'representative'] } },
    }))
    const store = new PayloadUserStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    const user = await store.findById('u1')

    expect(user?.roles).toEqual(['referee'])
  })

  it('removes all transport authority from inactive accounts', async () => {
    const { fetcher } = mockFetcher(() => ({ status: 200, body: { id: 'u', phone: '0912', operationalRole: 'system-owner', isActive: false, roles: ['admin'] } }))
    const user = await new PayloadUserStore({ baseUrl: 'http://cms', apiKey: 'KEY', fetcher }).findById('u')
    expect(user?.roles).toEqual([])
  })

  // The backend keeps its own copy of USER_ROLES because it cannot import the
  // CMS's runtime config. If cms-core issues a role this list lacks, the Next.js
  // proxy would silently drop it from `x-user-roles` and the backend would treat
  // the holder as role-less — so pin the two lists to the same values.
  it('accepts every role the CMS can issue', () => {
    expect(USER_ROLES).toEqual(['admin', 'editor', 'representative', 'referee'])
  })

  it('lists by role using an array-containment query', async () => {
    const { fetcher, calls } = mockFetcher(() => ({ status: 200, body: { docs: [] } }))
    const store = new PayloadUserStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    await store.list({ role: 'representative' })

    expect(decodeURIComponent(calls[0]?.url ?? '')).toContain(
      'where[roles][contains]=representative',
    )
  })
})
