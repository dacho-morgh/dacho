import 'dotenv/config'
import { randomBytes } from 'node:crypto'

import { getPayload } from 'payload'

import config from '../src/payload.config.js'

const SERVICE_EMAIL = 'backend@dacho.local'
const SERVICE_PHONE = process.env.SERVICE_ACCOUNT_PHONE ?? '09120000002'

async function main(): Promise<void> {
  const apiKey = process.env.SERVICE_ACCOUNT_API_KEY
  if (!apiKey) throw new Error('SERVICE_ACCOUNT_API_KEY must be supplied explicitly.')
  const password = randomBytes(16).toString('hex')
  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: SERVICE_EMAIL } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    const user = existing.docs[0]!
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { enableAPIKey: true, apiKey, password, sessions: [], resetPasswordToken: null, resetPasswordExpiration: null, operationalRole: 'representative', isActive: true, backendService: true, contentEditor: false },
      context: { allowPersonnelProvisioning: true },
    })
    console.log(`Updated service account user ${user.id}`)
  } else {
    const user = await payload.create({
      collection: 'users',
      data: {
        email: SERVICE_EMAIL,
        name: 'Backend Service',
        phone: SERVICE_PHONE,
        operationalRole: 'representative', isActive: true, backendService: true, contentEditor: false,
        enableAPIKey: true,
        apiKey,
        password,
      },
      context: { allowPersonnelProvisioning: true },
    })
    console.log(`Created service account user ${user.id}`)
  }

  console.log(`\nSet these in apps/backend/.env:`)
  console.log(`  PAYLOAD_API_KEY=${apiKey}`)
  console.log(`  PAYLOAD_URL=http://localhost:3000`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
