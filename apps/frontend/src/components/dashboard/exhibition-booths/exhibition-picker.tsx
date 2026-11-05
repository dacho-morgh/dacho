import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

export interface ExhibitionPickerItem {
  id: string
  title: string
  dates: string
  location: string
}

/** Entry list for the Secretariat booth queue and the company booth request. */
export function ExhibitionPicker({
  title,
  actionLabel,
  items,
}: {
  title: string
  actionLabel: string
  items: ExhibitionPickerItem[]
}) {
  return (
    <div dir="rtl" className="flex w-full max-w-[1140px] flex-col gap-4">
      <Typography as="h1" variant="24/bold" color="neutral-800">
        {title}
      </Typography>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-background p-6">
          <Typography variant="14/regular" color="neutral-500">
            نمایشگاه فعالی وجود ندارد.
          </Typography>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-background p-4"
            >
              <div className="flex flex-col gap-1">
                <Typography variant="16/bold" color="neutral-800">
                  {item.title}
                </Typography>
                <Typography variant="14/regular" color="neutral-500">
                  {item.dates} · {item.location}
                </Typography>
              </div>
              <Button size="40" variant="primary" asChild>
                <Link href={`/dashboard/exhibitions/${encodeURIComponent(item.id)}`}>
                  {actionLabel}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
