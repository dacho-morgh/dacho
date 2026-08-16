import { describe, expect, it } from 'vitest'

import { PayloadUserStore, type HttpFetcher } from '../src/auth/payload-user-store.js'

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
      url.includes('where[phone]')
        ? { status: 200, body: { docs: [{ id: 'u1', phone: '0912', name: 'Ali' }] } }
        : { status: 404, body: {} },
    )
    const store = new PayloadUserStore({ baseUrl: 'http://cms:3000/', apiKey: 'KEY', fetcher })

    const user = await store.findOrCreateByPhone('0912')

    expect(user).toEqual({ id: 'u1', phone: '0912', name: 'Ali' })
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('creates a user when none exists for the phone', async () => {
    const { fetcher, calls } = mockFetcher((url, init) => {
      if (url.includes('where[phone]')) return { status: 200, body: { docs: [] } }
      if (init?.method === 'POST') return { status: 200, body: { doc: { id: 'u2', phone: '0912' } } }
      return { status: 404, body: {} }
    })
    const store = new PayloadUserStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    const user = await store.findOrCreateByPhone('0912')

    expect(user.id).toBe('u2')
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.url).toBe('http://cms:3000/api/users')
    expect(JSON.parse(post.body!)).toEqual({ phone: '0912' })
  })

  it('authenticates with the users API key', async () => {
    const { fetcher, calls } = mockFetcher((url) =>
      url.includes('where[phone]')
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
        ? { status: 200, body: { doc: { id: 'u1', phone: '0912', name: 'Ali', companyId: 'c1' } } }
        : { status: 404, body: {} },
    )
    const store = new PayloadUserStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    const user = await store.update('u1', { name: 'Ali', companyId: 'c1' })

    expect(user.name).toBe('Ali')
    expect(user.companyId).toBe('c1')
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.url).toBe('http://cms:3000/api/users/u1')
    expect(JSON.parse(patch.body!)).toEqual({ name: 'Ali', companyId: 'c1' })
  })
})
