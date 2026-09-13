import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sliders_images" RENAME COLUMN "image_id" TO "landscape_image_id";
  ALTER TABLE "sliders_images" DROP CONSTRAINT "sliders_images_image_id_media_id_fk";
  
  DROP INDEX "sliders_images_image_idx";
  ALTER TABLE "sliders_images" ADD COLUMN "mobile_image_id" integer;
  UPDATE "sliders_images" SET "mobile_image_id" = "landscape_image_id";
  ALTER TABLE "sliders_images" ALTER COLUMN "mobile_image_id" SET NOT NULL;
  ALTER TABLE "sliders_images" ADD CONSTRAINT "sliders_images_landscape_image_id_media_id_fk" FOREIGN KEY ("landscape_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sliders_images" ADD CONSTRAINT "sliders_images_mobile_image_id_media_id_fk" FOREIGN KEY ("mobile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "sliders_images_landscape_image_idx" ON "sliders_images" USING btree ("landscape_image_id");
  CREATE INDEX "sliders_images_mobile_image_idx" ON "sliders_images" USING btree ("mobile_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sliders_images" RENAME COLUMN "landscape_image_id" TO "image_id";
  ALTER TABLE "sliders_images" DROP CONSTRAINT "sliders_images_landscape_image_id_media_id_fk";
  
  ALTER TABLE "sliders_images" DROP CONSTRAINT "sliders_images_mobile_image_id_media_id_fk";
  
  DROP INDEX "sliders_images_landscape_image_idx";
  DROP INDEX "sliders_images_mobile_image_idx";
  ALTER TABLE "sliders_images" ADD CONSTRAINT "sliders_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "sliders_images_image_idx" ON "sliders_images" USING btree ("image_id");
  ALTER TABLE "sliders_images" DROP COLUMN "mobile_image_id";`)
}
