import { randomInt } from 'node:crypto'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export const testUser = {
  email: 'dev@payloadcms.com',
  password: 'test',
  phone: `09${randomInt(100_000_000, 1_000_000_000)}`,
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  // Delete existing test user if any
  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })

  // Create fresh test user (an admin, so the /admin e2e panel is reachable;
  // the beforeChange escalation guard is bypassed for this trusted seed).
  await payload.create({
    collection: 'users',
    data: { ...testUser, role: 'staff', cmsRole: 'admin' },
    context: { allowRoleAssignment: true },
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
