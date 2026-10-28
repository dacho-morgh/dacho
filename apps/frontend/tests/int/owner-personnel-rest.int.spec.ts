import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { getPayload, handleEndpoints, type Payload } from 'payload'
import { afterAll, beforeAll, expect, it } from 'vitest'
import config from '@/payload.config'

let payload: Payload
const ids: number[] = []
const suffix = randomUUID()
const password = 'fe08-synthetic-password'
let ownerCookie: string
let reviewerCookie: string
const rest = (path: string, cookie?: string, method = 'GET', body?: unknown) =>
  handleEndpoints({
    config,
    request: new Request(`http://localhost/api/users${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'sec-fetch-site': 'same-origin',
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  })
beforeAll(async () => {
  payload = await getPayload({ config })
  for (const [index, operationalRole] of ['system-owner', 'reviewer'].entries()) {
    const user = await payload.create({
      collection: 'users',
      data: {
        name: `FE08 ${operationalRole}`,
        phone: `0991777000${index}`,
        email: `fe08-${index}-${suffix}@example.invalid`,
        password,
        operationalRole: operationalRole as 'system-owner' | 'reviewer',
        isActive: true,
      },
      context: { allowPersonnelProvisioning: true },
    })
    ids.push(user.id)
    const login = await rest('/login', undefined, 'POST', { email: user.email, password })
    expect(login.status).toBe(200)
    const cookie = login.headers.get('set-cookie')!.split(';')[0]
    if (index === 0) ownerCookie = cookie
    else reviewerCookie = cookie
  }
})
afterAll(async () => {
  for (const id of ids.reverse()) await payload.delete({ collection: 'users', id })
})
it('uses a real owner session for paginated selectors, create, read, scalar role edit and deactivation', async () => {
  const created = await rest('', ownerCookie, 'POST', {
    name: 'کارفرمای تست',
    phone: '09917770003',
    username: '09917770003',
    password,
    operationalRole: 'employer-reviewer',
    isActive: true,
  })
  expect(created.status).toBe(201)
  const { doc } = await created.json()
  ids.push(doc.id)
  const list = await rest(
    '?depth=0&limit=100&page=1&where[backendService][not_equals]=true&select[name]=true&select[phone]=true&select[email]=true&select[operationalRole]=true&select[isActive]=true&select[updatedAt]=true',
    ownerCookie,
  )
  expect(list.status).toBe(200)
  expect((await list.json()).docs).toContainEqual(
    expect.objectContaining({ id: doc.id, operationalRole: 'employer-reviewer', isActive: true }),
  )
  const snapshot = await rest(`/${doc.id}?depth=0&select[updatedAt]=true`, ownerCookie)
  expect(snapshot.status).toBe(200)
  expect((await snapshot.json()).updatedAt).toBe(doc.updatedAt)
  const edited = await rest(`/personnel/${doc.id}`, ownerCookie, 'PATCH', {
    expectedUpdatedAt: doc.updatedAt,
    name: 'داور تست',
    operationalRole: 'reviewer',
    isActive: false,
  })
  expect(edited.status).toBe(200)
  expect((await edited.json()).doc).toMatchObject({
    id: doc.id,
    name: 'داور تست',
    operationalRole: 'reviewer',
    isActive: false,
  })
  const saved = await payload.findByID({ collection: 'users', id: doc.id })
  expect(saved.operationalRole).toBe('reviewer')
  expect(saved.isActive).toBe(false)
  expect(saved.personnelHistory).toBeTruthy()
  const stale = await rest(`/personnel/${doc.id}`, ownerCookie, 'PATCH', {
    expectedUpdatedAt: doc.updatedAt,
    operationalRole: 'system-owner',
    isActive: true,
  })
  expect(stale.status).toBe(409)
  expect(await payload.findByID({ collection: 'users', id: doc.id })).toEqual(saved)
})
async function createPerson() {
  const response = await rest('', ownerCookie, 'POST', {
    name: 'Atomic personnel',
    phone: `0991778${String(ids.length).padStart(4, '0')}`,
    username: `0991778${String(ids.length).padStart(4, '0')}`,
    password,
    operationalRole: 'reviewer',
    isActive: true,
  })
  expect(response.status).toBe(201)
  const { doc } = await response.json()
  ids.push(doc.id)
  return doc
}

it('serializes two waiting commands with one token: exactly one success and one conflict', async () => {
  const person = await createPerson()
  const db = payload.db as unknown as PostgresAdapter
  const blocker = await db.pool.connect()
  let commands: Promise<Response>[] = []
  try {
    await blocker.query('BEGIN')
    await blocker.query('SELECT id FROM public.users WHERE id = $1 FOR UPDATE', [person.id])
    commands = ['chief-reviewer', 'investment-reviewer'].map((operationalRole) =>
      rest(`/personnel/${person.id}`, ownerCookie, 'PATCH', {
        expectedUpdatedAt: person.updatedAt,
        operationalRole,
      }),
    )
    const deadline = Date.now() + 5000
    let waiting = 0
    while (waiting < 2 && Date.now() < deadline) {
      await blocker.query('SELECT pg_stat_clear_snapshot()')
      const result = await blocker.query(
        `SELECT count(*)::integer AS count FROM pg_stat_activity
         WHERE datname = current_database() AND wait_event_type = 'Lock'
         AND query LIKE '%SELECT id, updated_at FROM public.users WHERE id = %FOR UPDATE%'`,
      )
      waiting = result.rows[0].count
      if (waiting < 2) await delay(20)
    }
    expect(waiting).toBe(2)
    await blocker.query('COMMIT')
    const responses = await Promise.all(commands)
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409])
    const { doc } = await responses.find((response) => response.status === 200)!.json()
    expect(Object.keys(doc).sort()).toEqual(
      ['id', 'name', 'phone', 'email', 'operationalRole', 'isActive', 'updatedAt'].sort(),
    )
    expect(Date.parse(doc.updatedAt)).toBeGreaterThan(Date.parse(person.updatedAt))
    const saved = await payload.findByID({ collection: 'users', id: person.id })
    expect(saved.operationalRole).toBe(doc.operationalRole)
    expect(saved.updatedAt).toBe(doc.updatedAt)
    expect((saved.personnelHistory as unknown[]).length).toBe(
      (person.personnelHistory as unknown[]).length + 1,
    )
  } finally {
    await blocker.query('ROLLBACK')
    blocker.release()
    await Promise.allSettled(commands)
  }
}, 10000)

it('keeps tokens monotonic despite a future stored timestamp and strips non-editable inputs', async () => {
  const person = await createPerson()
  const future = '2099-01-01T00:00:00.000Z'
  const db = payload.db as unknown as PostgresAdapter
  await db.pool.query('UPDATE public.users SET updated_at = $1 WHERE id = $2', [future, person.id])
  const response = await rest(`/personnel/${person.id}`, ownerCookie, 'PATCH', {
    expectedUpdatedAt: future,
    name: 'Changed',
    contentEditor: true,
    backendService: true,
    enableAPIKey: true,
    apiKey: 'must-not-save',
    personnelHistory: [],
    roles: ['admin'],
    username: 'must-not-save',
    legacyRoles: ['admin'],
  })
  expect(response.status).toBe(200)
  const { doc } = await response.json()
  expect(doc.updatedAt).toBe('2099-01-01T00:00:00.001Z')
  const saved = await payload.findByID({ collection: 'users', id: person.id })
  expect(saved.name).toBe('Changed')
  expect(saved.contentEditor).toBe(false)
  expect(saved.backendService).toBe(false)
  expect(saved.enableAPIKey).not.toBe(true)
  expect(saved.username).toBe(person.phone)
  expect(saved.roles).toEqual(['referee'])
  expect(saved.personnelHistory).toEqual(person.personnelHistory)
  expect(saved.legacyRoles).toEqual(person.legacyRoles)
  expect(
    (
      await rest(`/personnel/${person.id}`, ownerCookie, 'PATCH', {
        expectedUpdatedAt: future,
        isActive: false,
      })
    ).status,
  ).toBe(409)
})

it('rolls back duplicate identifiers including role history and permits retry with original token', async () => {
  const person = await createPerson()
  const before = await payload.findByID({ collection: 'users', id: person.id })
  const response = await rest(`/personnel/${person.id}`, ownerCookie, 'PATCH', {
    expectedUpdatedAt: person.updatedAt,
    phone: '09917770000',
    operationalRole: 'chief-reviewer',
    password: 'replacement-password',
  })
  expect(response.status).toBe(400)
  expect(await payload.findByID({ collection: 'users', id: person.id })).toEqual(before)
  const retry = await rest(`/personnel/${person.id}`, ownerCookie, 'PATCH', {
    expectedUpdatedAt: person.updatedAt,
    operationalRole: 'chief-reviewer',
  })
  expect(retry.status).toBe(200)
  expect((await retry.json()).doc.operationalRole).toBe('chief-reviewer')
  expect(
    (
      await rest('/login', undefined, 'POST', {
        username: person.phone,
        password,
      })
    ).status,
  ).toBe(200)
})

it('validates command identifiers, body, token, scalar roles and field types before any write', async () => {
  const person = await createPerson()
  const before = await payload.findByID({ collection: 'users', id: person.id })
  for (const id of ['0', '-1', '1.5', '1x', '2147483648', '9007199254740993']) {
    expect(
      (
        await rest(`/personnel/${id}`, ownerCookie, 'PATCH', {
          expectedUpdatedAt: person.updatedAt,
          name: 'Invalid',
        })
      ).status,
    ).toBe(400)
  }
  for (const body of [
    null,
    [],
    'text',
    {},
    { expectedUpdatedAt: null },
    { expectedUpdatedAt: 'not-a-date' },
    { expectedUpdatedAt: '2026-02-30T00:00:00.000Z' },
    { expectedUpdatedAt: 123 },
    ...[
      { name: 123 },
      { phone: null },
      { email: {} },
      { password: [] },
      { operationalRole: ['reviewer'] },
      { operationalRole: 'admin' },
      { operationalRole: null },
      { isActive: 'false' },
      { isActive: null },
    ].map((fields) => ({ expectedUpdatedAt: person.updatedAt, ...fields })),
  ]) {
    expect((await rest(`/personnel/${person.id}`, ownerCookie, 'PATCH', body)).status).toBe(400)
  }
  expect(
    (
      await rest('/personnel/2147483647', ownerCookie, 'PATCH', {
        expectedUpdatedAt: person.updatedAt,
        name: 'Absent',
      })
    ).status,
  ).toBe(404)
  expect(await payload.findByID({ collection: 'users', id: person.id })).toEqual(before)
})

it('denies absent, reviewer, inactive owner and service actors', async () => {
  const person = await createPerson()
  for (const cookie of [undefined, reviewerCookie]) {
    expect(
      (
        await rest(`/personnel/${person.id}`, cookie, 'PATCH', {
          expectedUpdatedAt: person.updatedAt,
          isActive: false,
        })
      ).status,
    ).toBe(403)
  }
  const owner = await payload.findByID({ collection: 'users', id: ids[0] })
  for (const flags of [{ isActive: false }, { backendService: true }]) {
    // Actor already has a real cookie; auth must use current persisted flags.
    await payload.update({
      collection: 'users',
      id: owner.id,
      data: flags,
      context: { allowPersonnelProvisioning: true },
    })
    try {
      expect(
        (
          await rest(`/personnel/${person.id}`, ownerCookie, 'PATCH', {
            expectedUpdatedAt: person.updatedAt,
            isActive: false,
          })
        ).status,
      ).toBe(403)
    } finally {
      await payload.update({
        collection: 'users',
        id: owner.id,
        data: { isActive: true, backendService: false },
        context: { allowPersonnelProvisioning: true },
      })
    }
  }
  expect((await payload.findByID({ collection: 'users', id: person.id })).isActive).toBe(true)
})

it('strips personnel escalation during public signup and protects privileged target edits', async () => {
  for (const [index, cookie] of [undefined, reviewerCookie].entries()) {
    const response = await rest('', cookie, 'POST', {
      phone: `0991777001${index}`,
      username: `0991777001${index}`,
      password,
      operationalRole: 'system-owner',
    })
    expect(response.status).toBe(201)
    const { doc } = await response.json()
    ids.push(doc.id)
    expect(doc.operationalRole).toBe('representative')
    expect([401, 403, 404]).toContain(
      (await rest(`/${ids[0]}`, cookie, 'PATCH', { operationalRole: 'reviewer' })).status,
    )
  }
  expect((await payload.findByID({ collection: 'users', id: ids[0] })).operationalRole).toBe(
    'system-owner',
  )
})
