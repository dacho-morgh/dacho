import { describe, expect, it } from 'vitest'

import { loadConfig, MissingEnvError } from '../src/config.js'

const base = {
  DATABASE_URL: 'postgres://localhost/dacho',
  JWT_PRIVATE_KEY: 'k',
  PAYLOAD_URL: 'http://localhost:3000',
  PAYLOAD_API_KEY: 'key',
}

describe('loadConfig', () => {
  it('throws when a required var is missing', () => {
    expect(() => loadConfig({})).toThrow(MissingEnvError)
    expect(() => loadConfig({ ...base, DATABASE_URL: undefined })).toThrow('DATABASE_URL')
    expect(() => loadConfig({ ...base, JWT_PRIVATE_KEY: undefined })).toThrow('JWT_PRIVATE_KEY')
    expect(() => loadConfig({ ...base, PAYLOAD_URL: undefined })).toThrow('PAYLOAD_URL')
    expect(() => loadConfig({ ...base, PAYLOAD_API_KEY: undefined })).toThrow('PAYLOAD_API_KEY')
  })

  it('defaults port to 4000, kid to dacho-backend, otpDelivery to console', () => {
    const cfg = loadConfig(base)
    expect(cfg.port).toBe(4000)
    expect(cfg.jwtKid).toBe('dacho-backend')
    expect(cfg.otpDelivery).toBe('console')
  })

  it('reads port, kid and otpDelivery from the environment', () => {
    const cfg = loadConfig({
      ...base,
      PORT: '5000',
      JWT_KID: 'custom-kid',
      OTP_DELIVERY: 'kavenegar',
      KAVENEGAR_API_KEY: 'k',
      KAVENEGAR_TEMPLATE: 't',
    })
    expect(cfg.port).toBe(5000)
    expect(cfg.jwtKid).toBe('custom-kid')
    expect(cfg.otpDelivery).toBe('kavenegar')
  })

  it('rejects an unknown OTP_DELIVERY value', () => {
    expect(() => loadConfig({ ...base, OTP_DELIVERY: 'carrier-pigeon' })).toThrow('OTP_DELIVERY')
  })

  it('requires KAVENEGAR keys when otpDelivery is kavenegar', () => {
    expect(() => loadConfig({ ...base, OTP_DELIVERY: 'kavenegar' })).toThrow(MissingEnvError)

    const cfg = loadConfig({
      ...base,
      OTP_DELIVERY: 'kavenegar',
      KAVENEGAR_API_KEY: 'k',
      KAVENEGAR_TEMPLATE: 't',
    })
    expect(cfg.kavenegar).toEqual({ apiKey: 'k', template: 't' })
  })
})
