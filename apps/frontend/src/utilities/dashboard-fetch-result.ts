import type { DashboardFetchResult } from './dashboard-server'

/** Why a dashboard surface cannot show data. `expired` == missing/expired session. */
export type UnavailableReason = 'unavailable' | 'denied' | 'expired'

/**
 * Maps a preserved fetch outcome to the notice a surface renders. `ok` stays
 * silent, so an empty list is only ever shown for a successful read — a 403 or
 * a transport failure never collapses into "no records".
 */
export function unavailableReasonFor(
  result: DashboardFetchResult<unknown>,
): UnavailableReason | undefined {
  switch (result.kind) {
    case 'ok':
      return undefined
    case 'unauthenticated':
      return 'expired'
    case 'denied':
      return 'denied'
    case 'unavailable':
      return 'unavailable'
  }
}
