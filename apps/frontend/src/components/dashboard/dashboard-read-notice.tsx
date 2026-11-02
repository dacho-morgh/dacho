import { OfflineNotice, type UnavailableReason } from '@/components/dashboard/offline-notice'

/** A page whose main read failed: the notice stands alone, so no empty list can be mistaken for it. */
export function DashboardReadNotice({
  reason,
  retryHref,
}: {
  reason: UnavailableReason
  retryHref: string
}) {
  return (
    <div className="mx-auto w-full max-w-4xl p-6 pt-20 md:p-10" dir="rtl">
      <OfflineNotice reason={reason} retryHref={retryHref} />
    </div>
  )
}
