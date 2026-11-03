import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { OwnerEventSubtopics } from '@/components/dashboard/owner-events'
import { dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'دسته‌ها، زیرعنوان‌ها و RFP',
  description: 'مدیریت دسته‌های فناوری، زیرعنوان‌ها، کارفرما و RFP رویداد',
}

export default async function EventSubtopicsPage({ params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  if (dashboardOperationalRole(user) !== 'system-owner') redirect('/dashboard?access=denied')

  const { id } = await params
  return <OwnerEventSubtopics eventId={id} />
}
