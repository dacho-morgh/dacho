import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Rename the multi-valued user role field role -> roles, and drop the now
 * orphaned roles collection (the dynamic workflow roles) together with the
 * services.workflow step array that referenced it.
 *
 * The role field was already multi-valued (a users_role join table, one row per role),
 * so the rename is purely to make the plural match the behaviour — a user holds
 * any number of roles.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1. Rename the join table to follow the field name.
    ALTER TABLE "users_role" RENAME TO "users_roles";
    ALTER SEQUENCE "users_role_id_seq" RENAME TO "users_roles_id_seq";
    ALTER TABLE "users_roles" RENAME CONSTRAINT "users_role_parent_id_value_order_unique" TO "users_roles_parent_id_value_order_unique";
    ALTER TABLE "users_roles" RENAME CONSTRAINT "users_role_pkey" TO "users_roles_pkey";
    ALTER TABLE "users_roles" RENAME CONSTRAINT "users_role_parent_fk" TO "users_roles_parent_fk";
    ALTER INDEX "users_role_order_idx" RENAME TO "users_roles_order_idx";
    ALTER INDEX "users_role_parent_idx" RENAME TO "users_roles_parent_idx";

    -- 2. Drop the dynamic roles collection and everything that referenced it
    --    (the dropped message-flow design). The referencing columns must go
    --    first: they hold foreign keys onto roles.
    ALTER TABLE IF EXISTS "services_workflow" DROP CONSTRAINT IF EXISTS "services_workflow_role_id_roles_id_fk";
    DROP TABLE IF EXISTS "services_workflow";
    ALTER TABLE IF EXISTS "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_roles_fk";
    ALTER TABLE IF EXISTS "payload_locked_documents_rels" DROP COLUMN IF EXISTS "roles_id";
    ALTER TABLE IF EXISTS "users_rels" DROP CONSTRAINT IF EXISTS "users_rels_roles_fk";
    ALTER TABLE IF EXISTS "users_rels" DROP COLUMN IF EXISTS "roles_id";
    DROP TABLE IF EXISTS "roles";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "services_workflow" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "role_id" integer NOT NULL,
      "order" numeric NOT NULL
    );
    ALTER TABLE "services_workflow" ADD CONSTRAINT "services_workflow_parent_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade;
    CREATE INDEX IF NOT EXISTS "services_workflow_order_idx" ON "services_workflow" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "services_workflow_parent_idx" ON "services_workflow" USING btree ("_parent_id");

    CREATE TABLE IF NOT EXISTS "roles" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "description" varchar,
      "updated_at" timestamp(3) with time zone NOT NULL,
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_unique" ON "roles" USING btree ("name");

    ALTER TABLE "users_roles" RENAME TO "users_role";
    ALTER SEQUENCE "users_roles_id_seq" RENAME TO "users_role_id_seq";
    ALTER TABLE "users_role" RENAME CONSTRAINT "users_roles_parent_id_value_order_unique" TO "users_role_parent_id_value_order_unique";
    ALTER TABLE "users_role" RENAME CONSTRAINT "users_roles_pkey" TO "users_role_pkey";
    ALTER TABLE "users_role" RENAME CONSTRAINT "users_roles_parent_fk" TO "users_role_parent_fk";
    ALTER INDEX "users_roles_order_idx" RENAME TO "users_role_order_idx";
    ALTER INDEX "users_roles_parent_idx" RENAME TO "users_role_parent_idx";
  `)
}