import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const legacyMag = await db.execute(sql`
    SELECT id, technology_title, technology_featured_id, ai_title, ai_featured_id FROM mag
  `);
  const legacyStories = await db.execute(sql`
    SELECT parent_id, path, news_id, "order" FROM mag_rels
    WHERE path IN ('technologyStories', 'aiStories')
    ORDER BY "order" ASC
  `);
  await db.execute(sql`
   CREATE TABLE "mag_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"hashtag" varchar,
  	"reverse_layout" boolean DEFAULT false
  );
  
  ALTER TABLE "mag" DROP CONSTRAINT "mag_technology_featured_id_news_id_fk";
  
  ALTER TABLE "mag" DROP CONSTRAINT "mag_ai_featured_id_news_id_fk";
  
  DROP INDEX "mag_technology_featured_idx";
  DROP INDEX "mag_ai_featured_idx";
  ALTER TABLE "mag_sections" ADD CONSTRAINT "mag_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."mag"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "mag_sections_order_idx" ON "mag_sections" USING btree ("_order");
  CREATE INDEX "mag_sections_parent_id_idx" ON "mag_sections" USING btree ("_parent_id");
  ALTER TABLE "mag" DROP COLUMN "technology_title";
  ALTER TABLE "mag" DROP COLUMN "technology_featured_id";
  ALTER TABLE "mag" DROP COLUMN "ai_title";
  ALTER TABLE "mag" DROP COLUMN "ai_featured_id";`);

  type LegacyMag = {
    id: number;
    technology_title: string | null;
    technology_featured_id: number | null;
    ai_title: string | null;
    ai_featured_id: number | null;
  };
  type LegacyStory = {
    parent_id: number;
    path: string;
    news_id: number | null;
    order: number | null;
  };
  const row = (legacyMag.rows as LegacyMag[])[0];
  if (row) {
    const stories = legacyStories.rows as LegacyStory[];
    const section = (
      title: string,
      featuredId: number | null,
      path: string,
      reverseLayout: boolean,
    ) => {
      const ordered = stories
        .filter((story) => story.parent_id === row.id && story.path === path && story.news_id)
        .map((story) => story.news_id as number);
      const featured = featuredId ?? ordered[0];
      if (!featured) return null;
      return {
        title,
        featured: { relationTo: "news" as const, value: featured },
        stories: ordered.map((value) => ({ relationTo: "news" as const, value })),
        hashtag: title,
        reverseLayout,
      };
    };
    const sections = [
      section(
        row.technology_title || "فناوری",
        row.technology_featured_id,
        "technologyStories",
        true,
      ),
      section(row.ai_title || "هوش مصنوعی", row.ai_featured_id, "aiStories", false),
    ].filter((value): value is NonNullable<typeof value> => value !== null);
    if (sections.length) {
      await payload.updateGlobal({
        slug: "mag",
        data: { sections },
        context: { disableRevalidate: true },
        req,
      });
    }
  }
  await db.execute(sql`DELETE FROM mag_rels WHERE path IN ('technologyStories', 'aiStories')`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "mag_sections" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "mag_sections" CASCADE;
  ALTER TABLE "mag" ADD COLUMN "technology_title" varchar DEFAULT 'فناوری';
  ALTER TABLE "mag" ADD COLUMN "technology_featured_id" integer;
  ALTER TABLE "mag" ADD COLUMN "ai_title" varchar DEFAULT 'هوش مصنوعی';
  ALTER TABLE "mag" ADD COLUMN "ai_featured_id" integer;
  ALTER TABLE "mag" ADD CONSTRAINT "mag_technology_featured_id_news_id_fk" FOREIGN KEY ("technology_featured_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mag" ADD CONSTRAINT "mag_ai_featured_id_news_id_fk" FOREIGN KEY ("ai_featured_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "mag_technology_featured_idx" ON "mag" USING btree ("technology_featured_id");
  CREATE INDEX "mag_ai_featured_idx" ON "mag" USING btree ("ai_featured_id");`);
}
