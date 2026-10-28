import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { initTransaction, type CollectionBeforeChangeHook } from 'payload'

const identityFields = ['name', 'nationalId', 'registrationNumber', 'type', 'legalEntityType'] as const

/** Direct REST, GraphQL and Local API edits share the backend's eligibility lock. */
export const invalidateCompanyVerification: CollectionBeforeChangeHook = async ({
  data, originalDoc, operation, req,
}) => {
  if (operation !== 'update' || !originalDoc ||
      !identityFields.some((field) => field in data && data[field] !== originalDoc[field])) return data

  await initTransaction(req)
  const transactionID = await req.transactionID
  if (transactionID == null) throw new Error('Company identity changes require a transaction')
  const db = (req.payload.db as unknown as PostgresAdapter).sessions[transactionID]?.db
  if (!db) throw new Error('Company identity changes require a transaction')

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
      SET status = 'returned', reason = 'تغییر اطلاعات هویتی؛ نیازمند احراز مجدد', updated_at = now()
      FROM current c WHERE v.id = c.id AND c.status IN ('approved', 'pending')
      RETURNING v.representative_id, v.revision, c.status AS previous_status
    )
    INSERT INTO dashboard.activities
      (owner_id, type, title, actor_id, action, reason, from_state, to_state, revision)
    SELECT representative_id, 'transition', 'ابطال تأیید احراز جهت احراز مجدد',
      ${String(req.user?.id ?? originalDoc.representative)}, 'verification_return',
      'تغییر اطلاعات هویتی؛ نیازمند احراز مجدد', previous_status::text, 'returned', revision
    FROM invalidated
  `)
  return data
}
