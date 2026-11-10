import { describe, expect, it } from 'vitest'

import { assertLocalDevTarget } from '../src/dev/local-dev-guard.js'

describe('design-review seed guard (#288)', () => {
  it.each([
    'postgres://dacho:dacho@127.0.0.1:5432/dacho-cms',
    'postgres://dacho:dacho@localhost:5432/dacho-cms',
    'postgresql://phase0_test:phase0_test_only@127.0.0.1:55439/dacho_phase0_test',
  ])('allows the local database %s', (databaseUrl) => {
    expect(() => assertLocalDevTarget({ databaseUrl, payloadUrl: 'http://localhost:3000' })).not.toThrow()
  })

  it.each([
    'postgres://dacho:dacho@db.example.com:5432/dacho-cms',
    'postgres://dacho:dacho@postgres:5432/dacho-cms',
    'postgres://dacho:dacho@127.0.0.1:5432/dacho',
    'postgres://dacho:dacho@127.0.0.1:5432/dacho_staging',
    'mysql://dacho:dacho@127.0.0.1:5432/dacho-cms',
    'not a url',
  ])('refuses %s', (databaseUrl) => {
    expect(() => assertLocalDevTarget({ databaseUrl })).toThrow()
  })

  it('refuses production and a remote CMS', () => {
    const databaseUrl = 'postgres://dacho:dacho@127.0.0.1:5432/dacho-cms'
    expect(() => assertLocalDevTarget({ databaseUrl, nodeEnv: 'production' })).toThrow(/production/)
    expect(() => assertLocalDevTarget({ databaseUrl, payloadUrl: 'https://dacho.example.com' })).toThrow(/CMS/)
  })
})
