import { describe, expect, it } from 'vitest'

import { PayloadCompanyStore, type HttpFetcher } from '../src/auth/company-store.js'

interface Call {
  url: string
  method: string
  body?: string
}

function mockFetcher(handler: (url: string, init?: { method?: string; body?: string }) => { status: number; body: unknown }) {
  const calls: Call[] = []
  const fetcher: HttpFetcher = async (url, init) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body })
    const result = handler(url, init)
    return { ok: result.status < 400, status: result.status, json: async () => result.body }
  }
  return { fetcher, calls }
}

const storedDoc = {
  id: 7,
  name: 'شرکت فناور',
  nationalId: '14000000000',
  registrationNumber: '12345',
  legalEntityType: 'سهامی خاص',
  knowledgeBasedStatus: 'دانش‌بنیان نوع یک',
  classification: 'فناوری اطلاعات',
  foundingYear: '1398',
  activityDomain: 'نرم‌افزار',
  website: 'https://example.invalid',
  centerEstablishment: 'پارک علم و فناوری',
  insuredEmployeeCount: 12,
  executives: [{ id: 'e1', position: 'مدیرعامل', name: 'نام مدیر' }],
  addresses: [{ id: 'a1', title: 'دفتر', province: 'بوشهر', city: 'بوشهر', postalCode: '7514', address: 'نشانی' }],
  productsServices: [{ id: 'p1', title: 'سامانه ابری' }],
  keyMembers: [{ id: 'k1', name: 'نام عضو', role: 'فنی' }],
  pastProjectsCustomers: [{ id: 'j1', project: 'پروژه الف', customer: 'مشتری الف', summary: 'خلاصه' }],
  requestedServices: [{ id: 's1', service: 'financing' }],
  certificatesLicenses: [{ id: 'c1', title: 'ISO', issuer: 'مرجع', reference: 'IR-1' }],
  notAvailable: ['website', 'pastProjectsCustomers'],
}

describe('PayloadCompanyStore', () => {
  it('writes addresses, executives and every stage-2 array instead of dropping them', async () => {
    const { fetcher, calls } = mockFetcher(() => ({ status: 200, body: { doc: storedDoc } }))
    const store = new PayloadCompanyStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    await store.update('7', {
      executives: [{ position: 'مدیرعامل', name: 'نام مدیر' }],
      addresses: [{ id: 'a1', title: 'دفتر', province: 'بوشهر', city: 'بوشهر', postalCode: '7514', address: 'نشانی' }],
      legalEntityType: 'سهامی خاص',
      knowledgeBasedStatus: 'دانش‌بنیان نوع یک',
      classification: 'فناوری اطلاعات',
      foundingYear: '1398',
      activityDomain: 'نرم‌افزار',
      website: 'https://example.invalid',
      centerEstablishment: 'پارک علم و فناوری',
      insuredEmployeeCount: 12,
      productsServices: ['سامانه ابری'],
      keyMembers: [{ name: 'نام عضو', role: 'فنی' }],
      pastProjectsCustomers: [{ project: 'پروژه الف', customer: 'مشتری الف', summary: 'خلاصه' }],
      requestedServices: ['financing'],
      certificatesLicenses: [{ title: 'ISO', issuer: 'مرجع', reference: 'IR-1' }],
      notAvailable: ['website', 'pastProjectsCustomers'],
    })

    const patch = calls.find((call) => call.method === 'PATCH')!
    expect(patch.url).toBe('http://cms:3000/api/companies/7')
    const body = JSON.parse(patch.body!)
    expect(body.executives).toEqual([{ position: 'مدیرعامل', name: 'نام مدیر' }])
    expect(body.addresses).toEqual([expect.objectContaining({ title: 'دفتر', address: 'نشانی' })])
    expect(body.legalEntityType).toBe('سهامی خاص')
    expect(body.knowledgeBasedStatus).toBe('دانش‌بنیان نوع یک')
    expect(body.insuredEmployeeCount).toBe(12)
    expect(body.productsServices).toEqual([{ title: 'سامانه ابری' }])
    expect(body.keyMembers).toEqual([{ name: 'نام عضو', role: 'فنی' }])
    expect(body.pastProjectsCustomers).toEqual([
      { project: 'پروژه الف', customer: 'مشتری الف', summary: 'خلاصه' },
    ])
    expect(body.requestedServices).toEqual([{ service: 'financing' }])
    expect(body.certificatesLicenses).toEqual([{ title: 'ISO', issuer: 'مرجع', reference: 'IR-1' }])
    expect(body.notAvailable).toEqual(['website', 'pastProjectsCustomers'])
  })

  it('reloads arrays, absence answers and the scalar dossier from Payload', async () => {
    const { fetcher } = mockFetcher(() => ({ status: 200, body: { doc: storedDoc } }))
    const store = new PayloadCompanyStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    const company = await store.findById('7')

    expect(company).toMatchObject({
      legalEntityType: 'سهامی خاص',
      knowledgeBasedStatus: 'دانش‌بنیان نوع یک',
      classification: 'فناوری اطلاعات',
      foundingYear: '1398',
      activityDomain: 'نرم‌افزار',
      website: 'https://example.invalid',
      centerEstablishment: 'پارک علم و فناوری',
      insuredEmployeeCount: 12,
      productsServices: ['سامانه ابری'],
      keyMembers: [{ id: 'k1', name: 'نام عضو', role: 'فنی' }],
      requestedServices: ['financing'],
      notAvailable: ['website', 'pastProjectsCustomers'],
    })
    expect(company?.executives).toHaveLength(1)
    expect(company?.addresses).toHaveLength(1)
    expect(company?.pastProjectsCustomers).toHaveLength(1)
    expect(company?.certificatesLicenses).toHaveLength(1)
  })

  it('keeps partial updates partial and forwards explicit empty arrays', async () => {
    const { fetcher, calls } = mockFetcher(() => ({ status: 200, body: { doc: storedDoc } }))
    const store = new PayloadCompanyStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    await store.update('7', { status: 'فعال' })
    const partial = JSON.parse(calls[0]!.body!)
    expect(partial).toEqual({ status: 'فعال' })

    await store.update('7', { addresses: [], executives: [], productsServices: [] })
    const cleared = JSON.parse(calls[1]!.body!)
    expect(cleared).toEqual({ addresses: [], executives: [], productsServices: [] })
  })

  it('creates a company with the dossier arrays through the real adapter', async () => {
    const { fetcher, calls } = mockFetcher(() => ({ status: 201, body: { doc: storedDoc } }))
    const store = new PayloadCompanyStore({ baseUrl: 'http://cms:3000', apiKey: 'KEY', fetcher })

    await store.create({
      name: 'شرکت فناور',
      nationalId: '14000000000',
      representativeId: '42',
      keyMembers: [{ name: 'نام عضو', role: 'فنی' }],
      requestedServices: ['financing'],
    })

    const create = calls.find((call) => call.method === 'POST')!
    const body = JSON.parse(create.body!)
    expect(body.representative).toBe(42)
    expect(body.keyMembers).toEqual([{ name: 'نام عضو', role: 'فنی' }])
    expect(body.requestedServices).toEqual([{ service: 'financing' }])
  })
})
