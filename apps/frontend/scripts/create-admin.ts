import 'dotenv/config'
import { randomBytes } from 'node:crypto'

import { getPayload } from 'payload'

import config from '../src/payload.config.js'

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? 'admin@dacho.local'
  const phone = process.env.ADMIN_PHONE ?? '09120000999'
  const name = process.env.ADMIN_NAME ?? 'Admin'
  // Optional. Only reset the password when explicitly provided, so re-running
  // the script to (re)grant roles never clobbers an existing password.
  const providedPassword = process.env.ADMIN_PASSWORD ?? 'admin'

  const payload = await getPayload({ config })

  // The admin holds both the dashboard staff role and the CMS admin role. The
  // `allowRoleAssignment` context opts out of the beforeChange escalation
  // guard, which otherwise forces every non-admin writer back to `applicant`.
  const roleData: { role: Array<'admin' | 'representative' | 'referee'> } = { role: ['admin'] }
  const context = { allowRoleAssignment: true }

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
      data: { ...roleData, ...(providedPassword ? { password: providedPassword } : {}) },
      context,
    })
    console.log(`Updated admin user ${user.id} — granted role=admin`)
  } else {
    const password = providedPassword ?? randomBytes(16).toString('hex')
    await payload.create({
      collection: 'users',
      data: { email, name, phone, password, ...roleData },
      context,
    })
    console.log(`\nCreated admin user. Login at /admin with:`)
    console.log(`  Email:    ${email}`)
    console.log(`  Password: ${password}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
