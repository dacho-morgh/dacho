import path from 'path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig, PayloadRequest } from 'payload'
import sharp from 'sharp'
import { defaultLexical } from './fields/defaultLexical'
import { Categories } from './collections/Categories'
import { Events } from './collections/Events'
import { Exhibitions } from './collections/Exhibitions'
import { FAQ } from './collections/FAQ'
import { Media } from './collections/Media'
import { News } from './collections/News'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Reviews } from './collections/Reviews'
import { Roles } from './collections/Roles'
import { Services } from './collections/Services'
import { Sponsors } from './collections/Sponsors'
import { Users } from './collections/Users'
import { openApiEndpoint } from './endpoints/openapi'
import { Footer } from './Footer/config'
import { ContactUs } from './globals/ContactUs'
import { SiteSettings } from './globals/SiteSettings'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { getServerSideURL } from './utilities/getURL'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Critical env vars must be present — fail fast rather than silently falling
// back to an empty secret / connection string.
const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

// PAYLOAD_SECRET comes from a mounted file (Docker secret) when
// PAYLOAD_SECRET_FILE is set, else from the PAYLOAD_SECRET env var.
const resolveSecret = (): string => {
  if (process.env.PAYLOAD_SECRET_FILE) {
    return readFileSync(process.env.PAYLOAD_SECRET_FILE, 'utf8').trim()
  }
  return requireEnv('PAYLOAD_SECRET')
}

const payloadSecret = resolveSecret()
const databaseURL = requireEnv('DATABASE_URL')
const siteName = 'کارخانه نوآوری صنایع انرژی بوشهر'

export default buildConfig({
  admin: {
    meta: {
      applicationName: siteName,
      titleSuffix: ` | ${siteName}`,
      manifest: '/favicon/site.webmanifest',
      icons: {
        icon: [
          { url: '/favicon/favicon.ico', sizes: 'any' },
          { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
          { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        ],
        apple: [{ url: '/favicon/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
        shortcut: ['/favicon/favicon.ico'],
      },
      robots: {
        index: false,
        follow: false,
      },
      openGraph: {
        images: [
          {
            url: '/og-image.png',
            width: 1688,
            height: 932,
            alt: 'مسیر رشد کسب‌وکارها، از فرصت تا موفقیت',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        images: ['/og-image.png'],
      },
      defaultOGImageType: 'off',
    },
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: databaseURL,
    },
    // Migrations live in this package (cms-core owns the schema). The default
    // resolver looks relative to process.cwd(), which is the fused frontend app
    // during `next build` — so pin it here or production builds skip migrations
    // and hit "relation does not exist" on a fresh database.
    migrationDir: path.resolve(dirname, 'migrations'),
    // Disable Payload's destructive dev schema push. The CMS (`public`) and the
    // backend domain (`dashboard` schema) share one Postgres database; the push
    // introspects the *whole* database and tries to drop the backend's foreign
    // tables/enums, erroring with "type public.letter_type does not exist".
    // Rely on explicit `payload migrate` everywhere instead — the prod
    // entrypoint (docker-entrypoint.sh) already runs it on startup.
    push: false,
  }),
  collections: [
    Pages,
    Posts,
    Media,
    Categories,
    Users,
    Roles,
    FAQ,
    Reviews,
    News,
    Sponsors,
    Services,
    Events,
    Exhibitions,
  ],
  // Explicit serverURL: without this Payload derives it from the inbound
  // request, which is plain HTTP behind Caddy (TLS terminated). That makes
  // `serverURL` (and the CSRF allowlist) `http://…` while the browser sends
  // `Origin: https://…`, so cookie auth is rejected on every write (403).
  // Pin it to the public HTTPS origin instead.
  serverURL: getServerSideURL(),
  cors: [getServerSideURL(), 'http://localhost:8080', 'http://127.0.0.1:8080'].filter(Boolean),
  globals: [Header, Footer, ContactUs, SiteSettings],
  endpoints: [openApiEndpoint],
  plugins,
  secret: payloadSecret,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [],
  },
})
