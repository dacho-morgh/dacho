import type { Address, CompanyFields, Executive, User } from './user-store.js'

export interface Company extends CompanyFields {
  id: string
  /** The user acting as this company's representative (نماینده). */
  representativeId: string
}

export interface CompanyStore {
  findById(id: string): Promise<Company | undefined>
  /** The company this user represents, resolved via `companies.representative`. */
  findByRepresentative(userId: string): Promise<Company | undefined>
  create(fields: CompanyFields & { representativeId: string }): Promise<Company>
  update(id: string, fields: CompanyFields): Promise<Company>
  list(options?: { search?: string }): Promise<Company[]>
}

export type HttpFetcher = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

/** Reads/writes the CMS-owned `companies` collection through Payload's REST API. */
export class PayloadCompanyStore implements CompanyStore {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetcher: HttpFetcher

  constructor(options: { baseUrl: string; apiKey: string; fetcher?: HttpFetcher }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init))
  }

  async findById(id: string): Promise<Company | undefined> {
    const res = await this.fetcher(`${this.baseUrl}/api/companies/${id}?depth=0`, {
      headers: this.headers(),
    })
    if (res.status === 404) return undefined
    const data = await this.ok(res)
    return this.toCompany(unwrap(data))
  }

  async findByRepresentative(userId: string): Promise<Company | undefined> {
    const params = new URLSearchParams({
      'where[representative][equals]': userId,
      limit: '1',
      depth: '0',
    })
    const res = await this.fetcher(`${this.baseUrl}/api/companies?${params.toString()}`, {
      headers: this.headers(),
    })
    const data = await this.ok(res)
    const docs = (data as { docs?: unknown[] }).docs ?? []
    const first = docs[0]
    return first === undefined ? undefined : this.toCompany(first)
  }

  async create(fields: CompanyFields & { representativeId: string }): Promise<Company> {
    const res = await this.fetcher(`${this.baseUrl}/api/companies`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ ...mapFields(fields), representative: fields.representativeId }),
    })
    const data = await this.ok(res)
    return this.toCompany(unwrap(data))
  }

  async update(id: string, fields: CompanyFields): Promise<Company> {
    const res = await this.fetcher(`${this.baseUrl}/api/companies/${id}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(mapFields(fields)),
    })
    const data = await this.ok(res)
    return this.toCompany(unwrap(data))
  }

  async list(options: { search?: string } = {}): Promise<Company[]> {
    const params = new URLSearchParams({ depth: '0', limit: '100', sort: 'name' })
    if (options.search) params.set('where[or][0][name][contains]', options.search)
    const res = await this.fetcher(`${this.baseUrl}/api/companies?${params.toString()}`, {
      headers: this.headers(),
    })
    const data = await this.ok(res)
    return ((data as { docs?: unknown[] }).docs ?? []).map((doc) => this.toCompany(doc))
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

  private toCompany(data: unknown): Company {
    const d = data as Record<string, unknown>
    if (d.id === undefined || d.id === null) throw new Error('Payload company missing id')
    return {
      id: String(d.id),
      representativeId:
        typeof d.representative === 'object' && d.representative !== null
          ? String((d.representative as { id?: unknown }).id ?? '')
          : String(d.representative ?? ''),
      ...pickStrings(d, [
        'name',
        'nationalId',
        'registrationNumber',
        'type',
        'province',
        'city',
        'establishmentDate',
        'status',
        'economicCode',
      ]),
      ...(Array.isArray(d.executives) ? { executives: d.executives as Executive[] } : {}),
      ...(Array.isArray(d.addresses) ? { addresses: d.addresses as Address[] } : {}),
    }
  }
}

const COMPANY_FIELDS = [
  'name',
  'nationalId',
  'registrationNumber',
  'type',
  'province',
  'city',
  'establishmentDate',
  'status',
  'economicCode',
] as const

/** Keeps only the fields actually present, so PATCHes stay partial. */
function mapFields(fields: CompanyFields): Partial<CompanyFields> {
  return pickStrings(fields as Record<string, unknown>, [...COMPANY_FIELDS]) as Partial<CompanyFields>
}

function pickStrings(data: Record<string, unknown>, names: readonly string[]): Partial<Company> {
  return Object.fromEntries(
    names.filter((name) => typeof data[name] === 'string').map((name) => [name, data[name]]),
  ) as Partial<Company>
}

function unwrap(data: unknown): unknown {
  if (data && typeof data === 'object' && 'doc' in data) {
    return (data as { doc: unknown }).doc
  }
  return data
}

/** Convenience: the company a user represents, if any. */
export async function companyOfUser(
  companies: CompanyStore,
  user: User,
): Promise<Company | undefined> {
  return companies.findByRepresentative(user.id)
}

/** In-memory stand-in used by the unit and integration test harnesses. */
export class InMemoryCompanyStore implements CompanyStore {
  private readonly companies = new Map<string, Company>()
  private nextId = 1

  constructor(seed: Array<CompanyFields & { representativeId: string }> = []) {
    for (const fields of seed) {
      const id = String(this.nextId++)
      this.companies.set(id, { id, ...fields })
    }
  }

  async findById(id: string): Promise<Company | undefined> {
    return this.companies.get(id)
  }

  async findByRepresentative(userId: string): Promise<Company | undefined> {
    for (const company of this.companies.values()) {
      if (company.representativeId === userId) return company
    }
    return undefined
  }

  async create(fields: CompanyFields & { representativeId: string }): Promise<Company> {
    const id = String(this.nextId++)
    const company: Company = { id, ...fields }
    this.companies.set(id, company)
    return company
  }

  async update(id: string, fields: CompanyFields): Promise<Company> {
    const company = this.companies.get(id)
    if (!company) throw new Error(`Company not found: ${id}`)
    const updated: Company = { ...company, ...fields }
    this.companies.set(id, updated)
    return updated
  }

  async list(options: { search?: string } = {}): Promise<Company[]> {
    return [...this.companies.values()].filter((company) => {
      if (!options.search) return true
      const needle = options.search.toLocaleLowerCase()
      return [company.name, company.nationalId]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(needle))
    })
  }
}