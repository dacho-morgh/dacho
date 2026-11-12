import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { OwnerEventSubtopics } from '@/components/dashboard/owner-events'
import { OwnerEventForm } from '@/components/dashboard/owner-events-form'
import { dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ویرایش رویداد',
  description: 'ویرایش رویداد و صفحه عمومی آن',
}

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  if (dashboardOperationalRole(user) !== 'system-owner') redirect('/dashboard?access=denied')

  const { id } = await params
  return (
    <>
      <OwnerEventForm mode="edit" id={id} />
      {/* Companies apply to a subtopic, so the owner adds the categories, subtopics and RFP files here too. */}
      <OwnerEventSubtopics eventId={id} embedded />
    </>
  )
}
