import { describe, expect, it } from 'vitest'

import { PayloadServiceCatalog, type HttpFetcher } from '../src/catalog/payload-service-catalog.js'

interface Call {
  url: string
  headers?: Record<string, string>
}

function mockFetcher(handler: (url: string) => { status: number; body: unknown }) {
  const calls: Call[] = []
  const fetcher: HttpFetcher = async (url, init) => {
    calls.push({ url, headers: init?.headers })
    const r = handler(url)
    return { ok: r.status < 400, status: r.status, json: async () => r.body }
  }
  return { fetcher, calls }
}

const serviceDoc = {
  doc: {
    id: 7,
    key: 'financing',
    title: 'تأمین مالی و سرمایه‌گذاری',
    workflow: [{ title: 'بررسی اولیه', role: { id: 12, name: 'داور' }, order: 0 }],
    form: {
      id: 'form-1',
      fields: [
        { blockType: 'text', name: 'company_name', label: 'نام شرکت', required: true },
        { blockType: 'number', name: 'amount', required: false },
      ],
    },
  },
}

describe('PayloadServiceCatalog', () => {
  it('maps a service doc to a ServiceDefinition (workflow + form fields)', async () => {
    const { fetcher, calls } = mockFetcher(() => ({ status: 200, body: serviceDoc }))
    const catalog = new PayloadServiceCatalog({ baseUrl: 'http://cms:3000/', apiKey: 'KEY', fetcher })

    const service = await catalog.findById('7')

    expect(service).toEqual({
      id: '7',
      key: 'financing',
      title: 'تأمین مالی و سرمایه‌گذاری',
      workflow: [{ title: 'بررسی اولیه', role: '12', roleName: 'داور', order: 0 }],
      formFields: [
        { name: 'company_name', blockType: 'text', label: 'نام شرکت', required: true },
        { name: 'amount', blockType: 'number', required: false },
      ],
    })
    expect(calls[0]?.url).toBe('http://cms:3000/api/services/7?depth=2')
  })

  it('returns undefined on 404', async () => {
    const { fetcher } = mockFetcher(() => ({ status: 404, body: {} }))
    const catalog = new PayloadServiceCatalog({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    await expect(catalog.findById('missing')).resolves.toBeUndefined()
  })

  it('authenticates with the services API key', async () => {
    const { fetcher, calls } = mockFetcher(() => ({ status: 200, body: serviceDoc }))
    const catalog = new PayloadServiceCatalog({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    await catalog.findById('7')

    expect(calls[0]?.headers?.Authorization).toBe('API-Key KEY')
  })

  it('treats a null form and empty workflow as empty definitions', async () => {
    const { fetcher } = mockFetcher(() => ({
      status: 200,
      body: { doc: { id: 8, key: 'events', title: 'رویدادها', workflow: null, form: null } },
    }))
    const catalog = new PayloadServiceCatalog({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    const service = await catalog.findById('8')

    expect(service?.workflow).toEqual([])
    expect(service?.formFields).toBeNull()
  })
})
