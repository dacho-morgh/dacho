import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createTestApp } from './helpers.js'

const existingId = '00000000-0000-4000-8000-000000000001'
const missingId = '00000000-0000-4000-8000-000000000002'

describe('assignment mutation authorization', () => {
  for (const role of ['representative', 'central-secretariat', 'chief-reviewer', 'reviewer', 'employer-reviewer', 'investment-reviewer'] as const) {
    it(`rejects ${role} before looking up existing or missing requests`, async () => {
      const query = vi.fn(async (_sql: string, values: unknown[]) => ({ rows: values[0] === existingId ? [{
        id: existingId, owner_id: 'other-person', status: 'draft',
        created_at: new Date(), updated_at: new Date(),
      }] : [] }))
      const { app, userStore } = await createTestApp({ pool: { query } as unknown as Pool })
      const actor = await userStore.findOrCreateByPhone('09918000001')
      actor.operationalRole = role
      const headers = { 'x-internal-proxy-secret': 'test-proxy-secret', 'x-user-id': actor.id }
      for (const id of [existingId, missingId]) {
        for (const method of ['post', 'delete'] as const) {
          const path = `/admin/requests/${id}/assignments${method === 'delete' ? '/target' : ''}`
          const response = await request(app)[method](path).set(headers).send({})
          expect(response.status).toBe(403)
          expect(response.body).toEqual({ error: 'forbidden' })
        }
      }
      expect(query).not.toHaveBeenCalled()
    })
  }

  it('lets system owner reach the missing-request lookup', async () => {
    const query = vi.fn(async () => ({ rows: [] }))
    const { app, userStore } = await createTestApp({ pool: { query } as unknown as Pool })
    const actor = await userStore.findOrCreateByPhone('09918000002')
    actor.operationalRole = 'system-owner'
    const headers = { 'x-internal-proxy-secret': 'test-proxy-secret', 'x-user-id': actor.id }
    for (const method of ['post', 'delete'] as const) {
      const path = `/admin/requests/${missingId}/assignments${method === 'delete' ? '/target' : ''}`
      expect((await request(app)[method](path).set(headers).send({})).status).toBe(404)
    }
    expect(query).toHaveBeenCalledTimes(2)
  })
})
