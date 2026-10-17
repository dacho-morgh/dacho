import type { GlobalConfig } from "payload";
import { revalidatePath } from "next/cache";
import { hasContentRole } from "@cms-core/access/editorContent";

const selection = (name: string, label: string, relationTo: "news" | "posts", hasMany = true) => ({
  name,
  label,
  type: "relationship" as const,
  relationTo,
  hasMany,
  admin: { description: "Drag selected items to set their display order." },
});

export const Mag: GlobalConfig = {
  slug: "mag",
  label: "Mag",
  admin: {
    group: "Pages",
    description:
      "Latest news automatically shows 8 published items, pinned first then newest. Latest articles automatically shows the 3 newest published articles. Other sections can be curated below.",
  },
  access: { read: () => true, update: hasContentRole },
  fields: [
    selection("hero", "Hero story", "news", false),
    // Preserve legacy saved selections while the public latest lists use collection queries.
    { ...selection("latestNews", "Latest news (ordered)", "news"), admin: { hidden: true } },
    { ...selection("latestArticles", "Latest articles (ordered)", "posts"), admin: { hidden: true } },
    {
      name: "hotHashtags",
      label: "Hot hashtags (ordered)",
      type: "array",
      fields: [{ name: "tag", type: "text", required: true }],
    },
    {
      name: "sections",
      type: "array",
      label: "Sections",
      labels: { singular: "Section", plural: "Sections" },
      admin: {
        description: "Add and drag sections to set their order on the Mag page.",
        initCollapsed: true,
      },
      fields: [
        { name: "title", type: "text", required: true, label: "Section title" },
        {
          name: "featured",
          type: "relationship",
          relationTo: ["news", "posts"],
          label: "Featured story",
          required: true,
        },
        {
          name: "stories",
          type: "relationship",
          relationTo: ["news", "posts"],
          hasMany: true,
          label: "Stories (ordered)",
          admin: { description: "Drag selected stories to set their display order." },
        },
        {
          name: "hashtag",
          type: "text",
          label: "View all hashtag",
          admin: { description: "Optional. Shows a link to matching Mag search results." },
        },
        {
          name: "reverseLayout",
          type: "checkbox",
          label: "Reverse featured story position",
          defaultValue: false,
        },
      ],
    },
    selection("featuredReport", "Featured report", "posts", false),
    {
      name: "mostRead",
      label: "Most read (ordered)",
      type: "relationship",
      relationTo: ["news", "posts"],
      hasMany: true,
      admin: { description: "Curated ranking. Drag items to reorder." },
    },
    {
      name: "editorPicks",
      label: "Editor picks (ordered)",
      type: "relationship",
      relationTo: ["news", "posts"],
      hasMany: true,
      admin: { description: "Drag items to set their display order." },
    },
    selection("eventNews", "Event news (ordered)", "news"),
    { name: "newsletterTitle", type: "text", defaultValue: "آخرین اخبار را از دست ندهید" },
    {
      name: "newsletterDescription",
      type: "textarea",
      defaultValue: "مهم‌ترین اخبار، گزارش‌ها و رویدادهای هفته را در ایمیل خود دریافت کنید.",
    },
    {
      name: "showRecruitment",
      type: "checkbox",
      defaultValue: true,
      label: "Show recruitment banner",
    },
  ],
  hooks: {
    afterChange: [
      ({ doc, req }) => {
        if (!req.context.disableRevalidate) revalidatePath("/mag");
        return doc;
      },
    ],
  },
};
