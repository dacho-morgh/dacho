import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../src/payload.config.js'

// DEV ONLY. One active login per operational role, for design checks and manual
// walkthroughs of each role's dashboard (docs/agents/design-check-figma.md).
// Idempotent: users are matched by phone and their role, name and password reset.
// Refuses to run when NODE_ENV is production. Never point it at a shared database.
//
//   corepack pnpm --filter @dacho/frontend exec tsx scripts/seed-role-users.ts
//
// Every account signs in with its phone and DEV_ROLE_PASSWORD below.

export const DEV_ROLE_PASSWORD = 'Dev-role-only-7c41'

const ROLE_USERS = [
  { phone: '09129990001', name: 'دبیرخانه آزمایشی', operationalRole: 'central-secretariat' },
  { phone: '09129990002', name: 'سردبیر داوری آزمایشی', operationalRole: 'chief-reviewer' },
  { phone: '09129990003', name: 'داور آزمایشی', operationalRole: 'reviewer' },
  { phone: '09129990004', name: 'کارفرمای آزمایشی', operationalRole: 'employer-reviewer' },
  { phone: '09129990005', name: 'کمیته سرمایه‌گذاری آزمایشی', operationalRole: 'investment-reviewer' },
  { phone: '09129990006', name: 'نماینده شرکت آزمایشی', operationalRole: 'representative' },
] as const

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('seed-role-users is a development seed.')
  const payload = await getPayload({ config })

  for (const user of ROLE_USERS) {
    const data = { ...user, username: user.phone, password: DEV_ROLE_PASSWORD, isActive: true }
    const existing = await payload.find({
      collection: 'users',
      where: { phone: { equals: user.phone } },
      limit: 1,
      depth: 0,
    })
    // The trusted provisioning context lets a seed set the role (as tests/helpers/seedUser.ts does).
    const context = { allowPersonnelProvisioning: true }
    if (existing.docs[0]) {
      await payload.update({ collection: 'users', id: existing.docs[0].id, data, context })
      console.log(`updated ${user.operationalRole} ${user.phone}`)
    } else {
      await payload.create({ collection: 'users', data, context })
      console.log(`created ${user.operationalRole} ${user.phone}`)
    }
  }
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
