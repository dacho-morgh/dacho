import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "users" AS "target"
    SET "username" = TRIM("target"."phone")
    WHERE ("target"."username" IS NULL OR "target"."username" = '')
      AND "target"."phone" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "users" AS "existing"
        WHERE "existing"."username" = TRIM("target"."phone")
      );
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Keep populated usernames: removing credentials during rollback would be destructive.
}
