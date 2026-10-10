import { Typography } from '@/components/ui/typography'

export function StoryLead({ excerpt }: { excerpt?: string | null }) {
  if (!excerpt?.trim()) return null

  return (
    <div
      data-story-lead
      dir="rtl"
      className="w-full min-w-0 rounded-2xl border border-neutral-200 bg-neutral-100 p-4 text-right sm:p-6"
    >
      <Typography
        variant="16/regular"
        lg="20/regular"
        color="neutral-600"
        className="wrap-anywhere whitespace-pre-line"
      >
        {excerpt}
      </Typography>
    </div>
  )
}
