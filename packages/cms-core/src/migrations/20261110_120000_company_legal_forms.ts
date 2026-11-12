import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Company legal forms: adds the forms of Article 20 of the Commercial Code that
 * the registration form now offers to the `companies.type` enum. Additive: the
 * earlier values stay, so existing records are untouched.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_companies_type" ADD VALUE IF NOT EXISTS 'تضامنی';
    ALTER TYPE "public"."enum_companies_type" ADD VALUE IF NOT EXISTS 'مختلط غیرسهامی';
    ALTER TYPE "public"."enum_companies_type" ADD VALUE IF NOT EXISTS 'مختلط سهامی';
    ALTER TYPE "public"."enum_companies_type" ADD VALUE IF NOT EXISTS 'نسبی';
    ALTER TYPE "public"."enum_companies_type" ADD VALUE IF NOT EXISTS 'تعاونی';
  `)
}

// A Postgres enum value cannot be dropped without rewriting the column, and a
// record may already use it, so the down migration leaves the enum as it is.
export async function down(_args: MigrateDownArgs): Promise<void> {}
