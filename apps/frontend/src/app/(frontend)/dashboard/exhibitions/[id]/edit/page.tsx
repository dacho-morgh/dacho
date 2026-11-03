import configPromise from '@payload-config'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { ExhibitionForm } from '@/components/dashboard/exhibition-admin/exhibition-form'
import { dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ویرایش نمایشگاه',
  description: 'ویرایش نمایشگاه، صفحه عمومی و تنظیمات غرفه آن',
}

export default async function EditExhibitionPage({ params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  if (dashboardOperationalRole(user) !== 'system-owner') redirect('/dashboard?access=denied')

  const { id } = await params
  return <ExhibitionForm mode="edit" id={id} />
}
