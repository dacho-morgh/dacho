import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { generateNKeysBetween } from 'payload/shared'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "_order" varchar;
    CREATE INDEX IF NOT EXISTS "services__order_idx" ON "services" USING btree ("_order");
  `)

  // Preserve the current homepage sequence when enabling Payload's native
  // ordering. Existing editor-assigned keys survive a repeated migration.
  const { rows: services } = await db.execute<{ id: number }>(sql`
    SELECT "id" FROM "services" WHERE "_order" IS NULL ORDER BY "created_at", "id";
  `)
  const { rows: ordered } = await db.execute<{ _order: string }>(sql`
    SELECT "_order" FROM "services" WHERE "_order" IS NOT NULL ORDER BY "_order" DESC LIMIT 1;
  `)
  const keys = generateNKeysBetween(ordered[0]?._order ?? null, null, services.length)

  for (const [index, service] of services.entries()) {
    await db.execute(sql`
      UPDATE "services" SET "_order" = ${keys[index]}
      WHERE "id" = ${service.id} AND "_order" IS NULL;
    `)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "services__order_idx";
    ALTER TABLE "services" DROP COLUMN IF EXISTS "_order";
  `)
}
