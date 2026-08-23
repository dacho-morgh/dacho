import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum__news_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE "news_populated_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "news_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"news_id" integer,
  	"categories_id" integer,
  	"users_id" integer
  );
  
  CREATE TABLE "_news_v_version_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tag" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_news_v_version_populated_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"name" varchar
  );
  
  CREATE TABLE "_news_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_hero_image_id" integer,
  	"version_excerpt" varchar,
  	"version_content" jsonb,
  	"version_meta_title" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_description" varchar,
  	"version_published_at" timestamp(3) with time zone,
  	"version_pinned" boolean DEFAULT false,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__news_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_news_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"news_id" integer,
  	"categories_id" integer,
  	"users_id" integer
  );
  
  ALTER TABLE "news" RENAME COLUMN "featured_image_id" TO "hero_image_id";
  ALTER TABLE "news" RENAME COLUMN "publish_date" TO "published_at";
  ALTER TABLE "news" RENAME COLUMN "status" TO "_status";
  ALTER TABLE "news" ALTER COLUMN "_status" DROP NOT NULL;
  ALTER TABLE "news" DROP CONSTRAINT "news_category_id_categories_id_fk";
  
  ALTER TABLE "news" DROP CONSTRAINT "news_featured_image_id_media_id_fk";
  
  DROP INDEX "news_category_idx";
  DROP INDEX "news_featured_image_idx";
  ALTER TABLE "news_tags" ALTER COLUMN "tag" DROP NOT NULL;
  ALTER TABLE "news" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "news" ALTER COLUMN "content" DROP NOT NULL;
  ALTER TABLE "news" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "news" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "news" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "news" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "redirects_rels" ADD COLUMN "news_id" integer;
  ALTER TABLE "search_rels" ADD COLUMN "news_id" integer;
  ALTER TABLE "news_populated_authors" ADD CONSTRAINT "news_populated_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_rels" ADD CONSTRAINT "news_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_rels" ADD CONSTRAINT "news_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_rels" ADD CONSTRAINT "news_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "news_rels" ADD CONSTRAINT "news_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_version_tags" ADD CONSTRAINT "_news_v_version_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_version_populated_authors" ADD CONSTRAINT "_news_v_version_populated_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_parent_id_news_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_news_v_rels" ADD CONSTRAINT "_news_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_rels" ADD CONSTRAINT "_news_v_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_rels" ADD CONSTRAINT "_news_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_news_v_rels" ADD CONSTRAINT "_news_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "news_populated_authors_order_idx" ON "news_populated_authors" USING btree ("_order");
  CREATE INDEX "news_populated_authors_parent_id_idx" ON "news_populated_authors" USING btree ("_parent_id");
  CREATE INDEX "news_rels_order_idx" ON "news_rels" USING btree ("order");
  CREATE INDEX "news_rels_parent_idx" ON "news_rels" USING btree ("parent_id");
  CREATE INDEX "news_rels_path_idx" ON "news_rels" USING btree ("path");
  CREATE INDEX "news_rels_news_id_idx" ON "news_rels" USING btree ("news_id");
  CREATE INDEX "news_rels_categories_id_idx" ON "news_rels" USING btree ("categories_id");
  CREATE INDEX "news_rels_users_id_idx" ON "news_rels" USING btree ("users_id");
  CREATE INDEX "_news_v_version_tags_order_idx" ON "_news_v_version_tags" USING btree ("_order");
  CREATE INDEX "_news_v_version_tags_parent_id_idx" ON "_news_v_version_tags" USING btree ("_parent_id");
  CREATE INDEX "_news_v_version_populated_authors_order_idx" ON "_news_v_version_populated_authors" USING btree ("_order");
  CREATE INDEX "_news_v_version_populated_authors_parent_id_idx" ON "_news_v_version_populated_authors" USING btree ("_parent_id");
  CREATE INDEX "_news_v_parent_idx" ON "_news_v" USING btree ("parent_id");
  CREATE INDEX "_news_v_version_version_hero_image_idx" ON "_news_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_news_v_version_meta_version_meta_image_idx" ON "_news_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_news_v_version_version_slug_idx" ON "_news_v" USING btree ("version_slug");
  CREATE INDEX "_news_v_version_version_updated_at_idx" ON "_news_v" USING btree ("version_updated_at");
  CREATE INDEX "_news_v_version_version_created_at_idx" ON "_news_v" USING btree ("version_created_at");
  CREATE INDEX "_news_v_version_version__status_idx" ON "_news_v" USING btree ("version__status");
  CREATE INDEX "_news_v_created_at_idx" ON "_news_v" USING btree ("created_at");
  CREATE INDEX "_news_v_updated_at_idx" ON "_news_v" USING btree ("updated_at");
  CREATE INDEX "_news_v_latest_idx" ON "_news_v" USING btree ("latest");
  CREATE INDEX "_news_v_autosave_idx" ON "_news_v" USING btree ("autosave");
  CREATE INDEX "_news_v_rels_order_idx" ON "_news_v_rels" USING btree ("order");
  CREATE INDEX "_news_v_rels_parent_idx" ON "_news_v_rels" USING btree ("parent_id");
  CREATE INDEX "_news_v_rels_path_idx" ON "_news_v_rels" USING btree ("path");
  CREATE INDEX "_news_v_rels_news_id_idx" ON "_news_v_rels" USING btree ("news_id");
  CREATE INDEX "_news_v_rels_categories_id_idx" ON "_news_v_rels" USING btree ("categories_id");
  CREATE INDEX "_news_v_rels_users_id_idx" ON "_news_v_rels" USING btree ("users_id");
  ALTER TABLE "news" ADD CONSTRAINT "news_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "news_hero_image_idx" ON "news" USING btree ("hero_image_id");
  CREATE INDEX "news_meta_meta_image_idx" ON "news" USING btree ("meta_image_id");
  CREATE INDEX "news__status_idx" ON "news" USING btree ("_status");
  CREATE INDEX "redirects_rels_news_id_idx" ON "redirects_rels" USING btree ("news_id");
  CREATE INDEX "search_rels_news_id_idx" ON "search_rels" USING btree ("news_id");
  INSERT INTO "news_rels" ("order", "parent_id", "path", "categories_id")
  \tSELECT 1, "id", 'categories', "category_id" FROM "news" WHERE "category_id" IS NOT NULL;
  ALTER TABLE "news" DROP COLUMN "category_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "news_populated_authors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "news_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_news_v_version_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_news_v_version_populated_authors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_news_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_news_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "news" ADD COLUMN "category_id" integer;
  UPDATE "news" SET "category_id" = "r"."categories_id" FROM "news_rels" "r" WHERE "r"."parent_id" = "news"."id" AND "r"."path" = 'categories' AND "r"."categories_id" IS NOT NULL;
  DROP TABLE "news_populated_authors" CASCADE;
  DROP TABLE "news_rels" CASCADE;
  DROP TABLE "_news_v_version_tags" CASCADE;
  DROP TABLE "_news_v_version_populated_authors" CASCADE;
  DROP TABLE "_news_v" CASCADE;
  DROP TABLE "_news_v_rels" CASCADE;
  ALTER TABLE "news" DROP CONSTRAINT "news_hero_image_id_media_id_fk";
  
  ALTER TABLE "news" DROP CONSTRAINT "news_meta_image_id_media_id_fk";
  
  ALTER TABLE "redirects_rels" DROP CONSTRAINT "redirects_rels_news_fk";
  
  ALTER TABLE "search_rels" DROP CONSTRAINT "search_rels_news_fk";
  
  DROP INDEX "news_hero_image_idx";
  DROP INDEX "news_meta_meta_image_idx";
  DROP INDEX "news__status_idx";
  DROP INDEX "redirects_rels_news_id_idx";
  DROP INDEX "search_rels_news_id_idx";
  ALTER TABLE "news_tags" ALTER COLUMN "tag" SET NOT NULL;
  ALTER TABLE "news" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "news" ALTER COLUMN "content" SET NOT NULL;
  ALTER TABLE "news" RENAME COLUMN "_status" TO "status";
  UPDATE "news" SET "status" = 'draft' WHERE "status" IS NULL;
  ALTER TABLE "news" ALTER COLUMN "status" SET NOT NULL;
  ALTER TABLE "news" RENAME COLUMN "published_at" TO "publish_date";
  ALTER TABLE "news" RENAME COLUMN "hero_image_id" TO "featured_image_id";
  ALTER TABLE "news" ADD CONSTRAINT "news_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "news" ADD CONSTRAINT "news_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "news_category_idx" ON "news" USING btree ("category_id");
  CREATE INDEX "news_featured_image_idx" ON "news" USING btree ("featured_image_id");
  ALTER TABLE "news" DROP COLUMN "meta_title";
  ALTER TABLE "news" DROP COLUMN "meta_image_id";
  ALTER TABLE "news" DROP COLUMN "meta_description";
  ALTER TABLE "news" DROP COLUMN "generate_slug";
  ALTER TABLE "redirects_rels" DROP COLUMN "news_id";
  ALTER TABLE "search_rels" DROP COLUMN "news_id";
  DROP TYPE "public"."enum__news_v_version_status";`)
}
