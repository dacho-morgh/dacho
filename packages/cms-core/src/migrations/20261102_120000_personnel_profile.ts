import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * FE08 — personnel profile from the Figma "add employee" form: age, gender,
 * degree, activity field, resume files and addresses.
 *
 * Resumes live in the private `personnel_files` upload collection. Addresses use
 * their own child table because the legacy `users_addresses` table still holds
 * pre-migration company addresses with a different shape.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_gender" AS ENUM('male', 'female');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "personnel_files" (
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
    CREATE INDEX IF NOT EXISTS "personnel_files_updated_at_idx" ON "personnel_files" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "personnel_files_created_at_idx" ON "personnel_files" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "personnel_files_filename_idx" ON "personnel_files" USING btree ("filename");

    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "age" numeric;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" "enum_users_gender";
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "degree" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activity_field" varchar;

    CREATE TABLE IF NOT EXISTS "users_personnel_addresses" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "address" varchar NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "users_personnel_addresses" ADD CONSTRAINT "users_personnel_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "users_personnel_addresses_order_idx" ON "users_personnel_addresses" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "users_personnel_addresses_parent_id_idx" ON "users_personnel_addresses" USING btree ("_parent_id");

    CREATE TABLE IF NOT EXISTS "users_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "users_rels_order_idx" ON "users_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "users_rels_path_idx" ON "users_rels" USING btree ("path");
    ALTER TABLE "users_rels" ADD COLUMN IF NOT EXISTS "personnel_files_id" integer;
    DO $$ BEGIN
      ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_personnel_files_fk" FOREIGN KEY ("personnel_files_id") REFERENCES "public"."personnel_files"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "users_rels_personnel_files_id_idx" ON "users_rels" USING btree ("personnel_files_id");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "personnel_files_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_personnel_files_fk" FOREIGN KEY ("personnel_files_id") REFERENCES "public"."personnel_files"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_personnel_files_id_idx" ON "payload_locked_documents_rels" USING btree ("personnel_files_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_personnel_files_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_personnel_files_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "personnel_files_id";
    ALTER TABLE "users_rels" DROP CONSTRAINT IF EXISTS "users_rels_personnel_files_fk";
    DROP INDEX IF EXISTS "users_rels_personnel_files_id_idx";
    ALTER TABLE "users_rels" DROP COLUMN IF EXISTS "personnel_files_id";
    DROP TABLE IF EXISTS "users_personnel_addresses";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "activity_field";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "degree";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "gender";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "age";
    DROP TYPE IF EXISTS "public"."enum_users_gender";
    DROP TABLE IF EXISTS "personnel_files";
  `)
}
