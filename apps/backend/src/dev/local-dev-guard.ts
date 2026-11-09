/**
 * Dev seeds write synthetic people, cases and files. They run only against the
 * local Compose dev database (`dacho-cms`) or the disposable Phase 0 test
 * database, on a loopback host, with a loopback CMS, and never in production.
 */
export const DEV_SEED_DATABASES = ['dacho-cms', 'dacho_phase0_test'] as const

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function isLoopback(hostname: string): boolean {
  return LOOPBACK.has(hostname) || hostname.endsWith('.localhost')
}

export class LocalDevGuardError extends Error {}

export function assertLocalDevTarget(target: { databaseUrl: string; payloadUrl?: string; nodeEnv?: string }): void {
  if (target.nodeEnv === 'production') {
    throw new LocalDevGuardError('Refusing to seed with NODE_ENV=production.')
  }
  let db: URL
  try {
    db = new URL(target.databaseUrl)
  } catch {
    throw new LocalDevGuardError('DATABASE_URL is not a valid URL.')
  }
  const database = decodeURIComponent(db.pathname.replace(/^\//, ''))
  if (!/^postgres(ql)?:$/.test(db.protocol) || !isLoopback(db.hostname) ||
      !(DEV_SEED_DATABASES as readonly string[]).includes(database)) {
    throw new LocalDevGuardError(
      `Refusing to seed ${db.hostname}/${database}: only a loopback database named ${DEV_SEED_DATABASES.join(' or ')} is allowed.`,
    )
  }
  if (target.payloadUrl !== undefined) {
    let cms: URL
    try {
      cms = new URL(target.payloadUrl)
    } catch {
      throw new LocalDevGuardError('PAYLOAD_URL is not a valid URL.')
    }
    if (!isLoopback(cms.hostname)) {
      throw new LocalDevGuardError(`Refusing to seed through the CMS at ${cms.hostname}: only a loopback CMS is allowed.`)
    }
  }
}
