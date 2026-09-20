import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "posts_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "_posts_v_version_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tag" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "newsletter_subscribers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"source" varchar DEFAULT 'mag',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mag_hot_hashtags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "mag" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_id" integer,
  	"technology_title" varchar DEFAULT 'فناوری',
  	"technology_featured_id" integer,
  	"featured_report_id" integer,
  	"ai_title" varchar DEFAULT 'هوش مصنوعی',
  	"ai_featured_id" integer,
  	"newsletter_title" varchar DEFAULT 'آخرین اخبار را از دست ندهید',
  	"newsletter_description" varchar DEFAULT 'مهم‌ترین اخبار، گزارش‌ها و رویدادهای هفته را در ایمیل خود دریافت کنید.',
  	"show_recruitment" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "mag_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"news_id" integer,
  	"posts_id" integer
  );
  
  ALTER TABLE "posts" ADD COLUMN "excerpt" varchar;
  ALTER TABLE "posts" ADD COLUMN "editorial_label" varchar;
  ALTER TABLE "posts" ADD COLUMN "reading_minutes" numeric;
  ALTER TABLE "_posts_v" ADD COLUMN "version_excerpt" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_editorial_label" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_reading_minutes" numeric;
  ALTER TABLE "news" ADD COLUMN "editorial_label" varchar;
  ALTER TABLE "news" ADD COLUMN "reading_minutes" numeric;
  ALTER TABLE "_news_v" ADD COLUMN "version_editorial_label" varchar;
  ALTER TABLE "_news_v" ADD COLUMN "version_reading_minutes" numeric;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "newsletter_subscribers_id" integer;
  ALTER TABLE "posts_tags" ADD CONSTRAINT "posts_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_tags" ADD CONSTRAINT "_posts_v_version_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mag_hot_hashtags" ADD CONSTRAINT "mag_hot_hashtags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."mag"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mag" ADD CONSTRAINT "mag_hero_id_news_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mag" ADD CONSTRAINT "mag_technology_featured_id_news_id_fk" FOREIGN KEY ("technology_featured_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mag" ADD CONSTRAINT "mag_featured_report_id_posts_id_fk" FOREIGN KEY ("featured_report_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mag" ADD CONSTRAINT "mag_ai_featured_id_news_id_fk" FOREIGN KEY ("ai_featured_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mag_rels" ADD CONSTRAINT "mag_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mag"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mag_rels" ADD CONSTRAINT "mag_rels_news_fk" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mag_rels" ADD CONSTRAINT "mag_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "posts_tags_order_idx" ON "posts_tags" USING btree ("_order");
  CREATE INDEX "posts_tags_parent_id_idx" ON "posts_tags" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_version_tags_order_idx" ON "_posts_v_version_tags" USING btree ("_order");
  CREATE INDEX "_posts_v_version_tags_parent_id_idx" ON "_posts_v_version_tags" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "newsletter_subscribers_email_idx" ON "newsletter_subscribers" USING btree ("email");
  CREATE INDEX "newsletter_subscribers_updated_at_idx" ON "newsletter_subscribers" USING btree ("updated_at");
  CREATE INDEX "newsletter_subscribers_created_at_idx" ON "newsletter_subscribers" USING btree ("created_at");
  CREATE INDEX "mag_hot_hashtags_order_idx" ON "mag_hot_hashtags" USING btree ("_order");
  CREATE INDEX "mag_hot_hashtags_parent_id_idx" ON "mag_hot_hashtags" USING btree ("_parent_id");
  CREATE INDEX "mag_hero_idx" ON "mag" USING btree ("hero_id");
  CREATE INDEX "mag_technology_featured_idx" ON "mag" USING btree ("technology_featured_id");
  CREATE INDEX "mag_featured_report_idx" ON "mag" USING btree ("featured_report_id");
  CREATE INDEX "mag_ai_featured_idx" ON "mag" USING btree ("ai_featured_id");
  CREATE INDEX "mag_rels_order_idx" ON "mag_rels" USING btree ("order");
  CREATE INDEX "mag_rels_parent_idx" ON "mag_rels" USING btree ("parent_id");
  CREATE INDEX "mag_rels_path_idx" ON "mag_rels" USING btree ("path");
  CREATE INDEX "mag_rels_news_id_idx" ON "mag_rels" USING btree ("news_id");
  CREATE INDEX "mag_rels_posts_id_idx" ON "mag_rels" USING btree ("posts_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_newsletter_subscribers_fk" FOREIGN KEY ("newsletter_subscribers_id") REFERENCES "public"."newsletter_subscribers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_newsletter_subscribers_id_idx" ON "payload_locked_documents_rels" USING btree ("newsletter_subscribers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_version_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletter_subscribers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mag_hot_hashtags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mag" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mag_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "posts_tags" CASCADE;
  DROP TABLE "_posts_v_version_tags" CASCADE;
  DROP TABLE "newsletter_subscribers" CASCADE;
  DROP TABLE "mag_hot_hashtags" CASCADE;
  DROP TABLE "mag" CASCADE;
  DROP TABLE "mag_rels" CASCADE;
  DROP INDEX "payload_locked_documents_rels_newsletter_subscribers_id_idx";
  ALTER TABLE "posts" DROP COLUMN "excerpt";
  ALTER TABLE "posts" DROP COLUMN "editorial_label";
  ALTER TABLE "posts" DROP COLUMN "reading_minutes";
  ALTER TABLE "_posts_v" DROP COLUMN "version_excerpt";
  ALTER TABLE "_posts_v" DROP COLUMN "version_editorial_label";
  ALTER TABLE "_posts_v" DROP COLUMN "version_reading_minutes";
  ALTER TABLE "news" DROP COLUMN "editorial_label";
  ALTER TABLE "news" DROP COLUMN "reading_minutes";
  ALTER TABLE "_news_v" DROP COLUMN "version_editorial_label";
  ALTER TABLE "_news_v" DROP COLUMN "version_reading_minutes";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "newsletter_subscribers_id";`)
}
