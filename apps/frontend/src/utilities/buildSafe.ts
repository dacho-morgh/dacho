/**
 * Runs a build-time Payload query that must not require a live database.
 *
 * `next build` prerenders pages and collects route config, so any
 * `generateStaticParams` that queries Payload would otherwise need a migrated
 * Postgres reachable during the build. CI runners and Docker image builds have
 * no database, so a *connection* failure returns `null` and the affected paths
 * are generated on demand at runtime instead (`dynamicParams` defaults to
 * `true`, and returning an empty array from `generateStaticParams` is the
 * documented way to defer all paths to runtime).
 *
 * Only Payload initialisation/connection failures are tolerated. Any other
 * error — a broken query, schema drift, a validation bug — is rethrown so it
 * still fails the build loudly instead of silently shipping empty pages.
 *
 * When a database IS reachable at build time (local/bare-metal builds) this is
 * transparent: the query runs and the pages are prerendered as before.
 *
 * Payload marks connection failures with `payloadInitError` (see
 * payload/dist/index.js) and discriminates on it the same way internally
 * (payload/dist/utilities/routeError.js).
 */
const isPayloadInitError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'payloadInitError' in error &&
  (error as { payloadInitError?: unknown }).payloadInitError === true

export async function buildSafe<T>(label: string, query: () => Promise<T>): Promise<T | null> {
  try {
    return await query()
  } catch (error) {
    if (!isPayloadInitError(error)) {
      throw error
    }

    const reason = error instanceof Error ? error.message : String(error)
    console.warn(
      `[build] No database while resolving "${label}": ${reason}. Affected paths will be generated on demand at runtime.`,
    )
    return null
  }
}
