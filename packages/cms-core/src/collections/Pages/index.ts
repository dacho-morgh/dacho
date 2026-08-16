import type { CollectionConfig } from 'payload'

import { authenticated } from '@cms-core/access/authenticated'
import { authenticatedOrPublished } from '@cms-core/access/authenticatedOrPublished'
import { Archive } from '@cms-core/blocks/ArchiveBlock/config'
import { CallToAction } from '@cms-core/blocks/CallToAction/config'
import { Content } from '@cms-core/blocks/Content/config'
import { FormBlock } from '@cms-core/blocks/Form/config'
import { MediaBlock } from '@cms-core/blocks/MediaBlock/config'
import { EventsBlock } from '@cms-core/blocks/Events/config'
import { FAQBlock } from '@cms-core/blocks/FAQ/config'
import { NewsBlock } from '@cms-core/blocks/News/config'
import { ReviewsBlock } from '@cms-core/blocks/Reviews/config'
import { ServicesBlock } from '@cms-core/blocks/Services/config'
import { SponsorsBlock } from '@cms-core/blocks/Sponsors/config'
import { StatsBlock } from '@cms-core/blocks/Stats/config'
import { hero } from '@cms-core/heros/config'
import { slugField } from 'payload'
import { populatePublishedAt } from '@cms-core/hooks/populatePublishedAt'
import { generatePreviewPath } from '@cms-core/utilities/generatePreviewPath'
import { revalidateDelete, revalidatePage } from './hooks/revalidatePage'

import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

export const Pages: CollectionConfig<'pages'> = {
  slug: 'pages',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  // This config controls what's populated by default when a page is referenced
  // https://payloadcms.com/docs/queries/select#defaultpopulate-collection-config-property
  // Type safe if the collection slug generic is passed to `CollectionConfig` - `CollectionConfig<'pages'>
  defaultPopulate: {
    title: true,
    slug: true,
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          slug: data?.slug,
          collection: 'pages',
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        slug: data?.slug as string,
        collection: 'pages',
        req,
      }),
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      type: 'tabs',
      tabs: [
        {
          fields: [hero],
          label: 'Hero',
        },
        {
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              blocks: [CallToAction, Content, MediaBlock, Archive, FormBlock, ServicesBlock, NewsBlock, ReviewsBlock, FAQBlock, SponsorsBlock, EventsBlock, StatsBlock],
              required: true,
              admin: {
                initCollapsed: true,
              },
            },
          ],
          label: 'Content',
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
            }),
            MetaImageField({
              relationTo: 'media',
            }),

            MetaDescriptionField({}),
            PreviewField({
              // if the `generateUrl` function is configured
              hasGenerateFn: true,

              // field paths to match the target field for data
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'favicon',
      type: 'upload',
      relationTo: 'media',
      label: 'Favicon',
      admin: {
        position: 'sidebar',
        description: 'Per-page favicon. Overrides the site-wide favicon from Site Settings when set.',
      },
    },
    slugField(),
  ],
  hooks: {
    afterChange: [revalidatePage],
    beforeChange: [populatePublishedAt],
    afterDelete: [revalidateDelete],
  },
  versions: {
    drafts: {
      autosave: {
        interval: 100, // We set this interval for optimal live preview
      },
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
}
