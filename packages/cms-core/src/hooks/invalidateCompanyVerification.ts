import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { initTransaction, type CollectionBeforeChangeHook } from 'payload'

/** Kept equal to the backend's `COMPANY_EDIT_REVERIFICATION_REASON`. */
export const COMPANY_EDIT_REVERIFICATION_REASON = 'ویرایش اطلاعات شرکت؛ نیازمند احراز مجدد'

/** Bookkeeping fields; every other company field is part of the verified dossier (T59). */
const nonDossierFields = new Set(['id', 'representative', 'createdAt', 'updatedAt'])

/** Compares stored values, ignoring blank-vs-missing and Payload's generated array row ids. */
function normalize(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'id')
        .map(([key, item]) => [key, normalize(item)])
        .filter(([, item]) => item !== null)
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    )
  }
  return value
}

export function changesCompanyDossier(
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown>,
): boolean {
  return Object.keys(data).some((field) =>
    !nonDossierFields.has(field) &&
    JSON.stringify(normalize(data[field])) !== JSON.stringify(normalize(originalDoc[field])))
}

/** Direct REST, GraphQL and Local API edits share the backend's eligibility lock. */
export const invalidateCompanyVerification: CollectionBeforeChangeHook = async ({
  data, originalDoc, operation, req,
}) => {
  if (operation !== 'update' || !originalDoc || !changesCompanyDossier(data, originalDoc)) return data

  await initTransaction(req)
  const transactionID = await req.transactionID
  if (transactionID == null) throw new Error('Company dossier changes require a transaction')
  const db = (req.payload.db as unknown as PostgresAdapter).sessions[transactionID]?.db
  if (!db) throw new Error('Company dossier changes require a transaction')

  // The CMS may be initialized before the backend schema on a fresh install.
  // No approval can exist before that table exists.
  const tables = await db.execute(sql`SELECT to_regclass('dashboard.company_verifications') AS verifications`)
  if (!tables.rows[0]?.verifications) return data

  const companyId = String(originalDoc.id)
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`company-verification:${companyId}`}, 0))`)
  await db.execute(sql`
    WITH current AS (
      SELECT id, status FROM dashboard.company_verifications
      WHERE company_id = ${companyId} ORDER BY revision DESC LIMIT 1 FOR UPDATE
    ), invalidated AS (
      UPDATE dashboard.company_verifications v
      SET status = 'returned', reason = ${COMPANY_EDIT_REVERIFICATION_REASON}, updated_at = now()
      FROM current c WHERE v.id = c.id AND c.status IN ('approved', 'pending')
      RETURNING v.representative_id, v.revision, c.status AS previous_status
    )
    INSERT INTO dashboard.activities
      (owner_id, type, title, actor_id, action, reason, from_state, to_state, revision)
    SELECT representative_id, 'transition', 'ابطال تأیید احراز جهت احراز مجدد',
      ${String(req.user?.id ?? originalDoc.representative)}, 'verification_return',
      ${COMPANY_EDIT_REVERIFICATION_REASON}, previous_status::text, 'returned', revision
    FROM invalidated
  `)
  return data
}
