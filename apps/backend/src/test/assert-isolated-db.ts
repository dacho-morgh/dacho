import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

const expected = {
  hostname: '127.0.0.1',
  port: '55439',
  username: 'phase0_test',
  password: 'phase0_test_only',
  database: 'dacho_phase0_test',
} as const

/** Fail closed before an integration fixture can migrate or delete data. */
export async function assertIsolatedTestEnvironment(): Promise<void> {
  if (process.env.PHASE0_ISOLATED_TEST !== '1') {
    throw new Error('Integration tests require PHASE0_ISOLATED_TEST=1 and the dedicated test environment.')
  }
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('Integration tests require the dedicated DATABASE_URL.')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Integration DATABASE_URL is invalid.')
  }
  if (
    (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') ||
    url.hostname !== expected.hostname ||
    url.port !== expected.port ||
    decodeURIComponent(url.username) !== expected.username ||
    decodeURIComponent(url.password) !== expected.password ||
    url.pathname !== `/${expected.database}` ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('Integration DATABASE_URL must point exactly to the Phase 0 disposable Docker database.')
  }

  const fileDir = process.env.PAYLOAD_MEDIA_DIR
  if (!fileDir || !existsSync(fileDir)) {
    throw new Error('Integration tests require the dedicated PAYLOAD_MEDIA_DIR.')
  }
  const resolved = realpathSync(fileDir)
  const repoFiles = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.phase0-test-files')
  const markerFile = path.join(resolved, 'phase0-test-marker.txt')
  if (resolved !== realpathSync(repoFiles) || !existsSync(markerFile) ||
      readFileSync(markerFile, 'utf8').trim() !== 'dacho-phase0-disposable-v1') {
    throw new Error('PAYLOAD_MEDIA_DIR is not the marked Phase 0 disposable file directory.')
  }

  const privateDir = process.env.PRIVATE_DOCUMENTS_DIR
  if (!privateDir || !existsSync(privateDir)) {
    throw new Error('Integration tests require the dedicated PRIVATE_DOCUMENTS_DIR.')
  }
  const resolvedPrivate = realpathSync(privateDir)
  if (
    !resolvedPrivate.startsWith(resolved + path.sep) ||
    resolvedPrivate === resolved ||
    resolvedPrivate === path.join(resolved, 'media')
  ) {
    throw new Error('PRIVATE_DOCUMENTS_DIR must be a separate directory under the marked Phase 0 file root.')
  }

  const pool = new Pool({ connectionString: raw, connectionTimeoutMillis: 3000, max: 1 })
  try {
    const result = await pool.query<{ database: string; user_name: string; marker: string }>(
      `SELECT current_database() AS database, current_user AS user_name, marker
       FROM public.phase0_test_guard WHERE id = 1`,
    )
    if (result.rows.length !== 1 || result.rows[0]?.database !== expected.database ||
        result.rows[0]?.user_name !== expected.username ||
        result.rows[0]?.marker !== 'dacho-phase0-disposable-v1') {
      throw new Error('Database marker mismatch.')
    }
  } finally {
    await pool.end()
  }
}
