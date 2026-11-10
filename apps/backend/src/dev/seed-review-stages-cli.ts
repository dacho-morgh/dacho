/*
 * Local-dev seed for the request page's design review (#288). Runs the backend in
 * this process against the configured database and CMS, then drives the dashboard
 * API as the dev personnel accounts (see `review-stages-seed.ts`).
 *
 *   pnpm --filter @dacho/frontend seed:dev-review   # accounts, company profile (CMS)
 *   pnpm --filter @dacho/backend seed:dev-review    # this script
 *
 * It refuses anything but a loopback database named in DEV_DATABASES and a
 * loopback CMS, and it applies pending backend migrations first, as the backend
 * does when it starts. Documented in README.md («Design-review data for the request page»).
 */
import { randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'

import { PayloadCompanyStore } from '../auth/company-store.js'
import { PayloadUserStore } from '../auth/payload-user-store.js'
import type { User } from '../auth/user-store.js'
import { createApp } from '../app.js'
import { PayloadServiceCatalog } from '../catalog/payload-service-catalog.js'
import { createPool } from '../db.js'
import { runMigrations } from '../db/migrate.js'
import { PrivateDocumentStorage } from '../documents/storage.js'
import { PayloadExhibitionStore } from '../exhibitions/exhibition-store.js'
import { JwtSigner } from '../jwt.js'
import { InMemoryCodeStore } from '../otp/code-store.js'
import { ConsoleOtpDelivery } from '../otp/console-delivery.js'
import { assertLocalDevTarget } from './local-dev-guard.js'
import { httpSeedClient, seedReviewStages, SeedError, type SeedPeople } from './review-stages-seed.js'

const DOMAIN = 'dacho.localhost.test'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new SeedError(`Missing ${name}; run with the backend's .env (pnpm --filter @dacho/backend seed:dev-review).`)
  return value
}

async function main(): Promise<void> {
  const databaseUrl = required('DATABASE_URL')
  const payloadUrl = required('PAYLOAD_URL')
  const payloadApiKey = required('PAYLOAD_API_KEY')
  assertLocalDevTarget({ databaseUrl, payloadUrl, nodeEnv: process.env.NODE_ENV })

  const cms = { baseUrl: payloadUrl, apiKey: payloadApiKey }
  const userStore = new PayloadUserStore(cms)
  const pick = async (role: string, email: string): Promise<User> => {
    const users = (await userStore.list({ operationalRole: role })).filter((user) => user.isActive !== false)
    const found = users.find((user) => user.email?.toLowerCase() === email)
    if (!found) throw new SeedError(`No active ${role} account ${email}. Run the frontend seed \`seed:dev-review\` first.`)
    return found
  }
  const ownerEmail = (process.env.DEV_SEED_OWNER_EMAIL ?? `admin@${DOMAIN}`).toLowerCase()
  const owners = (await userStore.list({ operationalRole: 'system-owner' })).filter((user) => user.isActive !== false)
  const owner = owners.find((user) => user.email?.toLowerCase() === ownerEmail) ?? owners[0]
  if (!owner) throw new SeedError('No active system-owner account exists; create one with `pnpm --filter @dacho/frontend create:admin`.')

  const people: SeedPeople = {
    owner: owner.id,
    secretariat: (await pick('central-secretariat', `central-secretariat@${DOMAIN}`)).id,
    chief: (await pick('chief-reviewer', `chief-reviewer@${DOMAIN}`)).id,
    investment: (await pick('investment-reviewer', `investment-reviewer@${DOMAIN}`)).id,
    employer: (await pick('employer-reviewer', `employer-reviewer@${DOMAIN}`)).id,
    reviewers: [
      (await pick('reviewer', `reviewer@${DOMAIN}`)).id,
      (await pick('reviewer', `reviewer-2@${DOMAIN}`)).id,
      (await pick('reviewer', `reviewer-3@${DOMAIN}`)).id,
    ],
    representative: (await pick('representative', `representative@${DOMAIN}`)).id,
  }

  const auth = { Authorization: `users API-Key ${payloadApiKey}` }
  const services = await fetch(`${payloadUrl.replace(/\/+$/, '')}/api/services?where[key][equals]=events&limit=1&depth=0`, { headers: auth })
  const serviceId = ((await services.json()) as { docs?: { id: unknown }[] }).docs?.[0]?.id
  if (serviceId === undefined) throw new SeedError('The «events» service is missing; run `pnpm --filter @dacho/frontend seed:dashboard`.')

  const pool = createPool(databaseUrl)
  await runMigrations(databaseUrl)
  const storage = new PrivateDocumentStorage(process.env.PRIVATE_DOCUMENTS_DIR || `${process.cwd()}/.private-documents`)
  await storage.ensure()
  const publicRecords = new PayloadExhibitionStore(cms)
  const proxySecret = randomBytes(24).toString('hex')
  const app = createApp({
    pool,
    userStore,
    companyStore: new PayloadCompanyStore(cms),
    serviceCatalog: new PayloadServiceCatalog(cms),
    jwt: await JwtSigner.create('dev-seed'),
    codeStore: new InMemoryCodeStore(),
    delivery: new ConsoleOtpDelivery(),
    proxySecret,
    privateDocumentStorage: storage,
    exhibitionStore: publicRecords,
    publicRecords,
  })
  // Loopback only and for this process's lifetime; the secret is random per run.
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const { port } = server.address() as AddressInfo

  try {
    const result = await seedReviewStages(httpSeedClient(`http://127.0.0.1:${port}`, proxySecret), people, {
      serviceId: String(serviceId),
      log: (line) => console.log(line),
      afterEvent: async ({ publicEventId }) => {
        if (!publicEventId) return
        // A poster for the event card: the newest CMS media file, when the page has none yet.
        try {
          const page = await fetch(`${payloadUrl}/api/events/${publicEventId}?depth=0`, { headers: auth })
          if (!page.ok || ((await page.json()) as { featuredImage?: unknown }).featuredImage) return
          const media = await fetch(`${payloadUrl}/api/media?limit=1&sort=-createdAt&depth=0`, { headers: auth })
          const mediaId = ((await media.json()) as { docs?: { id: unknown }[] }).docs?.[0]?.id
          if (mediaId === undefined) return
          await fetch(`${payloadUrl}/api/events/${publicEventId}?depth=0`, {
            method: 'PATCH',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ featuredImage: mediaId }),
          })
          console.log('• event poster attached')
        } catch {
          console.log('• event poster skipped (CMS media unavailable)')
        }
      },
    })
    console.log('\nDesign-review seed complete:')
    console.log(`  event      ${result.eventId}`)
    for (const [stage, id] of Object.entries(result.requests)) console.log(`  ${stage.padEnd(10)} /dashboard/requests/${id}`)
  } finally {
    server.close()
    await pool.end()
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof SeedError ? `seed:dev-review: ${error.message}` : error)
    process.exit(1)
  })
