import type { LetterDto, Paginated } from '@/utilities/dashboard-api'
import { serverDashboardFetch } from '@/utilities/dashboard-server'
import { AdminLettersView } from '@/components/dashboard/admin-letters-view'
import type { LetterItem } from '@/components/dashboard/inbox-list-view'
import { mapLetterItem } from '@/utilities/dashboard-api'

export const dynamic = 'force-dynamic'

export default async function AdminLettersPage() {
  const result = await serverDashboardFetch<Paginated<LetterDto>>('/admin/letters?limit=100')
  const letters: LetterItem[] = (result?.items ?? []).map(mapLetterItem)
  return <div className="flex min-h-screen w-full flex-col bg-neutral-50 p-6" dir="rtl"><AdminLettersView initialLetters={letters} /></div>
}
