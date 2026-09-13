import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "about_us" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"introduction_heading" varchar DEFAULT 'پیوند هوشمندانه صنعت و فناوری در قلب انرژی کشور' NOT NULL,
  	"introduction_description" varchar DEFAULT 'کارخانه نوآوری نفت، گاز و پتروشیمی بوشهر، با هدف راه‌اندازی نخستین هاب تخصصی نوآوری در حوزه انرژی‌های فسیلی و تجدیدپذیر در منطقه راهبردی عسلویه شکل گرفته است.' NOT NULL,
  	"introduction_statement" varchar DEFAULT 'رسالت ما، تبدیل چالش‌های واقعی صنعت به راهکارهای فناورانه و اقتصادی است' NOT NULL,
  	"introduction_media_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "about_us" ADD CONSTRAINT "about_us_introduction_media_id_media_id_fk" FOREIGN KEY ("introduction_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "about_us_introduction_introduction_media_idx" ON "about_us" USING btree ("introduction_media_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "about_us" CASCADE;`)
}
