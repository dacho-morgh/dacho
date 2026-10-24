import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createTestApp } from './helpers.js'

describe('current personnel authority at dashboard boundary', () => {
  it('ignores forged forwarded roles and revokes access immediately on deactivation', async () => {
    const { app, userStore } = await createTestApp()
    const actor = await userStore.findOrCreateByPhone('09918000000')
    const headers = {
      'x-internal-proxy-secret': 'test-proxy-secret',
      'x-user-id': actor.id,
      'x-user-roles': 'admin',
    }
    expect((await request(app).get('/admin/employees').set(headers)).status).toBe(403)
    actor.roles = ['admin']
    expect(
      (
        await request(app)
          .get('/admin/employees')
          .set({ ...headers, 'x-user-roles': 'representative' })
      ).status,
    ).toBe(200)
    actor.isActive = false
    expect((await request(app).get('/admin/employees').set(headers)).status).toBe(403)
    expect((await request(app).get('/letters').set(headers)).status).toBe(403)
    actor.isActive = true
    actor.roles = ['representative']
    expect((await request(app).get('/admin/employees').set(headers)).status).toBe(403)
  })
  it('denies an unknown actor even with a valid proxy secret', async () => {
    const { app } = await createTestApp()
    expect(
      (
        await request(app).get('/admin/employees').set({
          'x-internal-proxy-secret': 'test-proxy-secret',
          'x-user-id': 'unknown',
          'x-user-roles': 'admin',
        })
      ).status,
    ).toBe(403)
  })
})
