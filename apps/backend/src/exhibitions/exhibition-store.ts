export interface ExhibitionStore {
  exists(id: string): Promise<boolean>
}

export type HttpFetcher = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

export class PayloadExhibitionStore implements ExhibitionStore {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetcher: HttpFetcher

  constructor(options: { baseUrl: string; apiKey: string; fetcher?: HttpFetcher }) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init))
  }

  async exists(id: string): Promise<boolean> {
    const res = await this.fetcher(`${this.baseUrl}/api/exhibitions/${encodeURIComponent(id)}?depth=0`, {
      headers: { Authorization: `users API-Key ${this.apiKey}` },
    })
    if (res.status === 404) return false
    if (res.ok) return true
    throw new Error(`Payload API error: HTTP ${res.status}`)
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
