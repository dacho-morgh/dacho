import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "sliders_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "sliders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sliders_id" integer;
  ALTER TABLE "sliders_images" ADD CONSTRAINT "sliders_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sliders_images" ADD CONSTRAINT "sliders_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sliders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "sliders_images_order_idx" ON "sliders_images" USING btree ("_order");
  CREATE INDEX "sliders_images_parent_id_idx" ON "sliders_images" USING btree ("_parent_id");
  CREATE INDEX "sliders_images_image_idx" ON "sliders_images" USING btree ("image_id");
  CREATE INDEX "sliders_updated_at_idx" ON "sliders" USING btree ("updated_at");
  CREATE INDEX "sliders_created_at_idx" ON "sliders" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sliders_fk" FOREIGN KEY ("sliders_id") REFERENCES "public"."sliders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_sliders_id_idx" ON "payload_locked_documents_rels" USING btree ("sliders_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sliders_fk";
  DROP INDEX "payload_locked_documents_rels_sliders_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sliders_id";
  ALTER TABLE "sliders_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sliders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "sliders_images" CASCADE;
  DROP TABLE "sliders" CASCADE;`)
}
