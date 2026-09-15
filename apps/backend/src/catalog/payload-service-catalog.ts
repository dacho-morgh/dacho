import type { FormField, ServiceCatalog, ServiceDefinition, WorkflowStep } from './service-catalog.js'

export type HttpFetcher = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

export interface PayloadServiceCatalogOptions {
  baseUrl: string
  apiKey: string
  fetcher?: HttpFetcher
}

/** Reads the CMS-owned `services` collection through Payload's REST API. */
export class PayloadServiceCatalog implements ServiceCatalog {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly fetcher: HttpFetcher

  constructor(options: PayloadServiceCatalogOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.fetcher = options.fetcher ?? ((url, init) => fetch(url, init))
  }

  async findById(id: string): Promise<ServiceDefinition | undefined> {
    const res = await this.fetcher(`${this.baseUrl}/api/services/${id}?depth=2`, {
      headers: this.headers(),
    })
    if (res.status === 404) return undefined
    const data = await this.ok(res)
    return this.toDefinition(unwrap(data))
  }

  private headers(): Record<string, string> {
    return { Authorization: `users API-Key ${this.apiKey}` }
  }

  private async ok(res: Awaited<ReturnType<HttpFetcher>>): Promise<unknown> {
    if (!res.ok) throw new Error(`Payload API error: HTTP ${res.status}`)
    return res.json()
  }

  private toDefinition(data: unknown): ServiceDefinition {
    const d = data as {
      id?: unknown
      key?: unknown
      title?: unknown
      workflow?: unknown
      form?: unknown
    }

    const workflow: WorkflowStep[] = Array.isArray(d.workflow)
      ? d.workflow.map((step) => {
          const s = step as { title?: unknown; role?: unknown; order?: unknown }
          const role = s.role as { id?: unknown; name?: unknown } | undefined
          return {
            title: String(s.title ?? ''),
            role: String(role?.id ?? s.role ?? ''),
            roleName: String(role?.name ?? ''),
            order: Number(s.order ?? 0),
          }
        })
      : []

    const formFields: FormField[] | null = (() => {
      const form = d.form as { fields?: unknown } | null | undefined
      if (!form || typeof form !== 'object' || !Array.isArray(form.fields)) return null
      return form.fields.map((field) => {
        const f = field as { name?: unknown; blockType?: unknown; label?: unknown; required?: unknown }
        return {
          name: String(f.name ?? ''),
          blockType: String(f.blockType ?? ''),
          ...(typeof f.label === 'string' ? { label: f.label } : {}),
          ...(typeof f.required === 'boolean' ? { required: f.required } : {}),
        }
      })
    })()

    return {
      id: String(d.id ?? ''),
      key: String(d.key ?? ''),
      title: String(d.title ?? ''),
      workflow,
      formFields,
    }
  }
}

function unwrap(data: unknown): unknown {
  if (data && typeof data === 'object' && 'doc' in data) {
    return (data as { doc: unknown }).doc
  }
  return data
}
