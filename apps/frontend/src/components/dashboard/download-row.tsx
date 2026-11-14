import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'

/** A file of card 1: its title at the start and the primary download button in front of it, on one row. */
export function DownloadRow({ label, href, filename }: { label: string; href: string; filename?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <Typography as="span" variant="16/semibold" color="neutral-700">
        {label}
      </Typography>
      <Button asChild variant="primary" size="40" className="shrink-0">
        <a href={href} download={filename} aria-label={filename ? `دانلود ${filename}` : `دانلود ${label}`}>
          دانلود
        </a>
      </Button>
    </div>
  )
}
