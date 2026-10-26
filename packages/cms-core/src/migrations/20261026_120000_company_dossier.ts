import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * T13 — persist the company's stage-2 completion and resume data.
 *
 * Legal entity type and knowledge-based status are separate columns. Arrays are
 * stored in the usual Payload child tables so they survive partial updates.
 * `not_available` holds the explicit "does not have / not available" answers.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "legal_entity_type" varchar;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "knowledge_based_status" varchar;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "classification" varchar;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "founding_year" varchar;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "activity_domain" varchar;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "website" varchar;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "center_establishment" varchar;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "insured_employee_count" numeric;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "not_available" jsonb;

    CREATE TABLE IF NOT EXISTS "companies_products_services" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "companies_key_members" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "role" varchar NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "companies_past_projects_customers" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "project" varchar NOT NULL,
      "customer" varchar,
      "summary" varchar
    );
    CREATE TABLE IF NOT EXISTS "companies_requested_services" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "service" varchar NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "companies_certificates_licenses" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "issuer" varchar,
      "reference" varchar
    );

    ALTER TABLE "companies_products_services" ADD CONSTRAINT "companies_products_services_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
    ALTER TABLE "companies_key_members" ADD CONSTRAINT "companies_key_members_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
    ALTER TABLE "companies_past_projects_customers" ADD CONSTRAINT "companies_past_projects_customers_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
    ALTER TABLE "companies_requested_services" ADD CONSTRAINT "companies_requested_services_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
    ALTER TABLE "companies_certificates_licenses" ADD CONSTRAINT "companies_certificates_licenses_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."companies"("id") ON DELETE cascade;

    CREATE INDEX IF NOT EXISTS "companies_products_services_order_idx" ON "companies_products_services" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "companies_products_services_parent_idx" ON "companies_products_services" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "companies_key_members_order_idx" ON "companies_key_members" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "companies_key_members_parent_idx" ON "companies_key_members" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "companies_past_projects_customers_order_idx" ON "companies_past_projects_customers" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "companies_past_projects_customers_parent_idx" ON "companies_past_projects_customers" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "companies_requested_services_order_idx" ON "companies_requested_services" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "companies_requested_services_parent_idx" ON "companies_requested_services" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "companies_certificates_licenses_order_idx" ON "companies_certificates_licenses" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "companies_certificates_licenses_parent_idx" ON "companies_certificates_licenses" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "companies_certificates_licenses";
    DROP TABLE IF EXISTS "companies_requested_services";
    DROP TABLE IF EXISTS "companies_past_projects_customers";
    DROP TABLE IF EXISTS "companies_key_members";
    DROP TABLE IF EXISTS "companies_products_services";
    ALTER TABLE "companies" DROP COLUMN IF EXISTS "not_available";
    ALTER TABLE "companies" DROP COLUMN IF EXISTS "insured_employee_count";
    ALTER TABLE "companies" DROP COLUMN IF EXISTS "center_establishment";
    ALTER TABLE "companies" DROP COLUMN IF EXISTS "website";
    ALTER TABLE "companies" DROP COLUMN IF EXISTS "activity_domain";
    ALTER TABLE "companies" DROP COLUMN IF EXISTS "founding_year";
    ALTER TABLE "companies" DROP COLUMN IF EXISTS "classification";
    ALTER TABLE "companies" DROP COLUMN IF EXISTS "knowledge_based_status";
    ALTER TABLE "companies" DROP COLUMN IF EXISTS "legal_entity_type";
  `)
}
