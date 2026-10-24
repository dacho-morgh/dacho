import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import type { MigrateUpArgs } from '@payloadcms/db-postgres'
import { expect, test } from 'vitest'
import { up as migrateIdentity } from '../../../../packages/cms-core/src/migrations/20261017_210000_company_and_collapsed_roles'
import { up as renameRoles } from '../../../../packages/cms-core/src/migrations/20261017_223000_rename_user_role_and_drop_roles_collection'
import { up as singleRole } from '../../../../packages/cms-core/src/migrations/20261024_200000_single_operational_role'
import { up as addEditor } from '../../../../packages/cms-core/src/migrations/20261018_090000_add_editor_role'

const require = createRequire(import.meta.url)
const cmsRequire = createRequire(require.resolve('@payloadcms/db-postgres'))
const { Pool } = cmsRequire('pg')
const { PgDialect } = cmsRequire('drizzle-orm/pg-core')

test('loads users through the current Payload role and session relationships', async () => {
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@/payload.config'),
  ])
  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'users', limit: 1, depth: 0 })
  expect(Array.isArray(result.docs)).toBe(true)
  for (const user of result.docs) expect(Array.isArray(user.roles)).toBe(true)
})

test('upgrades existing identities without losing accounts, privileges, or legacy company data', async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  const schema = `identity_migration_${randomUUID().replaceAll('-', '')}`
  const dialect = new PgDialect()
  try {
    await client.query('BEGIN')
    await client.query(`CREATE SCHEMA "${schema}"; SET LOCAL search_path TO "${schema}"`)
    await client.query(`
      CREATE TYPE enum_users_role AS ENUM ('applicant', 'staff');
      CREATE TYPE enum_users_cms_role AS ENUM ('admin', 'editor');
      CREATE TYPE enum_users_company_type AS ENUM ('سهامی خاص');
      CREATE TABLE users (
        id serial PRIMARY KEY, role enum_users_role, cms_role enum_users_cms_role,
        name varchar, hash varchar, salt varchar, company_name varchar, company_national_id varchar,
        company_registration_number varchar, company_type enum_users_company_type,
        company_province varchar, company_city varchar, company_establishment_date varchar,
        company_status varchar, company_economic_code varchar, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE users_executives (_order integer, _parent_id integer, id varchar PRIMARY KEY, role varchar, name varchar);
      CREATE TABLE users_addresses (_order integer, _parent_id integer, id varchar PRIMARY KEY, title varchar, province varchar, city varchar, postal_code varchar, address varchar);
      CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY, roles_id integer);
      CREATE TABLE payload_preferences_rels (id serial PRIMARY KEY);
      CREATE TABLE roles (id serial PRIMARY KEY, name varchar);
      CREATE TABLE users_rels (id serial PRIMARY KEY, parent_id integer, roles_id integer);
      CREATE TABLE services_workflow (id varchar PRIMARY KEY, role_id integer);
      INSERT INTO users (id,role,cms_role,name,hash,salt,company_name,company_national_id) VALUES
        (1,'staff','admin','Admin','existing-password-hash','existing-salt',NULL,NULL),
        (2,'applicant',NULL,'Representative','hash-2','salt-2','Company','national-2'),
        (3,'staff','editor','Editor','hash-3','salt-3',NULL,NULL),
        (4,'applicant',NULL,'Duplicate one','hash-4','salt-4','Duplicate','duplicate-id'),
        (5,'applicant',NULL,'Duplicate two','hash-5','salt-5','Duplicate','duplicate-id');
      INSERT INTO users_executives VALUES (1,2,'executive-2','CEO','Executive');
      INSERT INTO users_addresses VALUES (1,2,'address-2','Office','Province','City','12345','Address');
      INSERT INTO roles (id,name) VALUES (1,'Legacy responsibility');
      INSERT INTO users_rels (parent_id,roles_id) VALUES (1,1);
      INSERT INTO services_workflow VALUES ('step-1',1);
    `)

    // Run the real migrations in a disposable schema on one transaction.
    const args = {
      db: {
        execute: (statement: Parameters<InstanceType<typeof PgDialect>['sqlToQuery']>[0]) => {
          const query = dialect.sqlToQuery(statement)
          return client.query(query.sql.replaceAll('"public".', `"${schema}".`).replaceAll('public.', `"${schema}".`), query.params)
        },
      },
    } as unknown as MigrateUpArgs
    await migrateIdentity(args)
    await renameRoles(args)
    await addEditor(args)

    const accounts = (await client.query('SELECT id, hash, salt, cms_role FROM users ORDER BY id')).rows
    expect(accounts).toHaveLength(5)
    expect(accounts[0]).toMatchObject({ hash: 'existing-password-hash', salt: 'existing-salt', cms_role: 'admin' })
    const roles = (await client.query('SELECT parent_id, value FROM users_roles ORDER BY parent_id, "order"')).rows
    expect(roles).toEqual([
      { parent_id: 1, value: 'admin' },
      { parent_id: 2, value: 'representative' },
      { parent_id: 3, value: 'editor' },
      { parent_id: 4, value: 'representative' },
      { parent_id: 5, value: 'representative' },
    ])
    expect((await client.query('SELECT name, national_id, representative_id FROM companies')).rows)
      .toEqual([{ name: 'Company', national_id: 'national-2', representative_id: 2 }])
    expect((await client.query('SELECT position, name FROM companies_executives')).rows)
      .toEqual([{ position: 'CEO', name: 'Executive' }])
    expect((await client.query('SELECT address FROM companies_addresses')).rows).toEqual([{ address: 'Address' }])
    expect((await client.query("SELECT count(*)::int count FROM users WHERE company_national_id='duplicate-id'")).rows[0].count).toBe(2)
    expect((await client.query('SELECT name FROM roles')).rows).toHaveLength(1)
    expect((await client.query('SELECT roles_id FROM users_rels')).rows).toHaveLength(1)
    expect((await client.query('SELECT role_id FROM services_workflow')).rows).toHaveLength(1)
    await client.query(`INSERT INTO users (id, name, hash, salt) VALUES (6,'Conflicting','hash-6','salt-6'),(7,'Reviewer','hash-7','salt-7'); INSERT INTO users_roles ("order",parent_id,value) VALUES (1,6,'representative'),(2,6,'referee'),(1,7,'referee'),(2,7,'editor');`)
    await singleRole(args)
    const mapped = (await client.query('SELECT id, operational_role, is_active, content_editor, backend_service, legacy_roles, hash FROM users ORDER BY id')).rows
    expect(mapped[0]).toMatchObject({ operational_role: null, is_active: false, backend_service: false, legacy_roles: ['admin'], hash: 'existing-password-hash' })
    expect(mapped[1]).toMatchObject({ operational_role: 'representative', is_active: true })
    expect(mapped[2]).toMatchObject({ operational_role: null, is_active: true, content_editor: true, legacy_roles: ['editor'] })
    expect(mapped[5]).toMatchObject({ operational_role: null, is_active: false, legacy_roles: ['representative', 'referee'] })
    expect(mapped[6]).toMatchObject({ operational_role: 'reviewer', is_active: true, content_editor: true })
    expect(mapped.every((row: { operational_role: string }) => row.operational_role !== 'system-owner')).toBe(true)
    await client.query('SAVEPOINT active_role_guard')
    await expect(client.query('UPDATE users SET is_active = true WHERE id = 1')).rejects.toThrow('users_active_operational_role_check')
    await client.query('ROLLBACK TO SAVEPOINT active_role_guard')


  } finally {
    await client.query('ROLLBACK')
    client.release()
    await pool.end()
  }
})
