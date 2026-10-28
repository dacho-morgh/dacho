import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'
import type { RequestScope } from '../src/access/policy.js'
import { RequestRepository, type RequestRow } from '../src/dashboard/request-repo.js'

const id = '00000000-0000-4000-8000-000000000001'
const ownerId = '00000000-0000-4000-8000-000000000002'
const row: RequestRow = {
  id, revision: 1, owner_id: ownerId, company_id: null, tracking_code: 'DCH-2026-1', title: 'Request',
  service_id: id, service_key: 'service', service_name: 'Service', status: 'draft',
  current_step_index: 0, assigned_role: null, current_step: null, answers: {},
  submission_date: null, due_date: null,
  created_at: new Date('2026-01-01T00:00:00Z'), updated_at: new Date('2026-01-01T00:00:00Z'),
}
const scopes: { scope: RequestScope; predicate: string; params: unknown[] }[] = [
  { scope: { kind: 'all' }, predicate: 'TRUE', params: [id] },
  { scope: { kind: 'none' }, predicate: 'FALSE', params: [id] },
  { scope: { kind: 'owner', userId: ownerId }, predicate: 'r.owner_id = $2', params: [id, ownerId] },
  { scope: { kind: 'assigned', userId: ownerId, role: 'reviewer' }, predicate: 'EXISTS (', params: [id, ownerId, 'reviewer'] },
]

describe('request ID reads', () => {
  it('returns undefined for malformed scoped IDs without querying SQL', async () => {
    const query = vi.fn(async () => ({ rows: [] }))
    const repo = new RequestRepository({ query } as unknown as Pool)
    for (const invalidId of ['mobile-request-849319414', '', '00000000-0000-4000-8000-00000000000g']) {
      for (const { scope } of scopes) {
        expect(await repo.findByIdScoped(invalidId, scope)).toBeUndefined()
      }
    }
    expect(query).not.toHaveBeenCalled()
  })

  it('returns undefined for malformed sibling ID reads without querying SQL', async () => {
    const query = vi.fn(async () => ({ rows: [] }))
    const repo = new RequestRepository({ query } as unknown as Pool)
    for (const invalidId of ['mobile-request-849319414', '', '00000000-0000-4000-8000-00000000000g']) {
      expect(await repo.findById(invalidId, ownerId)).toBeUndefined()
      expect(await repo.findByIdAny(invalidId)).toBeUndefined()
    }
    expect(query).not.toHaveBeenCalled()
  })

  it('preserves owner and unrestricted sibling ID reads for valid UUIDs', async () => {
    const query = vi.fn(async () => ({ rows: [row] }))
    const repo = new RequestRepository({ query } as unknown as Pool)
    expect(await repo.findById(id, ownerId)).toMatchObject({ id, ownerId })
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('owner_id = $2'), [id, ownerId])
    expect(await repo.findByIdAny(id)).toMatchObject({ id, ownerId })
    expect(query).toHaveBeenLastCalledWith(expect.any(String), [id])
    expect(query).toHaveBeenCalledTimes(2)
  })

  for (const { scope, predicate, params } of scopes) {
    it(`preserves ${scope.kind} scope for valid UUIDs`, async () => {
      const query = vi.fn(async () => ({ rows: scope.kind === 'none' ? [] : [row] }))
      const repo = new RequestRepository({ query } as unknown as Pool)
      const result = await repo.findByIdScoped(id, scope)
      expect(query).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining(`WHERE r.id = $1 AND ${predicate}`), params,
      )
      if (scope.kind === 'assigned') {
        expect(query).toHaveBeenCalledWith(expect.stringContaining('a.request_id = r.id'), params)
        expect(query).toHaveBeenCalledWith(expect.stringContaining('a.user_id = $2'), params)
        expect(query).toHaveBeenCalledWith(expect.stringContaining('a.role = $3'), params)
        expect(query).toHaveBeenCalledWith(expect.stringContaining('AND a.active'), params)
      }
      if (scope.kind === 'none') expect(result).toBeUndefined()
      else expect(result).toMatchObject({ id, ownerId, createdAt: row.created_at.toISOString() })
    })
  }
})
