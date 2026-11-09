import { Typography } from '@/components/ui/typography'
import { cn } from '@/utilities/ui'

/** First letters of the first and last word of a name (ZWNJ and punctuation do not count as letters); empty for no name. */
export function personInitials(name: string | null | undefined): string {
  const words = (name ?? '')
    .split(/[\s‌‏‎.,،\-_/]+/)
    .map((word) => word.trim())
    .filter(Boolean)
  if (!words.length) return ''
  const first = Array.from(words[0]!)[0] ?? ''
  const last = words.length > 1 ? (Array.from(words[words.length - 1]!)[0] ?? '') : ''
  return `${first}${last ? `‌${last}` : ''}`
}

/**
 * A person's round mark. Accounts carry no picture (the API's `avatarUrl` is always null), so this draws the
 * initials on a quiet tile; the name sits beside it, so the mark itself is hidden from assistive technology.
 */
export function PersonAvatar({
  name,
  className,
}: {
  name: string | null | undefined
  className?: string
}) {
  const initials = personInitials(name)
  return (
    <span
      aria-hidden="true"
      data-testid="person-avatar"
      className={cn('flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700', className)}
    >
      <Typography as="span" variant="14/semibold" className="text-inherit">
        {initials || '?'}
      </Typography>
    </span>
  )
}
