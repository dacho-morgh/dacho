import { describe, expect, it } from 'vitest'

import {
  PayloadExhibitionStore,
  type HttpFetcher,
} from '../src/exhibitions/exhibition-store.js'

function mockFetcher(status: number, body: unknown = {}) {
  const calls: { url: string; headers?: Record<string, string> }[] = []
  const fetcher: HttpFetcher = async (url, init) => {
    calls.push({ url, headers: init?.headers })
    return { ok: status < 400, status, json: async () => body }
  }
  return { fetcher, calls }
}

describe('PayloadExhibitionStore', () => {
  it('reports an existing exhibition through the CMS API', async () => {
    const { fetcher, calls } = mockFetcher(200, { id: 'exhibition-1' })
    const store = new PayloadExhibitionStore({
      baseUrl: 'http://cms:3000/',
      apiKey: 'KEY',
      fetcher,
    })

    await expect(store.exists('exhibition-1')).resolves.toBe(true)
    expect(calls[0]).toEqual({
      url: 'http://cms:3000/api/exhibitions/exhibition-1?depth=0',
      headers: { Authorization: 'users API-Key KEY' },
    })
  })

  it('reports a missing exhibition on 404', async () => {
    const { fetcher } = mockFetcher(404)
    const store = new PayloadExhibitionStore({
      baseUrl: 'http://cms:3000',
      apiKey: 'KEY',
      fetcher,
    })

    await expect(store.exists('missing')).resolves.toBe(false)
  })

  it('rejects on a CMS error response', async () => {
    const { fetcher } = mockFetcher(500)
    const store = new PayloadExhibitionStore({
      baseUrl: 'http://cms:3000',
      apiKey: 'KEY',
      fetcher,
    })

    await expect(store.exists('exhibition-1')).rejects.toThrow(
      'Payload API error: HTTP 500',
    )
  })
})
