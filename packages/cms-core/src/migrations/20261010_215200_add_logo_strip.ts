import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_logo_strip_logos_link_type" AS ENUM('reference', 'custom');
  CREATE TABLE "logo_strip_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"logo_id" integer NOT NULL,
  	"link_type" "enum_logo_strip_logos_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar
  );
  
  CREATE TABLE "logo_strip" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "logo_strip_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"posts_id" integer
  );
  
  ALTER TABLE "logo_strip_logos" ADD CONSTRAINT "logo_strip_logos_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "logo_strip_logos" ADD CONSTRAINT "logo_strip_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."logo_strip"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "logo_strip_rels" ADD CONSTRAINT "logo_strip_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."logo_strip"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "logo_strip_rels" ADD CONSTRAINT "logo_strip_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "logo_strip_rels" ADD CONSTRAINT "logo_strip_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "logo_strip_logos_order_idx" ON "logo_strip_logos" USING btree ("_order");
  CREATE INDEX "logo_strip_logos_parent_id_idx" ON "logo_strip_logos" USING btree ("_parent_id");
  CREATE INDEX "logo_strip_logos_logo_idx" ON "logo_strip_logos" USING btree ("logo_id");
  CREATE INDEX "logo_strip_rels_order_idx" ON "logo_strip_rels" USING btree ("order");
  CREATE INDEX "logo_strip_rels_parent_idx" ON "logo_strip_rels" USING btree ("parent_id");
  CREATE INDEX "logo_strip_rels_path_idx" ON "logo_strip_rels" USING btree ("path");
  CREATE INDEX "logo_strip_rels_pages_id_idx" ON "logo_strip_rels" USING btree ("pages_id");
  CREATE INDEX "logo_strip_rels_posts_id_idx" ON "logo_strip_rels" USING btree ("posts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "logo_strip_logos" CASCADE;
  DROP TABLE "logo_strip" CASCADE;
  DROP TABLE "logo_strip_rels" CASCADE;
  DROP TYPE "public"."enum_logo_strip_logos_link_type";`)
}
