import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Company becomes a first-class record and cmsRole collapses into `role`.
 *
 * - companies table: the company data that used to be flattened onto users,
 *   plus a single representative FK back to users.
 * - users.role becomes a multi-valued enum (admin | representative |
 *   referee`), replacing both the old `applicant|staff` enum and cms_role.
 * - The flattened `company_*` columns and the `users_executives` /
 *   `users_addresses` array tables are dropped in favour of the company's own.
 *
 * Data is greenfield (see `.scratch/company-identity/`), so this migration does
 * not backfill — it re-keys the shape and leaves existing rows to be reseeded.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. The new single authorization axis is created in step 3, directly
    -- under its final name, because the retyped column depends on it.

    -- Drop the old CMS axis; it is superseded by the admin role. The column must
    -- go before its type, or the type still has a dependent.
    ALTER TABLE "users" DROP COLUMN IF EXISTS "cms_role";
    DROP TYPE IF EXISTS "public"."enum_users_cms_role";

    -- 2. Flattened company columns move to companies.
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_name";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_national_id";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_registration_number";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_province";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_city";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_establishment_date";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_status";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_economic_code";
    DROP TABLE IF EXISTS "users_executives";
    DROP TABLE IF EXISTS "users_addresses";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "company_type";
    DROP TYPE IF EXISTS "public"."enum_users_company_type";

    -- 3. Replace the role column with the new enum. Payload stores a multi-valued
    --    (hasMany) select in a per-collection join table, not an array column,
    --    so the enum lives in users_role.value and not on users.
    ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
    DROP TABLE IF EXISTS "users_role";
    DROP TYPE IF EXISTS "public"."enum_users_role";

    CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'representative', 'referee');
    CREATE TABLE "users_role" (
      "id" serial PRIMARY KEY,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "public"."enum_users_role" NOT NULL,
      CONSTRAINT "users_role_parent_id_value_order_unique" UNIQUE ("parent_id", "value", "order")
    );
    ALTER TABLE "users_role" ADD CONSTRAINT "users_role_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade;
    CREATE INDEX "users_role_order_idx" ON "users_role" USING btree ("order");
    CREATE INDEX "users_role_parent_idx" ON "users_role" USING btree ("parent_id");

    -- 4. The companies table. Postgres has no CREATE TYPE IF NOT EXISTS, so the
    -- type is created only when absent.
    DO $do$ BEGIN
      CREATE TYPE "public"."enum_companies_type" AS ENUM('سهامی خاص', 'سهامی عام', 'مسئولیت محدود', 'دانش‌بنیان', 'استارتاپ', 'سایر');
    EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
    CREATE TABLE IF NOT EXISTS "companies" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "national_id" varchar NOT NULL,
      "registration_number" varchar,
      "type" "public"."enum_companies_type",
      "province" varchar,
      "city" varchar,
      "establishment_date" varchar,
      "status" varchar,
      "economic_code" varchar,
      "representative_id" integer NOT NULL,
      "updated_at" timestamp(3) with time zone NOT NULL,
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    -- representative is NOT NULL, so the FK must not be ON DELETE SET NULL;
    -- deleting the last representative is prevented by the column constraint.
    ALTER TABLE "companies" ADD CONSTRAINT "companies_representative_fk" FOREIGN KEY ("representative_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE cascade;

    CREATE UNIQUE INDEX IF NOT EXISTS "companies_national_id_unique" ON "companies" USING btree ("national_id");
    CREATE INDEX IF NOT EXISTS "companies_name_idx" ON "companies" USING btree ("name");
    CREATE INDEX IF NOT EXISTS "companies_representative_idx" ON "companies" USING btree ("representative_id");

    -- 4b. Payload's document-locking relation table gains a column per
    --     collection; without it every locked-document query fails.
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "companies_id" integer;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_companies_id_idx" ON "payload_locked_documents_rels" USING btree ("companies_id");
    ALTER TABLE "payload_preferences_rels" ADD COLUMN IF NOT EXISTS "companies_id" integer;
    CREATE INDEX IF NOT EXISTS "payload_preferences_rels_companies_id_idx" ON "payload_preferences_rels" USING btree ("companies_id");

    -- 5. The company's own array tables.
    CREATE TABLE IF NOT EXISTS "companies_executives" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "position" varchar NOT NULL,
      "name" varchar NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "companies_addresses" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "province" varchar,
      "city" varchar,
      "postal_code" varchar,
      "address" varchar NOT NULL
    );
    ALTER TABLE "companies_executives" ADD CONSTRAINT "companies_executives_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
    ALTER TABLE "companies_addresses" ADD CONSTRAINT "companies_addresses_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
    CREATE INDEX IF NOT EXISTS "companies_executives_order_idx" ON "companies_executives" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "companies_executives_parent_idx" ON "companies_executives" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "companies_addresses_order_idx" ON "companies_addresses" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "companies_addresses_parent_idx" ON "companies_addresses" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "companies_addresses";
    DROP TABLE IF EXISTS "companies_executives";
    DROP TABLE IF EXISTS "companies";
    DROP TYPE IF EXISTS "public"."enum_companies_type";

    DROP TABLE IF EXISTS "users_role";
    DROP TYPE IF EXISTS "public"."enum_users_role";
    CREATE TYPE "public"."enum_users_role" AS ENUM('applicant', 'staff');
    ALTER TABLE "users" ADD COLUMN "role" "public"."enum_users_role" DEFAULT 'applicant';
    CREATE TYPE "public"."enum_users_cms_role" AS ENUM('admin', 'editor');
    ALTER TABLE "users" ADD COLUMN "cms_role" "public"."enum_users_cms_role";

    CREATE TYPE "public"."enum_users_company_type" AS ENUM('سهامی خاص', 'سهامی عام', 'مسئولیت محدود', 'دانش‌بنیان', 'استارتاپ', 'سایر');
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_name" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_national_id" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_registration_number" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_type" "public"."enum_users_company_type";
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_province" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_city" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_establishment_date" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_status" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "company_economic_code" varchar;
  `)
}