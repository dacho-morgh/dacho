/**
 * Payload's built-in `slugify` strips every character outside `[\w-]`, so a
 * Persian title such as "انتقال واحد اعتبارات" collapses to "-----------" —
 * unusable as a URL and prone to collisions on the unique slug index.
 *
 * This slugifier keeps letters and digits from ANY script (Unicode property
 * escapes) while behaving like Payload's for Latin input. `slugField({ slugify })`
 * takes the adapter below; `slugifyValue` is the plain string transform.
 */
export const slugifyValue = (value?: string | null): string =>
  (value ?? '')
    .trim()
    .toLowerCase()
    // Drop punctuation, zero-width joiners and any other formatting marks.
    .replace(/[^\p{Letter}\p{Number}\s-]+/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * Adapter matching Payload's `Slugify` signature for `slugField({ slugify })`.
 */
export const slugify = ({ valueToSlugify }: { valueToSlugify?: unknown }): string | undefined =>
  typeof valueToSlugify === 'string' ? slugifyValue(valueToSlugify) : undefined
