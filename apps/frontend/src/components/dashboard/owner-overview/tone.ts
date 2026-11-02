export type OverviewTone = 'brand' | 'success' | 'warning' | 'error'

/** Icon chip colours per tone, all from the Sandoq theme variables. */
export const TONE_CHIP: Record<OverviewTone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-orange-50 text-orange-700',
  error: 'bg-error-50 text-error-600',
}

/** The activity feed stores a loose server action key, so the tone is read from its words. */
export function activityTone(action: string | null | undefined): OverviewTone {
  const key = (action ?? '').toLowerCase()
  if (/reject|deny|denied/.test(key)) return 'error'
  if (/return|correct|fix|revis/.test(key)) return 'warning'
  if (/approve|accept|advance|publish|complete|final/.test(key)) return 'success'
  return 'brand'
}
