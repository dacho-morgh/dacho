import configPromise from '@payload-config'
import type { User } from '@dacho/cms-core'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export async function getProfileSessionUser(): Promise<User | null> {
  const payload = await getPayload({ config: configPromise })
  const requestHeaders = await headers()

  try {
    return (await payload.auth({ headers: getPayloadAuthHeaders(requestHeaders) })).user ?? null
  } catch {
    return null
  }
}

/** True when the user holds the admin role (the internal side of the house). */
export function isInternalUser(user: Pick<User, 'role'> | null | undefined): boolean {
  return Array.isArray(user?.role) && user.role.includes('admin')
}
