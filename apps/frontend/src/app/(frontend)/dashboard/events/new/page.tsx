import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { ExhibitionForm } from '@/components/dashboard/exhibition-admin/exhibition-form'
import { OwnerEventForm } from '@/components/dashboard/owner-events-form'
import { dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'رویداد یا نمایشگاه جدید',
  description: 'ساخت رویداد یا نمایشگاه همراه با صفحه عمومی آن',
}

interface PageProps {
  searchParams: Promise<{ type?: string; publicEventId?: string }>
}

/** FE41 (S5): the owner creates an event or an exhibition, public page included. */
export default async function NewEventOrExhibitionPage({ searchParams }: PageProps) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  if (dashboardOperationalRole(user) !== 'system-owner') redirect('/dashboard?access=denied')

  const { type, publicEventId } = await searchParams
  if (type === 'exhibition') return <ExhibitionForm mode="create" />
  return <OwnerEventForm mode="create" adoptPublicEventId={publicEventId || undefined} />
}
