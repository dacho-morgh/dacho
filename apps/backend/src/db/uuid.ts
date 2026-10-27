const postgresUuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i

/**
 * PostgreSQL rejects malformed text for `uuid` columns with SQLSTATE 22P02. Those
 * queries reject their promise, and the Express 4 routers do not catch async
 * failures, so a single hand-written id could terminate the API process. Callers
 * use this check to treat a malformed id as a missing row instead of querying.
 */
export function isUuid(value: string): boolean {
  return postgresUuid.test(value)
}
