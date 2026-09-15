import { randomBytes } from 'node:crypto'

import type { ProfileFields, User, UserStore } from './user-store.js'

export type HttpFetcher = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

export interface PayloadUserStoreOptions {
  baseUrl: string
  apiKey: string
  fetcher?: HttpFetcher
}

/** Reads/writes the CMS-owned `users` collection through Payload's REST API. */
export class PayloadUserStore implements UserStore {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetcher: HttpFetcher

  constructor(options: PayloadUserStoreOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init))
  }

  async findOrCreateByPhone(phone: string): Promise<User> {
    const existing = await this.findByPhone(phone)
    if (existing) return existing

    // Payload's local auth requires an email-or-username and a password on
    // create; OTP users never log in with either, so supply placeholders they
    // cannot know. They authenticate via OTP (backend-issued JWT).
    const email = `${phone}@dacho.local`
    const password = randomBytes(16).toString('hex')

    const res = await this.fetcher(`${this.baseUrl}/api/users`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ phone, email, password }),
    })
    const data = await this.ok(res)
    return this.toUser(unwrap(data))
  }

  async findById(id: string): Promise<User | undefined> {
    const res = await this.fetcher(`${this.baseUrl}/api/users/${id}?depth=0`, {
      headers: this.headers(),
    })
    if (res.status === 404) return undefined
    const data = await this.ok(res)
    return this.toUser(unwrap(data))
  }

  async update(id: string, fields: ProfileFields): Promise<User> {
    const res = await this.fetcher(`${this.baseUrl}/api/users/${id}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(fields),
    })
    const data = await this.ok(res)
    return this.toUser(unwrap(data))
  }

  private async findByPhone(phone: string): Promise<User | undefined> {
    const params = new URLSearchParams({
      'where[phone][equals]': phone,
      limit: '1',
      depth: '0',
    })
    const url = `${this.baseUrl}/api/users?${params.toString()}`
    const res = await this.fetcher(url, { headers: this.headers() })
    const data = await this.ok(res)
    const docs = (data as { docs?: unknown[] }).docs ?? []
    if (docs.length === 0) return undefined
    return this.toUser(docs[0])
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `users API-Key ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  private async ok(res: Awaited<ReturnType<HttpFetcher>>): Promise<unknown> {
    if (!res.ok) throw new Error(`Payload API error: HTTP ${res.status}`)
    return res.json()
  }

  private toUser(data: unknown): User {
    const d = data as Record<string, unknown>
    if (d.id === undefined || d.id === null) throw new Error('Payload user missing id')
    return {
      id: String(d.id),
      phone: String(d.phone ?? ''),
      ...(typeof d.name === 'string' ? { name: d.name } : {}),
      ...(typeof d.companyId === 'string' ? { companyId: d.companyId } : {}),
      ...(typeof d.email === 'string' ? { email: d.email } : {}),
      ...(typeof d.position === 'string' ? { position: d.position } : {}),
      ...(d.role === 'applicant' || d.role === 'staff' ? { role: d.role } : {}),
      ...(d.cmsRole === 'admin' || d.cmsRole === 'editor' || d.cmsRole === null
        ? { cmsRole: d.cmsRole }
        : {}),
      ...mapStringFields(d, [
        'companyName',
        'companyNationalId',
        'companyRegistrationNumber',
        'companyType',
        'companyProvince',
        'companyCity',
        'companyEstablishmentDate',
        'companyStatus',
        'companyEconomicCode',
      ]),
      ...(Array.isArray(d.executives) ? { executives: d.executives as User['executives'] } : {}),
      ...(Array.isArray(d.addresses) ? { addresses: d.addresses as User['addresses'] } : {}),
    }
  }

  async list(options: { role?: User['role']; search?: string } = {}): Promise<User[]> {
    const params = new URLSearchParams({ depth: '0', limit: '100', sort: '-createdAt' })
    if (options.role) params.set('where[role][equals]', options.role)
    if (options.search) params.set('where[or][0][name][contains]', options.search)
    const res = await this.fetcher(`${this.baseUrl}/api/users?${params.toString()}`, {
      headers: this.headers(),
    })
    const data = await this.ok(res)
    const docs = (data as { docs?: unknown[] }).docs ?? []
    return docs.map((doc) => this.toUser(doc))
  }
}

function mapStringFields(data: Record<string, unknown>, names: string[]): Partial<User> {
  return Object.fromEntries(names.filter((name) => typeof data[name] === 'string').map((name) => [name, data[name]])) as Partial<User>
}

function unwrap(data: unknown): unknown {
  if (data && typeof data === 'object' && 'doc' in data) {
    return (data as { doc: unknown }).doc
  }
  return data
}
