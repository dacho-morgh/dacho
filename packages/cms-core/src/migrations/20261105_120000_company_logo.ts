import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Company logo: a private `company-logos` upload collection and the optional
 * `companies.logo` relationship to it. A removed logo file leaves the column null.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "company_logos" (
      "id" serial PRIMARY KEY NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "url" varchar,
      "thumbnail_u_r_l" varchar,
      "filename" varchar,
      "mime_type" varchar,
      "filesize" numeric,
      "width" numeric,
      "height" numeric
    );
    CREATE INDEX IF NOT EXISTS "company_logos_updated_at_idx" ON "company_logos" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "company_logos_created_at_idx" ON "company_logos" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "company_logos_filename_idx" ON "company_logos" USING btree ("filename");

    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "logo_id" integer;
    DO $$ BEGIN
      ALTER TABLE "companies" ADD CONSTRAINT "companies_logo_id_company_logos_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."company_logos"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "companies_logo_idx" ON "companies" USING btree ("logo_id");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "company_logos_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_company_logos_fk" FOREIGN KEY ("company_logos_id") REFERENCES "public"."company_logos"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_company_logos_id_idx" ON "payload_locked_documents_rels" USING btree ("company_logos_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_company_logos_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_company_logos_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "company_logos_id";
    ALTER TABLE "companies" DROP CONSTRAINT IF EXISTS "companies_logo_id_company_logos_id_fk";
    DROP INDEX IF EXISTS "companies_logo_idx";
    ALTER TABLE "companies" DROP COLUMN IF EXISTS "logo_id";
    DROP TABLE IF EXISTS "company_logos";
  `)
}
