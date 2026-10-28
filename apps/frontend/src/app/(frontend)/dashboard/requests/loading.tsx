import { RequestsLoadingSkeleton } from '@/components/dashboard/requests'

export default function RequestsLoading() {
  return (
    <div className="flex flex-1 flex-col bg-neutral-50 px-4 pt-6 pb-4 sm:pt-10">
      <div className="mt-4 flex min-h-100 w-full flex-col rounded-2xl border border-neutral-200 bg-white p-4">
        <RequestsLoadingSkeleton />
      </div>
    </div>
  )
}
