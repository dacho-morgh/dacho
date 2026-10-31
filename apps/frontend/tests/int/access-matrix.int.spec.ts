import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { getPayload, handleEndpoints, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { GET as proxyGet, POST as proxyPost } from '@/app/(frontend)/api/dashboard/[...path]/route'
import { POST as graphqlPost } from '@/app/(payload)/api/graphql/route'
import config from '@/payload.config'

// T42: seven roles against their own company, another company and a company they hold
// nothing on, through the CMS and the same-origin proxy. Expected audiences are written
// out from docs/system/permission-matrix.md. The backend half is
// apps/backend/tests/int/access-matrix.int.spec.ts.

const ROLES = ['owner', 'secretariat', 'chief', 'reviewer', 'employer', 'investment', 'company'] as const
type Role = (typeof ROLES)[number]
type Seat = Role | 'otherCompany' | 'noCompany' | 'editor' | 'inactive' | 'service'

const OPERATIONAL: Record<Seat, string> = {
  owner: 'system-owner',
  secretariat: 'central-secretariat',
  chief: 'chief-reviewer',
  reviewer: 'reviewer',
  employer: 'employer-reviewer',
  investment: 'investment-reviewer',
  company: 'representative',
  otherCompany: 'representative',
  noCompany: 'representative',
  editor: 'representative',
  inactive: 'system-owner',
  service: 'system-owner',
}

const SEATS = Object.keys(OPERATIONAL) as Seat[]
const FUND_WIDE: readonly Seat[] = ['owner', 'secretariat']

const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
const keys = Object.fromEntries(SEATS.map((seat) => [seat, randomUUID()])) as Record<Seat, string>
const ids = {} as Record<Seat, number>
const company = {} as Record<'own' | 'other', number>
const PRIVATE_FIELD = `t42-economic-${suffix}`
const PROXY_SECRET = 't42-proxy-secret'

let payload: Payload

const rest = (path: string, seat?: Seat, method = 'GET', body?: unknown) =>
  handleEndpoints({
    config,
    request: new Request(`http://localhost/api/${path}`, {
      method,
      headers: {
        ...(seat ? { Authorization: `users API-Key ${keys[seat]}` } : {}),
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  })

// GraphQL is disabled in the Payload config, so the real route answers 404 with no body
// for everyone, before it reads the query or builds a schema.
const expectGraphqlClosed = async (query: string, seat?: Seat) => {
  const res = await graphqlPost(
    new Request('http://localhost/api/graphql', {
      method: 'POST',
      headers: {
        ...(seat ? { Authorization: `users API-Key ${keys[seat]}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }),
  )
  expect(res.status, String(seat)).toBe(404)
  expect(await res.text(), String(seat)).toBe('')
}

const docIds = async (res: Response) => ((await res.json()) as { docs: { id: number }[] }).docs.map((doc) => doc.id)

/** A read `access: false` answers 403 and a query constraint gives an empty page; both hold nothing. */
const listedIds = async (res: Response): Promise<number[]> => (res.status === 403 ? [] : docIds(res))

const readOwn = (seat: Seat) => FUND_WIDE.includes(seat) || seat === 'company'
const readOther = (seat: Seat) => FUND_WIDE.includes(seat) || seat === 'otherCompany'

describe('T42: seven-role CMS and proxy access (int)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config })
    for (const [index, seat] of SEATS.entries()) {
      const user = await payload.create({
        collection: 'users',
        data: {
          email: `t42-${seat}-${suffix}@example.invalid`,
          phone: `09919100${String(index).padStart(3, '0')}`,
          password: 't42-synthetic-password',
          name: `T42 ${seat}`,
          operationalRole: OPERATIONAL[seat] as never,
          contentEditor: seat === 'editor',
          backendService: seat === 'service',
          isActive: seat !== 'inactive',
          enableAPIKey: true,
          apiKey: keys[seat],
        },
        context: { allowPersonnelProvisioning: true },
      })
      ids[seat] = user.id
    }
    for (const [name, representative] of [['own', ids.company], ['other', ids.otherCompany]] as const) {
      const created = await payload.create({
        collection: 'companies',
        data: {
          name: `T42 company ${name} ${suffix}`,
          nationalId: `t42-nid-${name}-${suffix}`,
          representative,
          economicCode: PRIVATE_FIELD,
        },
      })
      company[name] = created.id
    }
  }, 60_000)

  afterAll(async () => {
    for (const id of Object.values(company)) await payload.delete({ collection: 'companies', id })
    for (const id of Object.values(ids)) await payload.delete({ collection: 'users', id })
  })

  describe('CMS company dossier', () => {
    for (const seat of SEATS.filter((item) => item !== 'inactive' && item !== 'service')) {
      it(`${seat}: REST detail follows ownership`, async () => {
        for (const [target, allowed] of [[company.own, readOwn(seat)], [company.other, readOther(seat)]] as const) {
          const res = await rest(`companies/${target}?depth=4`, seat)
          if (allowed) expect(res.status, String(target)).toBe(200)
          else expect([403, 404], String(target)).toContain(res.status)
          const text = await res.text()
          if (allowed) expect(text).toContain(PRIVATE_FIELD)
          else expect(text).not.toContain(PRIVATE_FIELD)
        }
      })

      it(`${seat}: REST list holds the same records`, async () => {
        const listed = await listedIds(await rest('companies?depth=0&limit=1000', seat))
        expect(listed.includes(company.own)).toBe(readOwn(seat))
        expect(listed.includes(company.other)).toBe(readOther(seat))
      })

      it(`${seat}: GraphQL is closed`, async () => {
        await expectGraphqlClosed(`{ Company(id: ${company.own}) { id economicCode } }`, seat)
        await expectGraphqlClosed('{ Companies(limit: 1000) { docs { id } } }', seat)
      })

      it(`${seat}: Local API acting for the user holds the same records`, async () => {
        const user = await payload.findByID({ collection: 'users', id: ids[seat] })
        const found = await payload
          .find({ collection: 'companies', user, overrideAccess: false, depth: 0, limit: 1000 })
          .catch(() => ({ docs: [] as { id: number }[] }))
        const listed: number[] = found.docs.map((doc) => doc.id)
        expect(listed.includes(company.own)).toBe(readOwn(seat))
        expect(listed.includes(company.other)).toBe(readOther(seat))
      })
    }

    it('gives an anonymous caller and a deactivated account nothing', async () => {
      for (const seat of [undefined, 'inactive'] as const) {
        expect((await rest(`companies/${company.own}`, seat)).status, String(seat)).not.toBe(200)
        expect(await listedIds(await rest('companies?depth=0&limit=1000', seat))).toEqual([])
        await expectGraphqlClosed(`{ Company(id: ${company.own}) { id } }`, seat)
      }
    })

    it('populates no credential or personnel history at any depth', async () => {
      for (const seat of ['owner', 'secretariat', 'company'] as const) {
        const text = await (await rest(`companies/${company.own}?depth=4`, seat)).text()
        expect(text).not.toContain(keys.company)
        expect(text).not.toContain('"hash"')
        expect(text).not.toContain('"salt"')
      }
      const secretariat = await (await rest(`companies/${company.own}?depth=4`, 'secretariat')).text()
      expect(secretariat).not.toContain('personnelHistory')
    })

    it('refuses company writes outside the owner and the company itself', async () => {
      for (const seat of ['secretariat', 'chief', 'reviewer', 'employer', 'investment', 'otherCompany', 'noCompany', 'editor'] as const) {
        const patched = await rest(`companies/${company.own}`, seat, 'PATCH', { economicCode: 'tampered' })
        expect([403, 404], seat).toContain(patched.status)
        const deleted = await rest(`companies/${company.own}`, seat, 'DELETE')
        expect([403, 404], seat).toContain(deleted.status)
        const created = await rest('companies', seat, 'POST', { name: 'جعلی', nationalId: `t42-fake-${seat}-${suffix}`, representative: ids[seat] })
        if (seat !== 'noCompany') expect([400, 403], seat).toContain(created.status)
        else if (created.status === 201) {
          const body = (await created.json()) as { doc: { id: number } }
          await payload.delete({ collection: 'companies', id: body.doc.id })
        }
      }
      const unchanged = await payload.findByID({ collection: 'companies', id: company.own, depth: 0 })
      expect(unchanged.economicCode).toBe(PRIVATE_FIELD)
    })

    it('keeps identity fields and the representative away from the company itself', async () => {
      const before = await payload.findByID({ collection: 'companies', id: company.own, depth: 0 })
      await rest(`companies/${company.own}`, 'company', 'PATCH', {
        nationalId: 'tampered-national-id',
        representative: ids.otherCompany,
      })
      const after = await payload.findByID({ collection: 'companies', id: company.own, depth: 0 })
      expect(after.nationalId).toBe(before.nationalId)
      expect(after.representative).toBe(before.representative)
    })
  })

  describe('CMS people', () => {
    for (const role of ROLES) {
      it(`${role}: lists ${FUND_WIDE.includes(role) ? 'everyone' : 'only itself'}`, async () => {
        const listed = await listedIds(await rest('users?depth=0&limit=1000', role))
        expect(listed).toContain(ids[role])
        expect(listed.includes(ids.chief === ids[role] ? ids.reviewer : ids.chief)).toBe(FUND_WIDE.includes(role))
      })

      it(`${role}: cannot promote itself or another person`, async () => {
        await rest(`users/${ids[role]}`, role, 'PATCH', { operationalRole: role === 'owner' ? undefined : 'system-owner', backendService: true })
        await rest(`users/${ids.reviewer}`, role === 'owner' ? 'secretariat' : role, 'PATCH', { operationalRole: 'system-owner', isActive: false })
        await expectGraphqlClosed(`mutation { updateUser(id: ${ids.reviewer}, data: { isActive: false }) { id } }`, role)
        const self = await payload.findByID({ collection: 'users', id: ids[role], depth: 0 })
        expect(self.operationalRole).toBe(OPERATIONAL[role])
        expect(Boolean(self.backendService)).toBe(false)
        const other = await payload.findByID({ collection: 'users', id: ids.reviewer, depth: 0 })
        expect(other.operationalRole).toBe('reviewer')
        expect(other.isActive).toBe(true)
      })
    }

    it('never returns API keys to the Secretariat', async () => {
      const text = await (await rest(`users/${ids.owner}`, 'secretariat')).text()
      expect(text).not.toContain(keys.owner)
      expect(text).not.toContain('personnelHistory')
    })
  })

  describe('same-origin proxy', () => {
    const context = (path: string[]) => ({ params: Promise.resolve({ path }) })
    const browser = (path: string, seat?: Seat, headers: Record<string, string> = {}, init: RequestInit = {}) =>
      new NextRequest(`http://localhost:3000/api/dashboard/${path}`, {
        ...(init as object),
        headers: { ...(seat ? { Authorization: `users API-Key ${keys[seat]}` } : {}), ...headers },
      })

    const FORGED = {
      'x-user-id': '1',
      'x-user-roles': 'admin,system-owner',
      'x-operational-role': 'system-owner',
      'x-internal-proxy-secret': 'stolen-secret',
      cookie: 'other-session=1',
    }

    const backend = vi.fn<typeof fetch>()

    beforeAll(() => {
      vi.stubEnv('BACKEND_URL', 'http://backend.invalid:4000')
      vi.stubEnv('INTERNAL_PROXY_SECRET', PROXY_SECRET)
      vi.stubGlobal('fetch', backend)
    })

    afterEach(() => backend.mockReset())

    afterAll(() => {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    })

    const respond = (body: string, status = 200, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
      backend.mockResolvedValueOnce(new Response(body, { status, headers }))

    it.each(ROLES)('%s: forwards only the identity of the session, never what the browser sent', async (role) => {
      respond('{"items":[]}')
      const res = await proxyGet(browser('requests?status=draft', role, FORGED), context(['requests']))
      expect(res.status).toBe(200)
      expect(backend).toHaveBeenCalledTimes(1)
      const [url, init] = backend.mock.calls[0]!
      expect(url).toBe('http://backend.invalid:4000/requests?status=draft')
      const forwarded = init!.headers as Record<string, string>
      expect(forwarded['x-user-id']).toBe(String(ids[role]))
      expect(forwarded['x-internal-proxy-secret']).toBe(PROXY_SECRET)
      expect(Object.keys(forwarded).sort()).toEqual(['x-internal-proxy-secret', 'x-user-id', 'x-user-roles'])
    })

    it.each([
      ['anonymous', undefined],
      ['deactivated', 'inactive'],
      ['service account', 'service'],
    ] as const)('%s: stops at the proxy, even with forged identity headers', async (_name, seat) => {
      for (const handler of [proxyGet, proxyPost]) {
        const res = await handler(
          browser('requests', seat, FORGED, handler === proxyPost ? { method: 'POST' } : {}),
          context(['requests']),
        )
        expect(res.status).toBe(401)
        expect(await res.text()).not.toContain(PROXY_SECRET)
      }
      expect(backend).not.toHaveBeenCalled()
    })

    it('ends a session at the next request after deactivation', async () => {
      respond('{}')
      expect((await proxyGet(browser('stats', 'noCompany'), context(['stats']))).status).toBe(200)
      await payload.update({ collection: 'users', id: ids.noCompany, data: { isActive: false }, context: { allowPersonnelProvisioning: true } })
      try {
        expect((await proxyGet(browser('stats', 'noCompany'), context(['stats']))).status).toBe(401)
        expect(backend).toHaveBeenCalledTimes(1)
      } finally {
        await payload.update({ collection: 'users', id: ids.noCompany, data: { isActive: true }, context: { allowPersonnelProvisioning: true } })
      }
    })

    it.each([403, 404, 409, 410])('passes a backend %i through unchanged', async (status) => {
      respond(JSON.stringify({ error: 'refused' }), status)
      const res = await proxyGet(browser('documents/x/download', 'chief'), context(['documents', 'x', 'download']))
      expect(res.status).toBe(status)
      expect(await res.json()).toEqual({ error: 'refused' })
    })

    it('keeps the private download headers and never falls back to a public URL', async () => {
      respond('%PDF-1.4', 200, {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="file.pdf"',
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
        'content-security-policy': 'sandbox',
      })
      const res = await proxyGet(browser('documents/x/download', 'company'), context(['documents', 'x', 'download']))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
      expect(res.headers.get('cache-control')).toBe('private, no-store')
      expect(res.headers.get('content-disposition')).toContain('attachment')
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('content-security-policy')).toBe('sandbox')
    })

    it('answers an unsafe path without leaving the backend origin', async () => {
      respond('{}', 404)
      await proxyGet(browser('x', 'chief'), context(['..', '..', 'evil.invalid', 'a/b']))
      const [url] = backend.mock.calls[0]!
      expect(new URL(String(url)).origin).toBe('http://backend.invalid:4000')
      expect(String(url)).toContain('a%2Fb')
    })
  })
})
