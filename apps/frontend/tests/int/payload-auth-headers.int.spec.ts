import { describe, expect, it } from 'vitest'
import { getServerSideURL } from '@dacho/cms-core/utilities'
import { NextRequest } from 'next/server'
import { extractJWT } from 'payload'

import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

// Mock minimal Payload instance with standard CSRF configuration
const mockPayload = {
  config: {
    cookiePrefix: 'payload',
    csrf: ['http://localhost:3000', getServerSideURL()].filter(Boolean),
    auth: { jwtOrder: ['JWT', 'Bearer', 'cookie'] },
  },
} as unknown as Parameters<typeof extractJWT>[0]['payload']

describe('getPayloadAuthHeaders', () => {
  it('restores sec-fetch-site same-origin when insecure mobile Chrome omits fetch metadata on GET', () => {
    const request = new NextRequest('http://192.168.100.14:3000/dashboard', {
      headers: { cookie: 'payload-token=test-token' },
    })

    const headers = getPayloadAuthHeaders(request)

    // Direct GET page navigations do not carry Origin
    expect(headers.has('origin')).toBe(false)
    expect(headers.get('sec-fetch-site')).toBe('same-origin')
    expect(headers.get('cookie')).toBe('payload-token=test-token')

    // Verifies Payload's extractJWT extracts the cookie without error
    const extracted = extractJWT({ headers, payload: mockPayload })
    expect(extracted).toBe('test-token')
  })

  it('normalizes same-origin LAN requests on POST mutations', () => {
    const request = new NextRequest('http://192.168.100.14:3000/api/dashboard/support', {
      method: 'POST',
      headers: {
        cookie: 'payload-token=test-token',
        origin: 'http://192.168.100.14:3000',
      },
    })

    const headers = getPayloadAuthHeaders(request)

    expect(headers.get('sec-fetch-site')).toBe('same-origin')
    expect(headers.get('origin')).toBe(getServerSideURL())

    // Verifies Payload's extractJWT accepts the token on mutation
    const extracted = extractJWT({ headers, payload: mockPayload })
    expect(extracted).toBe('test-token')
  })

  it('does not replace browser-provided cross-site CSRF metadata', () => {
    const request = new NextRequest('http://192.168.100.14:3000/dashboard', {
      headers: {
        cookie: 'payload-token=test-token',
        origin: 'https://attacker.example.com',
        'sec-fetch-site': 'cross-site',
      },
    })

    const headers = getPayloadAuthHeaders(request)

    expect(headers.get('origin')).toBe('https://attacker.example.com')
    expect(headers.get('sec-fetch-site')).toBe('cross-site')

    // Payload rejects cross-site cookies
    const extracted = extractJWT({ headers, payload: mockPayload })
    expect(extracted).toBeNull()
  })

  it('handles standard Headers objects from Server Components (await headers())', () => {
    const rawHeaders = new Headers({
      host: '192.168.100.14:3000',
      cookie: 'payload-token=test-token',
    })

    const headers = getPayloadAuthHeaders(rawHeaders)

    expect(headers.get('sec-fetch-site')).toBe('same-origin')
    expect(headers.has('origin')).toBe(false)

    const extracted = extractJWT({ headers, payload: mockPayload })
    expect(extracted).toBe('test-token')
  })
})
