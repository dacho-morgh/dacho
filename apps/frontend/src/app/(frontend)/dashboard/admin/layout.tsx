import configPromise from '@payload-config'
import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/login?returnUrl=/dashboard/admin')
  if (user.cmsRole === 'admin' || user.cmsRole === 'editor') redirect('/admin')
  if (user.role !== 'staff') redirect('/dashboard')
  return <>{children}</>
}
