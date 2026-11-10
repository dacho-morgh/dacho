export interface ExhibitionStore {
  exists(id: string): Promise<boolean>
}

export type HttpFetcher = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

/** The CMS collections whose public record the dashboard creates and edits (S5, T60). */
export type PublicCollection = 'events' | 'exhibitions'
export const PUBLIC_STATUSES = ['upcoming', 'ongoing', 'past'] as const
export type PublicStatus = (typeof PUBLIC_STATUSES)[number]

/** The public page of an event or exhibition. The description is plain text here. */
export interface PublicContent {
  title: string
  description: string
  location: string
  startDate: string
  endDate: string
  status: PublicStatus
}

/** The public page's poster (CMS `featuredImage`, a public media file). */
export interface PublicImage {
  url: string
  alt: string | null
}

export interface PublicRecord extends PublicContent {
  id: string
  updatedAt: string
  /** Only `find` resolves it (one level deep); lists and writes leave it out. */
  image?: PublicImage | null
}

/** The CMS rejected the record (HTTP 4xx) rather than failing to answer. */
export class PublicRecordRejected extends Error {
  constructor(readonly status: number) {
    super(`Payload rejected the public record: HTTP ${status}`)
  }
}

/**
 * Writes the public CMS records through the backend's Payload service account.
 * This is the only path from the backend to CMS writes.
 */
export interface PublicRecordStore {
  create(collection: PublicCollection, content: PublicContent): Promise<PublicRecord>
  /** Undefined when the record no longer exists. */
  update(collection: PublicCollection, id: string, content: PublicContent): Promise<PublicRecord | undefined>
  remove(collection: PublicCollection, id: string): Promise<void>
  find(collection: PublicCollection, id: string): Promise<PublicRecord | undefined>
  /** Every record, or only `ids` when given. */
  list(collection: PublicCollection, ids?: string[]): Promise<PublicRecord[]>
}

type LexicalNode = { type?: string; text?: unknown; children?: LexicalNode[] }

/** Plain text, one paragraph per line, as the CMS rich-text field stores it. */
export function toRichText(text: string): Record<string, unknown> {
  const paragraph = (line: string) => ({
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    direction: 'rtl',
    textFormat: 0,
    textStyle: '',
    children: line
      ? [{ type: 'text', text: line, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }]
      : [],
  })
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'rtl',
      children: (text ? text.split('\n') : []).map(paragraph),
    },
  }
}

/** Reads a CMS rich-text value back as plain text; formatting is not kept. */
export function fromRichText(value: unknown): string {
  if (typeof value === 'string') return value
  const root = (value as { root?: LexicalNode } | null)?.root
  if (!root || !Array.isArray(root.children)) return ''
  const textOf = (node: LexicalNode): string =>
    typeof node.text === 'string'
      ? node.text
      : node.type === 'linebreak'
        ? '\n'
        : Array.isArray(node.children) ? node.children.map(textOf).join('') : ''
  return root.children.map(textOf).join('\n').trim()
}

/** The media file's URL when the relationship was populated; an id alone or no file is null. */
function imageOf(value: unknown): PublicImage | null {
  if (!value || typeof value !== 'object') return null
  const media = value as { url?: unknown; alt?: unknown }
  if (typeof media.url !== 'string' || media.url === '') return null
  return { url: media.url, alt: typeof media.alt === 'string' && media.alt !== '' ? media.alt : null }
}

function asPublicRecord(doc: unknown, withImage = false): PublicRecord {
  const value = (doc ?? {}) as Record<string, unknown>
  const text = (field: unknown) => (typeof field === 'string' ? field : '')
  return {
    ...(withImage ? { image: imageOf(value.featuredImage) } : {}),
    id: String(value.id),
    title: text(value.title),
    description: fromRichText(value.description),
    location: text(value.location),
    startDate: text(value.startDate),
    endDate: text(value.endDate),
    status: PUBLIC_STATUSES.includes(value.status as PublicStatus) ? (value.status as PublicStatus) : 'upcoming',
    updatedAt: text(value.updatedAt),
  }
}

export class PayloadExhibitionStore implements ExhibitionStore, PublicRecordStore {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetcher: HttpFetcher

