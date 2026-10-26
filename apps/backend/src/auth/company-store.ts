import { isAbsenceField, type Address, type CompanyFields, type Executive, type User } from './user-store.js'

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
    // The app uses string IDs; Payload's numeric relationship validator expects
    // a JSON number for Postgres IDs (UUID/string-ID collections stay strings).
    const numericId = Number(fields.representativeId)
    const representative = Number.isSafeInteger(numericId) && String(numericId) === fields.representativeId
      ? numericId
      : fields.representativeId
    const res = await this.fetcher(`${this.baseUrl}/api/companies`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ ...mapFields(fields), representative }),
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
        'activityDomain',
        'registrationNumber',
        'type',
        'province',
        'city',
        'establishmentDate',
        'status',
        'economicCode',
        'legalEntityType',
        'knowledgeBasedStatus',
        'classification',
        'foundingYear',
        'website',
        'centerEstablishment',
      ]),
      ...(typeof d.insuredEmployeeCount === 'number'
        ? { insuredEmployeeCount: d.insuredEmployeeCount }
        : {}),
      ...(Array.isArray(d.executives) ? { executives: d.executives as Executive[] } : {}),
      ...(Array.isArray(d.addresses) ? { addresses: d.addresses as Address[] } : {}),
      ...(Array.isArray(d.productsServices)
        ? { productsServices: d.productsServices.map(textEntry).filter(isPresent) }
        : {}),
      ...(Array.isArray(d.requestedServices)
        ? { requestedServices: d.requestedServices.map(serviceEntry).filter(isPresent) }
        : {}),
      ...(Array.isArray(d.keyMembers)
        ? { keyMembers: d.keyMembers as CompanyFields['keyMembers'] }
        : {}),
      ...(Array.isArray(d.pastProjectsCustomers)
        ? { pastProjectsCustomers: d.pastProjectsCustomers as CompanyFields['pastProjectsCustomers'] }
        : {}),
      ...(Array.isArray(d.certificatesLicenses)
        ? { certificatesLicenses: d.certificatesLicenses as CompanyFields['certificatesLicenses'] }
        : {}),
      ...(Array.isArray(d.notAvailable)
        ? { notAvailable: d.notAvailable.filter(isAbsenceField) }
        : {}),
    }
  }
}

const COMPANY_FIELDS = [
  'name',
  'nationalId',
  'activityDomain',
  'registrationNumber',
  'type',
  'province',
  'city',
  'establishmentDate',
  'status',
  'economicCode',
  'legalEntityType',
  'knowledgeBasedStatus',
  'classification',
  'foundingYear',
  'website',
  'centerEstablishment',
] as const

function textEntry(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { title?: unknown }).title === 'string') {
    return (value as { title: string }).title
  }
  return undefined
}

function serviceEntry(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && typeof (value as { service?: unknown }).service === 'string') {
    return (value as { service: string }).service
  }
  return undefined
}

function isPresent(value: string | undefined): value is string {
  return value !== undefined
}

/** Keeps only the fields actually present, so PATCHes stay partial. */
function mapFields(fields: CompanyFields): Record<string, unknown> {
  return {
    ...pickStrings(fields as Record<string, unknown>, COMPANY_FIELDS),
    ...(fields.insuredEmployeeCount !== undefined
      ? { insuredEmployeeCount: fields.insuredEmployeeCount }
      : {}),
    ...(fields.executives !== undefined
      ? { executives: fields.executives.map(({ position, name }) => ({ position, name })) }
      : {}),
    ...(fields.addresses !== undefined
      ? {
          addresses: fields.addresses.map(({ id, title, province, city, postalCode, address }) => ({
            ...(id !== undefined ? { id } : {}),
            title, province, city, postalCode, address,
          })),
        }
      : {}),
    ...(fields.productsServices !== undefined
      ? { productsServices: fields.productsServices.map((title) => ({ title })) }
      : {}),
    ...(fields.keyMembers !== undefined
      ? { keyMembers: fields.keyMembers.map(({ name, role }) => ({ name, role })) }
      : {}),
    ...(fields.pastProjectsCustomers !== undefined
      ? {
          pastProjectsCustomers: fields.pastProjectsCustomers.map(({ project, customer, summary }) => ({
            project,
            ...(customer !== undefined ? { customer } : {}),
            ...(summary !== undefined ? { summary } : {}),
          })),
        }
      : {}),
    ...(fields.requestedServices !== undefined
      ? { requestedServices: fields.requestedServices.map((service) => ({ service })) }
      : {}),
    ...(fields.certificatesLicenses !== undefined
      ? {
          certificatesLicenses: fields.certificatesLicenses.map(({ title, issuer, reference }) => ({
            title,
            ...(issuer !== undefined ? { issuer } : {}),
            ...(reference !== undefined ? { reference } : {}),
          })),
        }
      : {}),
    ...(fields.notAvailable !== undefined ? { notAvailable: fields.notAvailable } : {}),
  }
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
