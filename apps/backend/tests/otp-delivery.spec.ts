import { describe, expect, it } from 'vitest'

import { ConsoleOtpDelivery } from '../src/otp/console-delivery.js'
import { KavenegarOtpDelivery, type Fetcher } from '../src/otp/kavenegar-delivery.js'

describe('ConsoleOtpDelivery', () => {
  it('records the last code sent to a phone', async () => {
    const delivery = new ConsoleOtpDelivery()
    await delivery.send('09123456789', '123456')
    expect(delivery.lastCodeFor('09123456789')).toBe('123456')
    expect(delivery.lastCodeFor('unknown')).toBeUndefined()
  })
})

describe('KavenegarOtpDelivery', () => {
  const okFetcher = (calls: string[]): Fetcher => {
    return async (url: string) => {
      calls.push(url)
      return { ok: true, status: 200, json: async () => ({ return: { status: 200 } }) }
    }
  }

  it('builds the lookup URL with receptor, token and template', async () => {
    const calls: string[] = []
    const delivery = new KavenegarOtpDelivery({
      apiKey: 'API_KEY',
      template: 'dacho-otp',
      fetcher: okFetcher(calls),
    })
    await delivery.send('09123456789', '123456')

    expect(calls).toHaveLength(1)
    const url = new URL(calls[0]!)
    expect(url.hostname).toBe('api.kavenegar.com')
    expect(url.pathname).toBe('/v1/API_KEY/verify/lookup.json')
    expect(url.searchParams.get('receptor')).toBe('09123456789')
    expect(url.searchParams.get('token')).toBe('123456')
    expect(url.searchParams.get('template')).toBe('dacho-otp')
  })

  it('throws when Kavenegar reports a non-200 status', async () => {
    const fetcher: Fetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ return: { status: 418 } }),
    })
    const delivery = new KavenegarOtpDelivery({ apiKey: 'API_KEY', template: 't', fetcher })
    await expect(delivery.send('0912', '123456')).rejects.toThrow('status 418')
  })
})
