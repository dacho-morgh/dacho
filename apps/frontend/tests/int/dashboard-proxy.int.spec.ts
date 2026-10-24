import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { buildBackendRequest, normalizeRoles } from '@/utilities/dashboard-proxy'

// Slice 7 — the /api/dashboard/* proxy. Unit-tests the forwarding logic (the
// testable seam): how a resolved Payload session becomes the backend identity
// headers, and how path/query/method/body pass through unchanged.

describe('normalizeRoles', () => {
  it('normalizes the role list to trimmed strings', () => {
    expect(normalizeRoles(['admin', ' referee '])).toEqual(['admin', 'referee'])
  })

  it('returns an empty array for null/undefined roles', () => {
    expect(normalizeRoles(null)).toEqual([])
    expect(normalizeRoles(undefined)).toEqual([])
  })
})

describe('buildBackendRequest', () => {
  it('forwards identity headers and rewrites path + query', async () => {
    const req = new NextRequest('http://localhost:3000/api/dashboard/requests?status=draft', { method: 'GET' })
    const { url, init } = await buildBackendRequest(
      { id: 7, roles: ['referee'], operationalRole: 'system-owner', isActive: true },
      req,
      ['requests'],
      { backendUrl: 'http://backend:4000/', proxySecret: 'secret' },
    )

    expect(url).toBe('http://backend:4000/requests?status=draft')
    expect(init.method).toBe('GET')
    const headers = init.headers as Record<string, string>
    expect(headers['x-user-id']).toBe('7')
    expect(headers['x-user-roles']).toBe('admin')
    expect(headers['x-internal-proxy-secret']).toBe('secret')
  })

  it('forwards a POST body and content-type unchanged', async () => {
    const payload = JSON.stringify({ serviceId: '1', title: 'x' })
    const req = new NextRequest('http://localhost:3000/api/dashboard/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    })
    const { init } = await buildBackendRequest(
      { id: 7, roles: [] },
      req,
      ['requests'],
      { backendUrl: 'http://b:4000', proxySecret: 's' },
    )

    expect(init.method).toBe('POST')
    expect(init.body).toBe(payload)
    const headers = init.headers as Record<string, string>
    expect(headers['content-type']).toBe('application/json')
    expect(headers['x-user-roles']).toBe('')
  })

  it('omits the cms-role header when it is null', async () => {
    const req = new NextRequest('http://localhost:3000/api/dashboard/stats', { method: 'GET' })
    const { init } = await buildBackendRequest(
      { id: 7, roles: null },
      req,
      ['stats'],
      { backendUrl: 'http://b:4000', proxySecret: 's' },
    )

    const headers = init.headers as Record<string, string>
    expect(headers['x-user-cms-role']).toBeUndefined()
  })

  it('maps a nested path (e.g. /requests/:id/submit)', async () => {
    const req = new NextRequest('http://localhost:3000/api/dashboard/requests/abc/submit', { method: 'POST' })
    const { url } = await buildBackendRequest(
      { id: 7, roles: [] },
      req,
      ['requests', 'abc', 'submit'],
      { backendUrl: 'http://b:4000', proxySecret: 's' },
    )

    expect(url).toBe('http://b:4000/requests/abc/submit')
  })
})