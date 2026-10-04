import type { CollectionConfig } from "payload";
import { anyone } from "@cms-core/access/anyone";
import { authenticated } from "@cms-core/access/authenticated";
import { eventPageFields } from "@cms-core/fields/eventPage";
import { getServerSideURL } from "@cms-core/utilities/getURL";

export const Events: CollectionConfig = {
  slug: "events",
  labels: {
    singular: "Event",
    plural: "Events",
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "startDate", "status", "createdAt"],
    preview: (data) =>
      data.id ? `${getServerSideURL()}/events/${encodeURIComponent(String(data.id))}` : null,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      label: "Title",
    },
    {
      name: "description",
      type: "richText",
      label: "Description",
    },
    {
      name: "featuredImage",
      type: "upload",
      relationTo: "media",
      label: "Poster / Hero Image",
    },
    {
      name: "location",
      type: "text",
      required: true,
      label: "Location",
    },
    {
      name: "startDate",
      type: "date",
      required: true,
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
      label: "Start Date",
    },
    {
      name: "endDate",
      type: "date",
      required: true,
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
      },
      label: "End Date",
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "upcoming",
      options: [
        { label: "Upcoming", value: "upcoming" },
        { label: "Ongoing", value: "ongoing" },
        { label: "Past", value: "past" },
      ],
      admin: {
        position: "sidebar",
      },
      label: "Status",
    },
    {
      type: "tabs",
      tabs: [
        { label: "Registration & labels", fields: eventPageFields.slice(0, 4) },
        { label: "About & audience", fields: eventPageFields.slice(4, 8) },
        { label: "Guests & media", fields: eventPageFields.slice(8, 11) },
        { label: "Program & venue", fields: eventPageFields.slice(11, 13) },
        { label: "Call to action & FAQ", fields: eventPageFields.slice(13) },
      ],
    },
  ],
};
