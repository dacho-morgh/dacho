import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_services_key" AS ENUM('financing', 'events', 'exhibitions', 'knowledge', 'commercialization');
  CREATE TYPE "public"."enum_services_icon" AS ENUM('coins', 'calendar', 'store', 'graduation-cap', 'trending-up', 'sparkles');
  CREATE TYPE "public"."enum_services_gradient" AS ENUM('blue-cyan', 'indigo-purple', 'fuchsia-rose', 'emerald-teal', 'amber-orange');
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"roles_id" integer
  );
  
  CREATE TABLE "roles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "services_workflow" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"role_id" integer NOT NULL,
  	"order" numeric NOT NULL
  );
  
  ALTER TABLE "services" ADD COLUMN "key" "enum_services_key";
  ALTER TABLE "services" ADD COLUMN "icon" "enum_services_icon";
  ALTER TABLE "services" ADD COLUMN "tag" varchar;
  ALTER TABLE "services" ADD COLUMN "gradient" "enum_services_gradient";
  ALTER TABLE "services" ADD COLUMN "form_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "roles_id" integer;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_roles_fk" FOREIGN KEY ("roles_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_workflow" ADD CONSTRAINT "services_workflow_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services_workflow" ADD CONSTRAINT "services_workflow_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_roles_id_idx" ON "users_rels" USING btree ("roles_id");
  CREATE UNIQUE INDEX "roles_name_idx" ON "roles" USING btree ("name");
  CREATE INDEX "roles_updated_at_idx" ON "roles" USING btree ("updated_at");
  CREATE INDEX "roles_created_at_idx" ON "roles" USING btree ("created_at");
  CREATE INDEX "services_workflow_order_idx" ON "services_workflow" USING btree ("_order");
  CREATE INDEX "services_workflow_parent_id_idx" ON "services_workflow" USING btree ("_parent_id");
  CREATE INDEX "services_workflow_role_idx" ON "services_workflow" USING btree ("role_id");
  ALTER TABLE "services" ADD CONSTRAINT "services_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_roles_fk" FOREIGN KEY ("roles_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "services_form_idx" ON "services" USING btree ("form_id");
  CREATE INDEX "payload_locked_documents_rels_roles_id_idx" ON "payload_locked_documents_rels" USING btree ("roles_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "roles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "services_workflow" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_rels" CASCADE;
  DROP TABLE "roles" CASCADE;
  DROP TABLE "services_workflow" CASCADE;
  ALTER TABLE "services" DROP CONSTRAINT "services_form_id_forms_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_roles_fk";
  
  DROP INDEX "services_form_idx";
  DROP INDEX "payload_locked_documents_rels_roles_id_idx";
  ALTER TABLE "services" DROP COLUMN "key";
  ALTER TABLE "services" DROP COLUMN "icon";
  ALTER TABLE "services" DROP COLUMN "tag";
  ALTER TABLE "services" DROP COLUMN "gradient";
  ALTER TABLE "services" DROP COLUMN "form_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "roles_id";
  DROP TYPE "public"."enum_services_key";
  DROP TYPE "public"."enum_services_icon";
  DROP TYPE "public"."enum_services_gradient";`)
}
