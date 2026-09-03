import { describe, expect, it } from 'vitest'
import { getLoginUrl, getSafeReturnUrl } from '@/utilities/auth-return-url'

describe('getSafeReturnUrl', () => {
  it('keeps dashboard paths and their query string', () => {
    expect(getSafeReturnUrl('/dashboard/requests?status=draft')).toBe(
      '/dashboard/requests?status=draft',
    )
  })

  it.each([
    'https://attacker.example/dashboard',
    '//attacker.example/dashboard',
    '/dashboard-impersonation',
    '/news',
    'javascript:alert(1)',
    '',
    undefined,
  ])('falls back for an unsafe return URL: %s', (value) => {
    expect(getSafeReturnUrl(value)).toBe('/dashboard')
  })
})

describe('getLoginUrl', () => {
  it('encodes the safe return URL as a query parameter', () => {
    expect(getLoginUrl('/dashboard/requests?status=draft')).toBe(
      '/login?returnUrl=%2Fdashboard%2Frequests%3Fstatus%3Ddraft',
    )
  })

  it('can include the registration success notice', () => {
    expect(getLoginUrl('/dashboard/events', { registered: true })).toBe(
      '/login?registered=1&returnUrl=%2Fdashboard%2Fevents',
    )
  })
})
