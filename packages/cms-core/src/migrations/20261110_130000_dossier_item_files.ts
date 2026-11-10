import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Dossier item details: a key member's education and where the degree was
 * obtained, and an optional private file (PDF, Word or image) for each product
 * or service and each certificate or licence, referenced by its document id.
 * Additive: the certificate issuer/reference columns stay for existing rows.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "companies_key_members" ADD COLUMN IF NOT EXISTS "education" varchar;
    ALTER TABLE "companies_key_members" ADD COLUMN IF NOT EXISTS "degree_place" varchar;
    ALTER TABLE "companies_products_services" ADD COLUMN IF NOT EXISTS "document_id" varchar;
    ALTER TABLE "companies_certificates_licenses" ADD COLUMN IF NOT EXISTS "document_id" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "companies_certificates_licenses" DROP COLUMN IF EXISTS "document_id";
    ALTER TABLE "companies_products_services" DROP COLUMN IF EXISTS "document_id";
    ALTER TABLE "companies_key_members" DROP COLUMN IF EXISTS "degree_place";
    ALTER TABLE "companies_key_members" DROP COLUMN IF EXISTS "education";
  `)
}
