import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add the `editor` role («تحریر») to the CMS content desk.
 *
 * `users.roles` is a multi-valued select whose values live in the
 * `enum_users_role` Postgres enum (inherited from the original single-valued
 * `role` field, which Payload reused when the axis went multi-valued). Adding a
 * role is therefore a schema change, not just a config change — `down` cannot
 * reverse it, because dropping an enum label would also strip it from every
 * `users_roles` row that already holds it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_users_role" ADD VALUE IF NOT EXISTS 'editor';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Intentionally irreversible: reverting means rebuilding the enum and
  // rewriting users_roles, which loses the editor assignments.
}