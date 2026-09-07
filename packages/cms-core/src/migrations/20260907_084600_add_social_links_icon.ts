import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "footer_social_links" ADD COLUMN "icon_id" integer;
  ALTER TABLE "footer_social_links" ADD CONSTRAINT "footer_social_links_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "footer_social_links_icon_idx" ON "footer_social_links" USING btree ("icon_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "footer_social_links" DROP CONSTRAINT "footer_social_links_icon_id_media_id_fk";
  
  DROP INDEX "footer_social_links_icon_idx";
  ALTER TABLE "footer_social_links" DROP COLUMN "icon_id";`)
}
