import type { Exhibition } from '@cms-core/payload-types'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { EventsView, type EventItem } from '@/components/dashboard/events-view'
import { ExhibitionPicker } from '@/components/dashboard/exhibition-booths/exhibition-picker'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import { formatDate } from '@/utilities/dashboard-api'
import { dashboardOperationalRole } from '@/utilities/dashboard-server'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

export const dynamic = 'force-dynamic'

export default async function OwnerExhibitionsPage() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: getPayloadAuthHeaders(await headers()) })
  const role = dashboardOperationalRole(user)
  if (role !== 'system-owner' && role !== 'central-secretariat' && role !== 'representative') {
    redirect('/dashboard?access=denied')
  }
  // Independent entry keeps booth administration reachable when /events renders
  // the operational OwnerEvents workspace rather than public CMS discovery.
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
  if (role !== 'system-owner') {
    // Companies only see exhibitions that are still open for booth requests.
    const visible =
      role === 'representative' ? exhibitions.filter((item) => item.status !== 'past') : exhibitions
    return (
      <main dir="rtl" className="flex min-h-0 min-w-0 flex-1 flex-col items-center p-4 sm:p-6">
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
  const items: EventItem[] = exhibitions.map((item) => ({
    id: `exhibitions-${item.id}`,
    serviceKey: 'exhibitions',
    title: item.title,
    badgeType: item.status === 'past' ? 'ended' : item.status === 'ongoing' ? 'active' : 'upcoming',
    badgeText:
      item.status === 'past' ? 'تمام شده' : item.status === 'ongoing' ? 'در حال برگزاری' : 'پیش رو',
    dates: `${formatDate(item.startDate)} تا ${formatDate(item.endDate)}`,
    location: item.location || 'محل برگزاری ثبت نشده است',
    hasActionButton: true,
  }))
  return (
    <main dir="rtl" className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 p-4">
      <Button size="40" asChild variant="outline-gray" className="self-start">
        <Link href="/admin/collections/exhibitions">
          <Typography variant="14/regular">مدیریت اطلاعات نمایشگاه در CMS</Typography>
        </Link>
      </Button>
      <EventsView initialEventsList={items} isOwner />
    </main>
  )
}
