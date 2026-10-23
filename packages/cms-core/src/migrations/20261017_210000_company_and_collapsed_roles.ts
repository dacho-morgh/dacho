import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Company becomes a first-class record and cmsRole collapses into `role`.
 *
 * - companies table: the company data that used to be flattened onto users,
 *   plus a single representative FK back to users.
 * - users.role becomes a multi-valued enum (admin | representative |
 *   referee`), replacing both the old `applicant|staff` enum and cms_role.
 * Existing credentials, legacy authorization fields, and company records are
 * retained. Unambiguous companies are copied into the new collection; duplicate
 * national ids remain in the legacy columns for explicit reconciliation.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Keep the old column and its enum values for recovery. Renaming the type
    -- updates its existing dependencies without rewriting any account data.
    ALTER TYPE "public"."enum_users_role" RENAME TO "enum_users_legacy_role";
    CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'representative', 'referee');
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

    -- Preserve CMS access exactly. A legacy staff flag alone never grants
    -- admin privileges; company applicants become representatives.
    INSERT INTO "users_role" ("order", "parent_id", "value")
    SELECT row_number() OVER (PARTITION BY "id" ORDER BY "value")::integer,
      "id", "value"::"public"."enum_users_role"
    FROM (
      SELECT "id", "cms_role"::text AS "value" FROM "users"
      WHERE "cms_role"::text IN ('admin', 'editor')
      UNION ALL
      SELECT "id", 'representative' AS "value" FROM "users"
      WHERE "role"::text = 'applicant'
    ) AS "existing_roles";

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

    -- Do not guess which person represents a duplicated national id. Those
    -- records, including their addresses, remain intact in the legacy tables.
    INSERT INTO "companies" (
      "name", "national_id", "registration_number", "type", "province", "city",
      "establishment_date", "status", "economic_code", "representative_id", "created_at", "updated_at"
    )
    SELECT "company_name", TRIM("company_national_id"), "company_registration_number",
      "company_type"::text::"public"."enum_companies_type", "company_province", "company_city",
      "company_establishment_date", "company_status", "company_economic_code", "id", "created_at", "updated_at"
    FROM "users" AS "source"
    WHERE NULLIF(TRIM("company_name"), '') IS NOT NULL
      AND NULLIF(TRIM("company_national_id"), '') IS NOT NULL
      AND (SELECT count(*) FROM "users" AS "other"
        WHERE TRIM("other"."company_national_id") = TRIM("source"."company_national_id")) = 1
    ON CONFLICT ("national_id") DO NOTHING;

    INSERT INTO "companies_executives" ("_order", "_parent_id", "id", "position", "name")
    SELECT "legacy"."_order", "company"."id", "legacy"."id", "legacy"."role", "legacy"."name"
    FROM "users_executives" AS "legacy"
    JOIN "companies" AS "company" ON "company"."representative_id" = "legacy"."_parent_id"
    ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "companies_addresses" ("_order", "_parent_id", "id", "title", "province", "city", "postal_code", "address")
    SELECT "legacy"."_order", "company"."id", "legacy"."id", "legacy"."title", "legacy"."province",
      "legacy"."city", "legacy"."postal_code", "legacy"."address"
    FROM "users_addresses" AS "legacy"
    JOIN "companies" AS "company" ON "company"."representative_id" = "legacy"."_parent_id"
    ON CONFLICT ("id") DO NOTHING;
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Credentials and legacy fields remain available, but automatically reversing
  // the identity model could discard new company records or role assignments.
  throw new Error(
    'Identity migration requires a reviewed rollback; legacy identity data has been retained.',
  )
}
