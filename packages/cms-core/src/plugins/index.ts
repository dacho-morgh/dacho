import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import { Plugin } from 'payload'
import { revalidateRedirects } from '@cms-core/hooks/revalidateRedirects'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { searchFields } from '@cms-core/search/fieldOverrides'
import { beforeSyncWithSearch } from '@cms-core/search/beforeSync'

import { News, Page, Post } from '@cms-core/payload-types'
import { adminOnly } from '@cms-core/access/adminOnly'
import { anyone } from '@cms-core/access/anyone'
import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import { getServerSideURL } from '@cms-core/utilities/getURL'

const SITE_NAME = 'کارخانه نوآوری صنایع انرژی بوشهر'

const generateTitle: GenerateTitle<News | Post | Page> = ({ doc }) => {
  return doc?.title ? `${doc.title} | ${SITE_NAME}` : SITE_NAME
}

const generateURL: GenerateURL<News | Post | Page> = ({ collectionSlug, doc }) => {
  const url = getServerSideURL()
  const collectionPath = collectionSlug === 'pages' ? '' : `/${collectionSlug}`

  return doc?.slug ? `${url}${collectionPath}/${doc.slug}` : url
}

export const plugins: Plugin[] = [
  redirectsPlugin({
    collections: ['pages', 'posts', 'news'],
    overrides: {
      // Redirects decide where the public site sends visitors, and the plugin
      // default for an un-overridden collection is "any logged-in user".
      access: {
        create: adminOnly,
        read: anyone,
        update: adminOnly,
        delete: adminOnly,
      },
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description: 'You will need to rebuild the website when changing this field.',
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formSubmissionOverrides: {
      // Submissions stay publicly creatable (the contact forms are the site's
      // own intake path) but are readable only by the CMS team — the plugin
      // default, "any logged-in user", would let an applicant read every
      // submission via REST. Nobody edits or deletes a submission: it is the
      // record of what a company sent.
      access: {
        read: hasCmsRole,
        update: adminOnly,
        delete: adminOnly,
      },
    },
    formOverrides: {
      // A form definition decides what the public site asks for and where it
      // posts, so it is admin territory rather than the content desk's.
      access: {
        read: anyone,
        create: adminOnly,
        update: adminOnly,
        delete: adminOnly,
      },
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  searchPlugin({
    collections: ['posts', 'news'],
    beforeSync: beforeSyncWithSearch,
    searchOverrides: {
      fields: ({ defaultFields }) => {
        return [...defaultFields, ...searchFields]
      },
    },
  }),
]