  constructor(options: { baseUrl: string; apiKey: string; fetcher?: HttpFetcher }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init))
  }

  private headers(json = false): Record<string, string> {
    return {
      Authorization: `users API-Key ${this.apiKey}`,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    }
  }

  private failure(status: number): Error {
    return status >= 400 && status < 500 ? new PublicRecordRejected(status) : new Error(`Payload API error: HTTP ${status}`)
  }

  async exists(id: string): Promise<boolean> {
    const res = await this.fetcher(`${this.baseUrl}/api/exhibitions/${encodeURIComponent(id)}?depth=0`, {
      headers: { Authorization: `users API-Key ${this.apiKey}` },
    })
    if (res.status === 404) return false
    if (res.ok) return true
    throw new Error(`Payload API error: HTTP ${res.status}`)
  }

  async create(collection: PublicCollection, content: PublicContent): Promise<PublicRecord> {
    const res = await this.fetcher(`${this.baseUrl}/api/${collection}?depth=0`, {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ ...content, description: toRichText(content.description) }),
    })
    if (!res.ok) throw this.failure(res.status)
    return asPublicRecord(((await res.json()) as { doc?: unknown }).doc)
  }

  async update(collection: PublicCollection, id: string, content: PublicContent): Promise<PublicRecord | undefined> {
    const res = await this.fetcher(`${this.baseUrl}/api/${collection}/${encodeURIComponent(id)}?depth=0`, {
      method: 'PATCH',
      headers: this.headers(true),
      body: JSON.stringify({ ...content, description: toRichText(content.description) }),
    })
    if (res.status === 404) return undefined
    if (!res.ok) throw this.failure(res.status)
    return asPublicRecord(((await res.json()) as { doc?: unknown }).doc)
  }

  async remove(collection: PublicCollection, id: string): Promise<void> {
    const res = await this.fetcher(`${this.baseUrl}/api/${collection}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.headers(),
    })
    if (res.status === 404) return
    if (!res.ok) throw this.failure(res.status)
  }

  async find(collection: PublicCollection, id: string): Promise<PublicRecord | undefined> {
    // One level deep, so the poster arrives as a media document with its public URL.
    const res = await this.fetcher(`${this.baseUrl}/api/${collection}/${encodeURIComponent(id)}?depth=1`, {
      headers: this.headers(),
    })
    if (res.status === 404) return undefined
    if (!res.ok) throw this.failure(res.status)
    return asPublicRecord(await res.json(), true)
  }

  async list(collection: PublicCollection, ids?: string[]): Promise<PublicRecord[]> {
    if (ids && ids.length === 0) return []
    const records: PublicRecord[] = []
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ depth: '0', limit: '100', page: String(page), sort: 'startDate' })
      if (ids) params.set('where[id][in]', ids.join(','))
      const res = await this.fetcher(`${this.baseUrl}/api/${collection}?${params}`, { headers: this.headers() })
      if (!res.ok) throw this.failure(res.status)
      const body = (await res.json()) as { docs?: unknown[]; hasNextPage?: boolean }
      records.push(...(body.docs ?? []).map((doc) => asPublicRecord(doc)))
      if (!body.hasNextPage) return records
    }
  }
}

export class InMemoryExhibitionStore implements ExhibitionStore {
  private readonly ids: Set<string>

  constructor(ids: string[] = []) {
    this.ids = new Set(ids)
  }

  add(id: string): void {
    this.ids.add(id)
  }

  async exists(id: string): Promise<boolean> {
    return this.ids.has(id)
  }
}

/**
 * Keeps route tests independent of a running CMS. `failNext` makes the next call
 * of that kind throw, so tests can prove a half-written create is undone.
 */
export class InMemoryPublicRecordStore implements ExhibitionStore, PublicRecordStore {
  private readonly records = new Map<string, PublicRecord>()
  private sequence = 0
  readonly failNext: Partial<Record<'create' | 'update' | 'remove' | 'read', boolean>> = {}

  constructor(options: { firstId?: number } = {}) {
    this.sequence = (options.firstId ?? 1) - 1
  }

  private key(collection: PublicCollection, id: string): string {
    return `${collection}:${id}`
  }

  private fail(kind: 'create' | 'update' | 'remove' | 'read'): void {
    if (!this.failNext[kind]) return
    this.failNext[kind] = false
    throw new Error(`in-memory CMS ${kind} failure`)
  }

  /** Seeds a record as if it was written in the CMS directly (legacy content). */
  seed(collection: PublicCollection, content: PublicContent, id = String(++this.sequence)): PublicRecord {
    const record = { ...content, id, updatedAt: new Date().toISOString() }
    this.records.set(this.key(collection, id), record)
    return record
  }

  /** Sets the poster as if an editor attached one in the CMS. */
  setImage(collection: PublicCollection, id: string, image: PublicImage | null): void {
    const record = this.records.get(this.key(collection, id))
    if (record) this.records.set(this.key(collection, id), { ...record, image })
  }

  all(collection: PublicCollection): PublicRecord[] {
    return [...this.records.entries()]
      .filter(([key]) => key.startsWith(`${collection}:`))
      .map(([, record]) => record)
  }

  async exists(id: string): Promise<boolean> {
    return this.records.has(this.key('exhibitions', id))
  }

  async create(collection: PublicCollection, content: PublicContent): Promise<PublicRecord> {
    this.fail('create')
    return this.seed(collection, content)
  }

  async update(collection: PublicCollection, id: string, content: PublicContent): Promise<PublicRecord | undefined> {
    this.fail('update')
    const existing = this.records.get(this.key(collection, id))
    if (!existing) return undefined
    const record = { ...content, id, updatedAt: new Date().toISOString(), ...(existing.image !== undefined ? { image: existing.image } : {}) }
    this.records.set(this.key(collection, id), record)
    return record
  }

  async remove(collection: PublicCollection, id: string): Promise<void> {
    this.fail('remove')
    this.records.delete(this.key(collection, id))
  }

  async find(collection: PublicCollection, id: string): Promise<PublicRecord | undefined> {
    this.fail('read')
    return this.records.get(this.key(collection, id))
  }

  async list(collection: PublicCollection, ids?: string[]): Promise<PublicRecord[]> {
    this.fail('read')
    const records = this.all(collection)
    return ids ? records.filter((record) => ids.includes(record.id)) : records
  }
}
