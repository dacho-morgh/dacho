import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Stage-1 signup captures the company's business activity domain. It is a
 * nullable text column: existing companies predate the field and must be
 * completed deliberately rather than backfilled with an invented value.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "public"."companies" ADD COLUMN IF NOT EXISTS "activity_domain" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "public"."companies" DROP COLUMN IF EXISTS "activity_domain";
  `)
}
