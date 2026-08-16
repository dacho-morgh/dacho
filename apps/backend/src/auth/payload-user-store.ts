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

    const res = await this.fetcher(`${this.baseUrl}/api/users`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ phone }),
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
    const url = `${this.baseUrl}/api/users?where[phone][equals]=${encodeURIComponent(phone)}&limit=1&depth=0`
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
    const d = data as { id?: unknown; phone?: unknown; name?: unknown; companyId?: unknown }
    if (d.id === undefined || d.id === null) throw new Error('Payload user missing id')
    return {
      id: String(d.id),
      phone: String(d.phone ?? ''),
      ...(typeof d.name === 'string' ? { name: d.name } : {}),
      ...(typeof d.companyId === 'string' ? { companyId: d.companyId } : {}),
    }
  }
}

function unwrap(data: unknown): unknown {
  if (data && typeof data === 'object' && 'doc' in data) {
    return (data as { doc: unknown }).doc
  }
  return data
}
