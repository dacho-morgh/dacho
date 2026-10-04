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

export function isStaffProfileUser(user: Pick<User, 'role' | 'cmsRole'> | null | undefined): boolean {
  return user?.role === 'staff' || user?.cmsRole === 'admin'
}
