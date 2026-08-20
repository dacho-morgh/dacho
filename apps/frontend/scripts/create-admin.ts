import 'dotenv/config'
import { randomBytes } from 'node:crypto'

import { getPayload } from 'payload'

import config from '../src/payload.config.js'

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? 'admin@dacho.local'
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(16).toString('hex')
  const phone = process.env.ADMIN_PHONE ?? '09120000999'
  const name = process.env.ADMIN_NAME ?? 'Admin'

  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    const user = existing.docs[0]!
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { password },
    })
    console.log(`Updated admin user ${user.id}`)
  } else {
    const user = await payload.create({
      collection: 'users',
      data: { email, name, phone, password },
    })
    console.log(`Created admin user ${user.id}`)
  }

  console.log(`\nLogin at /admin with:`)
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
