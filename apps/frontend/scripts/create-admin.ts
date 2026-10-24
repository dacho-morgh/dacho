import 'dotenv/config'
import { randomBytes } from 'node:crypto'

import type { User } from '@dacho/cms-core'
import { getPayload } from 'payload'

import config from '../src/payload.config.js'
import { readOption } from './args.js'

async function main(): Promise<void> {
  const email = readOption('email', 'ADMIN_EMAIL')
  const phone = readOption('phone', 'ADMIN_PHONE')
  const name = readOption('name', 'ADMIN_NAME', 'Admin')
  // No default: only reset the password when one is explicitly given, so
  // re-running the script to (re)grant roles never clobbers a live password.
  //   pnpm create:admin --password='…'
  const providedPassword = readOption('password', 'ADMIN_PASSWORD')

  if (!email || !phone) throw new Error('Explicit --email and --phone are required to provision a System Owner.')
  const payload = await getPayload({ config })

  // This explicit operator command bootstraps a named owner; migrations never
  // infer ownership from an old admin label.
  const roleData: Partial<User> = { operationalRole: 'system-owner', isActive: true, backendService: false, loginAttempts: 0, lockUntil: null }
  const context = { allowPersonnelProvisioning: true }

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
        ? `Updated admin user ${user.id} — granted role=system-owner, password reset`
        : `Updated admin user ${user.id} — granted role=system-owner (password left unchanged)`,
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
