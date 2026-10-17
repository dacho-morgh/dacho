import 'dotenv/config'
import { randomBytes } from 'node:crypto'

import { getPayload } from 'payload'

import config from '../src/payload.config.js'
import { readOption } from './args.js'

async function main(): Promise<void> {
  const email = readOption('email', 'ADMIN_EMAIL', 'admin@dacho.local')
  const phone = readOption('phone', 'ADMIN_PHONE', '09120000999')
  const name = readOption('name', 'ADMIN_NAME', 'Admin')
  // No default: only reset the password when one is explicitly given, so
  // re-running the script to (re)grant roles never clobbers a live password.
  //   pnpm create:admin --password='…'
  const providedPassword = readOption('password', 'ADMIN_PASSWORD')

  const payload = await getPayload({ config })

  // The admin holds both the dashboard staff role and the CMS admin role. The
  // `allowRoleAssignment` context opts out of the beforeChange escalation
  // guard, which otherwise forces every non-admin writer back to `applicant`.
  const roleData: {
    roles: Array<'admin' | 'representative' | 'referee'>
    loginAttempts: number
    lockUntil: null
  } = { roles: ['admin'], loginAttempts: 0, lockUntil: null }
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
    console.log(
      providedPassword
        ? `Updated admin user ${user.id} — granted role=admin, password reset`
        : `Updated admin user ${user.id} — granted role=admin (password left unchanged)`,
    )
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
