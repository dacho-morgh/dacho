import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Event } from "../payload-types";
import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "events_about_paragraphs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "events_opportunities_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "events_audience_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar
  );
  
  CREATE TABLE "events_steps_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "events_guests_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" varchar,
  	"image_id" integer
  );
  
  CREATE TABLE "events_sponsors_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"logo_id" integer,
  	"href" varchar
  );
  
  CREATE TABLE "events_gallery_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "events_schedule_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"href" varchar,
  	"primary" boolean DEFAULT false
  );
  
  CREATE TABLE "events_schedule_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"time" varchar,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "events_faq_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  ALTER TABLE "events" ADD COLUMN "show_on_events_page" boolean DEFAULT false;
  ALTER TABLE "events" ADD COLUMN "registration_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "registration_label" varchar DEFAULT 'ثبت نام در رویداد';
  ALTER TABLE "events" ADD COLUMN "registration_href" varchar DEFAULT '/dashboard/events';
  ALTER TABLE "events" ADD COLUMN "countdown_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "countdown_target_date" timestamp(3) with time zone;
  ALTER TABLE "events" ADD COLUMN "countdown_label" varchar DEFAULT 'زمان باقی‌مانده تا رویداد';
  ALTER TABLE "events" ADD COLUMN "countdown_days_label" varchar DEFAULT 'روز';
  ALTER TABLE "events" ADD COLUMN "countdown_hours_label" varchar DEFAULT 'ساعت';
  ALTER TABLE "events" ADD COLUMN "countdown_minutes_label" varchar DEFAULT 'دقیقه';
  ALTER TABLE "events" ADD COLUMN "countdown_seconds_label" varchar DEFAULT 'ثانیه';
  ALTER TABLE "events" ADD COLUMN "metadata_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "metadata_label" varchar DEFAULT 'مشخصات رویداد';
  ALTER TABLE "events" ADD COLUMN "metadata_date_label" varchar DEFAULT 'تاریخ برگزاری';
  ALTER TABLE "events" ADD COLUMN "metadata_time_label" varchar DEFAULT 'ساعت برگزاری';
  ALTER TABLE "events" ADD COLUMN "metadata_location_label" varchar DEFAULT 'محل برگزاری';
  ALTER TABLE "events" ADD COLUMN "metadata_type_label" varchar DEFAULT 'نوع رویداد';
  ALTER TABLE "events" ADD COLUMN "metadata_event_type" varchar DEFAULT 'رویداد تخصصی';
  ALTER TABLE "events" ADD COLUMN "metadata_time_separator" varchar DEFAULT 'تا';
  ALTER TABLE "events" ADD COLUMN "metadata_date_text" varchar;
  ALTER TABLE "events" ADD COLUMN "metadata_time_text" varchar;
  ALTER TABLE "events" ADD COLUMN "about_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "about_title" varchar DEFAULT 'درباره این رویداد';
  ALTER TABLE "events" ADD COLUMN "about_description" varchar DEFAULT '';
  ALTER TABLE "events" ADD COLUMN "about_image_id" integer;
  ALTER TABLE "events" ADD COLUMN "opportunities_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "opportunities_title" varchar DEFAULT 'این رویداد چه فرصتی برای شما ایجاد می‌کند؟';
  ALTER TABLE "events" ADD COLUMN "opportunities_description" varchar DEFAULT 'ما در این کارخانه، نه فقط فضای کار، که «مسیر موفقیت» را برای فناوران ترسیم می‌کنیم.';
  ALTER TABLE "events" ADD COLUMN "opportunities_image_id" integer;
  ALTER TABLE "events" ADD COLUMN "audience_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "audience_title" varchar DEFAULT 'مخاطبان رویداد';
  ALTER TABLE "events" ADD COLUMN "audience_description" varchar DEFAULT 'این رویداد برای شرکت‌های دانش‌بنیان، فناور و مجموعه‌هایی طراحی شده است که راهکار، محصول یا فناوری مرتبط با نیازهای صنعت انرژی ارائه می‌کنند.';
  ALTER TABLE "events" ADD COLUMN "steps_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "steps_title" varchar DEFAULT 'مراحل شرکت در رویداد';
  ALTER TABLE "events" ADD COLUMN "steps_description" varchar DEFAULT 'ما در این کارخانه، نه فقط فضای کار، که «مسیر موفقیت» را برای فناوران ترسیم می‌کنیم.';
  ALTER TABLE "events" ADD COLUMN "guests_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "guests_title" varchar DEFAULT 'مهمانان رویداد';
  ALTER TABLE "events" ADD COLUMN "guests_description" varchar DEFAULT 'ما در این کارخانه، نه فقط فضای کار، که «مسیر موفقیت» را برای فناوران ترسیم می‌کنیم.';
  ALTER TABLE "events" ADD COLUMN "sponsors_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "sponsors_title" varchar DEFAULT 'حامیان';
  ALTER TABLE "events" ADD COLUMN "sponsors_description" varchar DEFAULT 'حامیان پیشرو در صنعت کشور';
  ALTER TABLE "events" ADD COLUMN "gallery_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "gallery_title" varchar DEFAULT 'گالری تصاویر';
  ALTER TABLE "events" ADD COLUMN "gallery_description" varchar DEFAULT 'لحظاتی از رویداد های پیشین';
  ALTER TABLE "events" ADD COLUMN "schedule_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "schedule_title" varchar DEFAULT 'برنامه رویداد';
  ALTER TABLE "events" ADD COLUMN "schedule_description" varchar DEFAULT 'این رویداد برای شرکت‌های دانش‌بنیان،';
  ALTER TABLE "events" ADD COLUMN "venue_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "venue_title" varchar DEFAULT 'اطلاعات برگزاری';
  ALTER TABLE "events" ADD COLUMN "venue_description" varchar DEFAULT '';
  ALTER TABLE "events" ADD COLUMN "venue_map_image_id" integer;
  ALTER TABLE "events" ADD COLUMN "venue_location_label" varchar DEFAULT 'محل';
  ALTER TABLE "events" ADD COLUMN "venue_address_label" varchar DEFAULT 'آدرس';
  ALTER TABLE "events" ADD COLUMN "venue_date_label" varchar DEFAULT 'تاریخ برگزاری';
  ALTER TABLE "events" ADD COLUMN "venue_address" varchar;
  ALTER TABLE "events" ADD COLUMN "venue_map_href" varchar;
  ALTER TABLE "events" ADD COLUMN "call_to_action_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "call_to_action_title" varchar DEFAULT 'مشتاق همکاری با شما هستیم';
  ALTER TABLE "events" ADD COLUMN "call_to_action_description" varchar DEFAULT 'در صورت تمایل به همکاری با کارخانه نوآوری صنایع انرژی بوشهر رزومه خود را برای ما بفرستید.';
  ALTER TABLE "events" ADD COLUMN "call_to_action_button_label" varchar DEFAULT 'ارسال رزومه';
  ALTER TABLE "events" ADD COLUMN "call_to_action_button_href" varchar DEFAULT '/cooperation';
  ALTER TABLE "events" ADD COLUMN "call_to_action_background_image_id" integer;
  ALTER TABLE "events" ADD COLUMN "faq_enabled" boolean DEFAULT true;
  ALTER TABLE "events" ADD COLUMN "faq_title" varchar DEFAULT 'سوالات پر تکرار';
  ALTER TABLE "events" ADD COLUMN "faq_description" varchar DEFAULT 'از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه مدیریت می‌شود.';
  ALTER TABLE "events_about_paragraphs" ADD CONSTRAINT "events_about_paragraphs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_opportunities_items" ADD CONSTRAINT "events_opportunities_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_audience_items" ADD CONSTRAINT "events_audience_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_steps_items" ADD CONSTRAINT "events_steps_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_guests_items" ADD CONSTRAINT "events_guests_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_guests_items" ADD CONSTRAINT "events_guests_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_sponsors_items" ADD CONSTRAINT "events_sponsors_items_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_sponsors_items" ADD CONSTRAINT "events_sponsors_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_gallery_items" ADD CONSTRAINT "events_gallery_items_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_gallery_items" ADD CONSTRAINT "events_gallery_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_schedule_buttons" ADD CONSTRAINT "events_schedule_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_schedule_items" ADD CONSTRAINT "events_schedule_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_faq_items" ADD CONSTRAINT "events_faq_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "events_about_paragraphs_order_idx" ON "events_about_paragraphs" USING btree ("_order");
  CREATE INDEX "events_about_paragraphs_parent_id_idx" ON "events_about_paragraphs" USING btree ("_parent_id");
  CREATE INDEX "events_opportunities_items_order_idx" ON "events_opportunities_items" USING btree ("_order");
  CREATE INDEX "events_opportunities_items_parent_id_idx" ON "events_opportunities_items" USING btree ("_parent_id");
  CREATE INDEX "events_audience_items_order_idx" ON "events_audience_items" USING btree ("_order");
  CREATE INDEX "events_audience_items_parent_id_idx" ON "events_audience_items" USING btree ("_parent_id");
  CREATE INDEX "events_steps_items_order_idx" ON "events_steps_items" USING btree ("_order");
  CREATE INDEX "events_steps_items_parent_id_idx" ON "events_steps_items" USING btree ("_parent_id");
  CREATE INDEX "events_guests_items_order_idx" ON "events_guests_items" USING btree ("_order");
  CREATE INDEX "events_guests_items_parent_id_idx" ON "events_guests_items" USING btree ("_parent_id");
  CREATE INDEX "events_guests_items_image_idx" ON "events_guests_items" USING btree ("image_id");
  CREATE INDEX "events_sponsors_items_order_idx" ON "events_sponsors_items" USING btree ("_order");
  CREATE INDEX "events_sponsors_items_parent_id_idx" ON "events_sponsors_items" USING btree ("_parent_id");
  CREATE INDEX "events_sponsors_items_logo_idx" ON "events_sponsors_items" USING btree ("logo_id");
  CREATE INDEX "events_gallery_items_order_idx" ON "events_gallery_items" USING btree ("_order");
  CREATE INDEX "events_gallery_items_parent_id_idx" ON "events_gallery_items" USING btree ("_parent_id");
  CREATE INDEX "events_gallery_items_image_idx" ON "events_gallery_items" USING btree ("image_id");
  CREATE INDEX "events_schedule_buttons_order_idx" ON "events_schedule_buttons" USING btree ("_order");
  CREATE INDEX "events_schedule_buttons_parent_id_idx" ON "events_schedule_buttons" USING btree ("_parent_id");
  CREATE INDEX "events_schedule_items_order_idx" ON "events_schedule_items" USING btree ("_order");
  CREATE INDEX "events_schedule_items_parent_id_idx" ON "events_schedule_items" USING btree ("_parent_id");
  CREATE INDEX "events_faq_items_order_idx" ON "events_faq_items" USING btree ("_order");
  CREATE INDEX "events_faq_items_parent_id_idx" ON "events_faq_items" USING btree ("_parent_id");
  ALTER TABLE "events" ADD CONSTRAINT "events_about_image_id_media_id_fk" FOREIGN KEY ("about_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_opportunities_image_id_media_id_fk" FOREIGN KEY ("opportunities_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_venue_map_image_id_media_id_fk" FOREIGN KEY ("venue_map_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_call_to_action_background_image_id_media_id_fk" FOREIGN KEY ("call_to_action_background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "events_about_about_image_idx" ON "events" USING btree ("about_image_id");
  CREATE INDEX "events_opportunities_opportunities_image_idx" ON "events" USING btree ("opportunities_image_id");
  CREATE INDEX "events_venue_venue_map_image_idx" ON "events" USING btree ("venue_map_image_id");
  CREATE INDEX "events_call_to_action_call_to_action_background_image_idx" ON "events" USING btree ("call_to_action_background_image_id");`);

  // Move the previous page content into editable CMS records once. The public
  // renderer reads only these records, so clearing an array stays cleared.
  const EVENT_ABOUT_PARAGRAPHS = [
    "این رویداد با هدف ایجاد ارتباط مؤثر و مستقیم میان شرکت‌های فناور، دانش‌بنیان و فعالان زیست‌بوم نوآوری با صنایع بزرگ نفت، گاز و پتروشیمی برگزار می‌شود. حضور کارخانه نوآوری نفت، گاز و پتروشیمی بوشهر در مجاورت قطب انرژی کشور، این فرصت را فراهم می‌کند تا شرکت‌های فناور بتوانند بدون واسطه با مدیران، تصمیم‌گیران و کارشناسان فنی صنایع و مجتمع‌های بزرگ انرژی ارتباط برقرار کرده و توانمندی‌ها و راهکارهای خود را متناسب با نیازهای واقعی صنعت معرفی کنند.",
    "در این رویداد، تمرکز صرفاً بر معرفی محصولات و دستاوردهای فناورانه نیست؛ بلکه تلاش می‌شود زمینه‌ای برای شناسایی چالش‌ها و نیازهای واقعی صنعت، بررسی راهکارهای موجود و شکل‌گیری ارتباطات حرفه‌ای و همکاری‌های مشترک فراهم شود. شرکت‌های حاضر می‌توانند با ارائه ظرفیت‌ها، محصولات و راهکارهای خود، فرصت‌های جدیدی برای همکاری با صنایع، پیمانکاران و سایر بازیگران زنجیره ارزش صنعت انرژی شناسایی کنند.",
  ] as const;
  const EVENT_SCHEDULE = [
    { time: "۹:۰۰ – ۱۰:۰۰", title: "ثبت نام" },
    { time: "۱۱:۰۰ – ۱۲:۰۰", title: "ثبت نام" },
    { time: "۱۴:۰۰ – ۱۵:۰۰", title: "ثبت نام" },
    { time: "۱۶:۰۰ – ۱۷:۰۰", title: "ثبت نام" },
  ] as const;
  const EVENT_FAQ = [
    {
      title: "متن نمونه سوال",
      description:
        "سبز تفکر محتوا ارزیابی لورم شناخت ارتباط ایجاد تجدیدپذیر! دهنده نامفهوم ایپسوم آنلاین دادگاه عدالت عدالت محصول فضا زبان. پویایی علمی مکان آزادی تناسب صداقت تناسب الگوریتم آبی دادگاه. پرسش مشارکت نرم‌افزار انتشار برنامه‌نویسی ذهن طبیعت استاندارد.",
    },
    ...Array.from({ length: 4 }, () => ({ title: "متن نمونه سوال", description: "" })),
  ] as const;
  const SPONSORS = [
    "صندوق کارآفرینی بوشهر",
    "صندوق کارآفرینی بوشهر",
    "صندوق کارآفرینی بوشهر",
    "استارتاپ‌ها",
    "تیم‌های نوآور",
    "کارخانه نوآوری نفت و گاز",
  ] as const;
  const events = await payload.find({ collection: "events", depth: 0, pagination: false, req });
  if (!events.docs.length) return;

  const upload = async (filename: string, alt: string): Promise<number | undefined> => {
    const filePath = path.resolve(process.cwd(), "public/figma/event-detail", filename);
    if (!existsSync(filePath)) {
      payload.logger.warn(`Event page asset missing: ${filename}. Upload it in the CMS.`);
      return undefined;
    }
    const name = `event-detail-${filename}`;
    const existing = await payload.find({
      collection: "media",
      where: { filename: { equals: name } },
      limit: 1,
      depth: 0,
      req,
    });
    if (existing.docs[0]) return existing.docs[0].id;
    const data = readFileSync(filePath);
    const media = await payload.create({
      collection: "media",
      data: { alt },
      req,
      file: {
        data,
        name,
        size: data.length,
        mimetype: filename.endsWith(".jpeg") ? "image/jpeg" : "image/png",
      },
    });
    return media.id;
  };
  const hero = await upload("hero.png", "پوستر رویداد");
  const about = await upload("about.png", "درباره رویداد");
  const opportunities = await upload("opportunities.png", "فرصت‌های رویداد");
  const venueMap = await upload("venue-map.png", "نقشه محل برگزاری");
  const guest1 = await upload("guest-1.jpeg", "مهمان رویداد");
  const guest2 = await upload("guest-2.jpeg", "مهمان رویداد");
  const gallery: { image: number }[] = [];
  for (let index = 1; index <= 5; index++) {
    const image = await upload(`gallery-${index}.png`, `تصویر ${index} از گالری رویداد`);
    if (image) gallery.push({ image });
  }
  // Payload field defaults initialize scalar labels. Array defaults need to be
  // persisted explicitly for pre-existing events.
  const OPPORTUNITIES = [
    {
      description: "امکان ارائه راهکار و مذاکره مستقیم با مدیران و کارشناسان صنایع مرتبط.",
      title: "ارتباط مستقیم با صنعت",
    },
    { title: "معرفی توانمندی‌ها" },
    { title: "شناسایی فرصت‌های همکاری" },
    { title: "توسعه بازار" },
  ] as const;
  const AUDIENCES = ["شرکت‌های دانش‌بنیان", "شرکت‌های فناور", "استارتاپ‌ها", "تیم‌های نوآور"] as const;
  const REGISTRATION_STEPS = [
    {
      description: "اطلاعات شرکت و نماینده خود را ثبت کنید.",
      title: "ثبت نام",
    },
    {
      description: "توانمندی‌ها، محصولات و سوابق مرتبط خود را معرفی کنید.",
      title: "ارسال اطلاعات و رزومه",
    },
    {
      description: "اطلاعات ارسالی توسط تیم برگزارکننده بررسی می‌شود.",
      title: "بررسی و ارزیابی",
    },
    {
      description: "نتیجه بررسی و نحوه حضور به شرکت اطلاع داده می‌شود.",
      title: "اعلام نتایج",
    },
  ] as const;
  const defaults: Partial<Event> = {
    opportunities: { items: OPPORTUNITIES.map((item) => ({ ...item })) },
    audience: { items: AUDIENCES.map((title) => ({ title })) },
    steps: { items: REGISTRATION_STEPS.map((item) => ({ ...item })) },
  };
  for (const event of events.docs) {
    await payload.update({
      collection: "events",
      id: event.id,
      req,
      data: {
        ...defaults,
        featuredImage: event.featuredImage || hero,
        about: {
          ...defaults.about,
          image: about,
          paragraphs: EVENT_ABOUT_PARAGRAPHS.map((text) => ({ text })),
        },
        opportunities: { ...defaults.opportunities, image: opportunities },
        guests: {
          ...defaults.guests,
          items: [guest1, guest2, guest1, guest2].map((image) => ({
            name: "نام و نام خانوادگی",
            role: "سمت",
            image,
          })),
        },
        sponsors: { ...defaults.sponsors, items: SPONSORS.map((name) => ({ name })) },
        gallery: { ...defaults.gallery, items: gallery },
        schedule: {
          ...defaults.schedule,
          buttons: [{ label: "ثبت نام در رویداد", href: "/dashboard/events", primary: true }],
          items: EVENT_SCHEDULE.map((item) => ({
            ...item,
            description: "اطلاعات شرکت و نماینده خود را ثبت کنید",
          })),
        },
        venue: { ...defaults.venue, mapImage: venueMap },
        faq: {
          ...defaults.faq,
          items: EVENT_FAQ.map((item) => ({ question: item.title, answer: item.description })),
        },
      },
    });
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "events_about_paragraphs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_opportunities_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_audience_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_steps_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_guests_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_sponsors_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_gallery_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_schedule_buttons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_schedule_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_faq_items" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "events_about_paragraphs" CASCADE;
  DROP TABLE "events_opportunities_items" CASCADE;
  DROP TABLE "events_audience_items" CASCADE;
  DROP TABLE "events_steps_items" CASCADE;
  DROP TABLE "events_guests_items" CASCADE;
  DROP TABLE "events_sponsors_items" CASCADE;
  DROP TABLE "events_gallery_items" CASCADE;
  DROP TABLE "events_schedule_buttons" CASCADE;
  DROP TABLE "events_schedule_items" CASCADE;
  DROP TABLE "events_faq_items" CASCADE;
  ALTER TABLE "events" DROP CONSTRAINT "events_about_image_id_media_id_fk";
  
  ALTER TABLE "events" DROP CONSTRAINT "events_opportunities_image_id_media_id_fk";
  
  ALTER TABLE "events" DROP CONSTRAINT "events_venue_map_image_id_media_id_fk";
  
  ALTER TABLE "events" DROP CONSTRAINT "events_call_to_action_background_image_id_media_id_fk";
  
  DROP INDEX "events_about_about_image_idx";
  DROP INDEX "events_opportunities_opportunities_image_idx";
  DROP INDEX "events_venue_venue_map_image_idx";
  DROP INDEX "events_call_to_action_call_to_action_background_image_idx";
  ALTER TABLE "events" DROP COLUMN "show_on_events_page";
  ALTER TABLE "events" DROP COLUMN "registration_enabled";
  ALTER TABLE "events" DROP COLUMN "registration_label";
  ALTER TABLE "events" DROP COLUMN "registration_href";
  ALTER TABLE "events" DROP COLUMN "countdown_enabled";
  ALTER TABLE "events" DROP COLUMN "countdown_target_date";
  ALTER TABLE "events" DROP COLUMN "countdown_label";
  ALTER TABLE "events" DROP COLUMN "countdown_days_label";
  ALTER TABLE "events" DROP COLUMN "countdown_hours_label";
  ALTER TABLE "events" DROP COLUMN "countdown_minutes_label";
  ALTER TABLE "events" DROP COLUMN "countdown_seconds_label";
  ALTER TABLE "events" DROP COLUMN "metadata_enabled";
  ALTER TABLE "events" DROP COLUMN "metadata_label";
  ALTER TABLE "events" DROP COLUMN "metadata_date_label";
  ALTER TABLE "events" DROP COLUMN "metadata_time_label";
  ALTER TABLE "events" DROP COLUMN "metadata_location_label";
  ALTER TABLE "events" DROP COLUMN "metadata_type_label";
  ALTER TABLE "events" DROP COLUMN "metadata_event_type";
  ALTER TABLE "events" DROP COLUMN "metadata_time_separator";
  ALTER TABLE "events" DROP COLUMN "metadata_date_text";
  ALTER TABLE "events" DROP COLUMN "metadata_time_text";
  ALTER TABLE "events" DROP COLUMN "about_enabled";
  ALTER TABLE "events" DROP COLUMN "about_title";
  ALTER TABLE "events" DROP COLUMN "about_description";
  ALTER TABLE "events" DROP COLUMN "about_image_id";
  ALTER TABLE "events" DROP COLUMN "opportunities_enabled";
  ALTER TABLE "events" DROP COLUMN "opportunities_title";
  ALTER TABLE "events" DROP COLUMN "opportunities_description";
  ALTER TABLE "events" DROP COLUMN "opportunities_image_id";
  ALTER TABLE "events" DROP COLUMN "audience_enabled";
  ALTER TABLE "events" DROP COLUMN "audience_title";
  ALTER TABLE "events" DROP COLUMN "audience_description";
  ALTER TABLE "events" DROP COLUMN "steps_enabled";
  ALTER TABLE "events" DROP COLUMN "steps_title";
  ALTER TABLE "events" DROP COLUMN "steps_description";
  ALTER TABLE "events" DROP COLUMN "guests_enabled";
  ALTER TABLE "events" DROP COLUMN "guests_title";
  ALTER TABLE "events" DROP COLUMN "guests_description";
  ALTER TABLE "events" DROP COLUMN "sponsors_enabled";
  ALTER TABLE "events" DROP COLUMN "sponsors_title";
  ALTER TABLE "events" DROP COLUMN "sponsors_description";
  ALTER TABLE "events" DROP COLUMN "gallery_enabled";
  ALTER TABLE "events" DROP COLUMN "gallery_title";
  ALTER TABLE "events" DROP COLUMN "gallery_description";
  ALTER TABLE "events" DROP COLUMN "schedule_enabled";
  ALTER TABLE "events" DROP COLUMN "schedule_title";
  ALTER TABLE "events" DROP COLUMN "schedule_description";
  ALTER TABLE "events" DROP COLUMN "venue_enabled";
  ALTER TABLE "events" DROP COLUMN "venue_title";
  ALTER TABLE "events" DROP COLUMN "venue_description";
  ALTER TABLE "events" DROP COLUMN "venue_map_image_id";
  ALTER TABLE "events" DROP COLUMN "venue_location_label";
  ALTER TABLE "events" DROP COLUMN "venue_address_label";
  ALTER TABLE "events" DROP COLUMN "venue_date_label";
  ALTER TABLE "events" DROP COLUMN "venue_address";
  ALTER TABLE "events" DROP COLUMN "venue_map_href";
  ALTER TABLE "events" DROP COLUMN "call_to_action_enabled";
  ALTER TABLE "events" DROP COLUMN "call_to_action_title";
  ALTER TABLE "events" DROP COLUMN "call_to_action_description";
  ALTER TABLE "events" DROP COLUMN "call_to_action_button_label";
  ALTER TABLE "events" DROP COLUMN "call_to_action_button_href";
  ALTER TABLE "events" DROP COLUMN "call_to_action_background_image_id";
  ALTER TABLE "events" DROP COLUMN "faq_enabled";
  ALTER TABLE "events" DROP COLUMN "faq_title";
  ALTER TABLE "events" DROP COLUMN "faq_description";`);
}
