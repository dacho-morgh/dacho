import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { InMemoryUserStore } from '../../src/auth/user-store.js'
import { createTestApp } from '../helpers.js'

const actor = {
  id: 'authorization-test-user',
  phone: '09120000001',
  name: 'کاربر مجاز',
  email: 'authorized@example.invalid',
  position: 'مدیر آزمون',
  operationalRole: 'system-owner',
  roles: ['admin'] as ('admin' | 'editor' | 'representative' | 'referee')[],
  isActive: true,
}
const proxySecret = 'test-proxy-secret'

function identityHeaders() {
  return {
    'x-internal-proxy-secret': proxySecret,
    'x-user-id': actor.id,
    // Deliberately stale and lower privilege: persisted role must win.
    'x-user-roles': 'representative',
  }
}

describe('dashboard authorization HTTP routes', () => {
  it('returns current capabilities and rechecks persisted role on every access request', async () => {
    const { app } = await createTestApp({ userStore: new InMemoryUserStore([actor]) })

    const initialCapabilities = await request(app).get('/capabilities').set(identityHeaders())
    expect(initialCapabilities.status).toBe(200)
    expect(initialCapabilities.body.role).toBe('system-owner')
    expect(initialCapabilities.body.destinations).toContain('/dashboard/companies')

    const selfProfile = await request(app).get('/profile/me').set(identityHeaders())
    expect(selfProfile.status).toBe(200)
    expect(selfProfile.body).toEqual({
      name: actor.name,
      position: actor.position,
      role: 'system-owner',
      contacts: { phone: actor.phone, email: actor.email },
    })
    expect(JSON.stringify(selfProfile.body)).not.toContain('authorization-test-user')
    await request(app).get('/health').expect(200, { status: 'ok' })

    const initiallyAllowed = await request(app)
      .get('/access')
      .query({ path: '/dashboard/companies' })
      .set(identityHeaders())
    expect(initiallyAllowed.status).toBe(200)
    expect(initiallyAllowed.body).toEqual({ allowed: true })

    actor.operationalRole = 'reviewer'
    actor.roles = ['referee']

    const updatedCapabilities = await request(app).get('/capabilities').set(identityHeaders())
    expect(updatedCapabilities.body.role).toBe('reviewer')
    expect(updatedCapabilities.body.destinations).not.toContain('/dashboard/companies')

    const revokedAccess = await request(app)
      .get('/access')
      .query({ path: '/dashboard/companies' })
      .set(identityHeaders())
    expect(revokedAccess.status).toBe(200)
    expect(revokedAccess.body).toEqual({ allowed: false })

    const malformedPath = await request(app)
      .get('/access')
      .query({ path: '/dashboard/../companies' })
      .set(identityHeaders())
    expect(malformedPath.body).toEqual({ allowed: false })
  })

  it('returns 401 for a missing identity and 403 for an inactive current account', async () => {
    const userStore = new InMemoryUserStore([actor])
    const { app } = await createTestApp({ userStore })

    expect((await request(app).get('/capabilities').set('x-internal-proxy-secret', proxySecret)).status).toBe(401)

    actor.isActive = false
    const inactive = await request(app).get('/capabilities').set(identityHeaders())
    expect(inactive.status).toBe(403)
    actor.isActive = true
  })
})
