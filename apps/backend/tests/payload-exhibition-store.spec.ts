import { describe, expect, it } from 'vitest'

import {
  PayloadExhibitionStore,
  PublicRecordRejected,
  fromRichText,
  toRichText,
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

describe('PayloadExhibitionStore public records (S5)', () => {
  const content = {
    title: 'نمایشگاه',
    description: 'خط اول\nخط دوم',
    location: 'بوشهر',
    startDate: '2027-03-01T08:00:00.000Z',
    endDate: '2027-03-02T16:00:00.000Z',
    status: 'upcoming' as const,
  }

  function recorder(responses: Array<{ status: number; body?: unknown }>) {
    const calls: Array<{ url: string; method?: string; headers?: Record<string, string>; body?: unknown }> = []
    const fetcher: HttpFetcher = async (url, init) => {
      calls.push({ url, method: init?.method, headers: init?.headers, body: init?.body ? JSON.parse(init.body) : undefined })
      const next = responses.shift() ?? { status: 200, body: {} }
      return { ok: next.status < 400, status: next.status, json: async () => next.body ?? {} }
    }
    return { store: new PayloadExhibitionStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher }), calls }
  }

  it('creates a record with a rich-text description through the service account', async () => {
    const { store, calls } = recorder([{ status: 201, body: { doc: { id: 12, ...content, description: toRichText(content.description), updatedAt: 't' } } }])
    const record = await store.create('exhibitions', content)
    expect(record).toEqual({ id: '12', ...content, updatedAt: 't' })
    expect(calls[0]).toMatchObject({
      url: 'http://cms:3000/api/exhibitions?depth=0',
      method: 'POST',
      headers: { Authorization: 'users API-Key KEY', 'Content-Type': 'application/json' },
    })
    expect(fromRichText((calls[0]!.body as { description: unknown }).description)).toBe('خط اول\nخط دوم')
  })

  it('updates, removes and reads records, treating 404 as gone', async () => {
    const { store, calls } = recorder([
      { status: 200, body: { doc: { id: 5, ...content } } },
      { status: 404 },
      { status: 200 },
      { status: 404 },
      { status: 404 },
    ])
    await expect(store.update('events', '5', content)).resolves.toMatchObject({ id: '5' })
    await expect(store.update('events', '6', content)).resolves.toBeUndefined()
    await store.remove('events', '5')
    await store.remove('events', '5')
    await expect(store.find('events', '7')).resolves.toBeUndefined()
    expect(calls.map((call) => `${call.method ?? 'GET'} ${call.url}`)).toEqual([
      'PATCH http://cms:3000/api/events/5?depth=0',
      'PATCH http://cms:3000/api/events/6?depth=0',
      'DELETE http://cms:3000/api/events/5',
      'DELETE http://cms:3000/api/events/5',
      'GET http://cms:3000/api/events/7?depth=0',
    ])
  })

  it('lists every page of records, or only the requested ids', async () => {
    const { store, calls } = recorder([
      { status: 200, body: { docs: [{ id: 1, ...content }], hasNextPage: true } },
      { status: 200, body: { docs: [{ id: 2, ...content }], hasNextPage: false } },
      { status: 200, body: { docs: [{ id: 3, ...content }], hasNextPage: false } },
    ])
    expect((await store.list('exhibitions')).map((record) => record.id)).toEqual(['1', '2'])
    expect((await store.list('events', ['3'])).map((record) => record.id)).toEqual(['3'])
    await expect(store.list('events', [])).resolves.toEqual([])
    expect(new URL(calls[1]!.url).searchParams.get('page')).toBe('2')
    expect(new URL(calls[2]!.url).searchParams.get('where[id][in]')).toBe('3')
    expect(calls).toHaveLength(3)
  })

  it('separates a rejected record from an unavailable CMS', async () => {
    const { store } = recorder([{ status: 400 }, { status: 503 }])
    await expect(store.create('events', content)).rejects.toBeInstanceOf(PublicRecordRejected)
    await expect(store.create('events', content)).rejects.toThrow('Payload API error: HTTP 503')
  })

  it('reads rich text written in the CMS editor as plain text', () => {
    expect(fromRichText({
      root: { children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'سلام ' }, { type: 'text', text: 'دنیا' }] },
        { type: 'paragraph', children: [{ type: 'text', text: 'الف' }, { type: 'linebreak' }, { type: 'text', text: 'ب' }] },
      ] },
    })).toBe('سلام دنیا\nالف\nب')
    expect(fromRichText(null)).toBe('')
    expect(fromRichText('ساده')).toBe('ساده')
  })
})
