import type { Exhibition } from '@cms-core/payload-types'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { ExhibitionPicker } from '@/components/dashboard/exhibition-booths/exhibition-picker'
import { formatDate } from '@/utilities/dashboard-api'
import { dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export default async function ExhibitionsPage() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const role = dashboardOperationalRole(user)
  if (role !== 'system-owner' && role !== 'central-secretariat' && role !== 'representative') {
    redirect('/dashboard?access=denied')
  }
  // The owner manages exhibitions from the one events and exhibitions list (S5, FE40).
  if (role === 'system-owner') redirect('/dashboard/events?type=exhibition')
  const exhibitions: Exhibition[] = []
  let page = 1
  let hasNextPage = true
  while (hasNextPage) {
    const result = await payload.find({
      collection: 'exhibitions',
      page,
      limit: 100,
      depth: 0,
      sort: 'startDate',
    })
    exhibitions.push(...result.docs)
    hasNextPage = result.hasNextPage
    page++
  }
  // Companies only see exhibitions that are still open for booth requests.
  const visible =
    role === 'representative' ? exhibitions.filter((item) => item.status !== 'past') : exhibitions
  return (
    <main dir="rtl" className="flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-y-auto px-4 pt-10 pb-4">
      <ExhibitionPicker
        title={role === 'representative' ? 'رزرو غرفه نمایشگاه' : 'درخواست‌های غرفه نمایشگاه‌ها'}
        actionLabel={role === 'representative' ? 'مشاهده غرفه‌ها' : 'بررسی درخواست‌ها'}
        items={visible.map((item) => ({
          id: String(item.id),
          title: item.title,
          dates: `${formatDate(item.startDate)} تا ${formatDate(item.endDate)}`,
          location: item.location || 'محل برگزاری ثبت نشده است',
        }))}
      />
    </main>
  )
}
