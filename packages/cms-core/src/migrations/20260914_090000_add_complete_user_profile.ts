import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_establishment_date" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_status" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_economic_code" varchar;
    CREATE TABLE IF NOT EXISTS "users_executives" (
      "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" varchar PRIMARY KEY NOT NULL,
      "role" varchar NOT NULL, "name" varchar NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "users_addresses" (
      "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL, "province" varchar, "city" varchar, "postal_code" varchar, "address" varchar NOT NULL
    );
    ALTER TABLE "users_executives" ADD CONSTRAINT "users_executives_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade;
    ALTER TABLE "users_addresses" ADD CONSTRAINT "users_addresses_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade;
    CREATE INDEX IF NOT EXISTS "users_executives_order_idx" ON "users_executives" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "users_executives_parent_idx" ON "users_executives" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "users_addresses_order_idx" ON "users_addresses" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "users_addresses_parent_idx" ON "users_addresses" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "users_executives";
    DROP TABLE IF EXISTS "users_addresses";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_establishment_date";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_status";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_economic_code";
  `)
}
