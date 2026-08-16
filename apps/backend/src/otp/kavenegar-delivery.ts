import type { OtpDelivery } from './delivery.js'

export interface KavenegarResponse {
  return?: { status?: number }
}

export type Fetcher = (url: string) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<KavenegarResponse>
}>

export interface KavenegarOtpDeliveryOptions {
  apiKey: string
  template: string
  fetcher?: Fetcher
}

/** Production SMS delivery via Kavenegar's OTP lookup endpoint. */
export class KavenegarOtpDelivery implements OtpDelivery {
  private readonly apiKey: string
  private readonly template: string
  private readonly fetcher: Fetcher

  constructor(options: KavenegarOtpDeliveryOptions) {
    this.apiKey = options.apiKey
    this.template = options.template
    this.fetcher = options.fetcher ?? ((url: string) => fetch(url))
  }

  async send(phone: string, code: string): Promise<void> {
    const url = new URL(`https://api.kavenegar.com/v1/${this.apiKey}/verify/lookup.json`)
    url.searchParams.set('receptor', phone)
    url.searchParams.set('token', code)
    url.searchParams.set('template', this.template)

    const res = await this.fetcher(url.toString())
    if (!res.ok) {
      throw new Error(`Kavenegar delivery failed: HTTP ${res.status}`)
    }

    const body = await res.json()
    const status = body.return?.status
    if (status !== 200) {
      throw new Error(`Kavenegar delivery failed: status ${status}`)
    }
  }
}
