import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('applicant', 'staff');
  CREATE TYPE "public"."enum_users_cms_role" AS ENUM('admin', 'editor');
  CREATE TYPE "public"."enum_users_company_type" AS ENUM('سهامی خاص', 'سهامی عام', 'مسئولیت محدود', 'دانش‌بنیان', 'استارتاپ', 'سایر');
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'applicant';
  ALTER TABLE "users" ADD COLUMN "cms_role" "enum_users_cms_role";
  ALTER TABLE "users" ADD COLUMN "position" varchar;
  ALTER TABLE "users" ADD COLUMN "company_name" varchar;
  ALTER TABLE "users" ADD COLUMN "company_national_id" varchar;
  ALTER TABLE "users" ADD COLUMN "company_registration_number" varchar;
  ALTER TABLE "users" ADD COLUMN "company_type" "enum_users_company_type";
  ALTER TABLE "users" ADD COLUMN "company_province" varchar;
  ALTER TABLE "users" ADD COLUMN "company_city" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "users" DROP COLUMN "cms_role";
  ALTER TABLE "users" DROP COLUMN "position";
  ALTER TABLE "users" DROP COLUMN "company_name";
  ALTER TABLE "users" DROP COLUMN "company_national_id";
  ALTER TABLE "users" DROP COLUMN "company_registration_number";
  ALTER TABLE "users" DROP COLUMN "company_type";
  ALTER TABLE "users" DROP COLUMN "company_province";
  ALTER TABLE "users" DROP COLUMN "company_city";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_users_cms_role";
  DROP TYPE "public"."enum_users_company_type";`)
}
