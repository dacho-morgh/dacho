import type { Client } from 'pg'

type Counts = Record<string, number>

// Each CASE gives every row exactly one disposition, so a group's total always
// equals its table's row count. `review_*` rows wait for a named human decision.
const ACCOUNTS = `SELECT CASE
    WHEN backend_service THEN 'service_account'
    WHEN is_active AND operational_role IS NOT NULL THEN 'mapped_role'
    WHEN is_active AND content_editor THEN 'editorial_only'
    WHEN NOT is_active AND operational_role IS NOT NULL THEN 'deactivated'
    WHEN legacy_roles ? 'admin' THEN 'review_legacy_admin'
    WHEN legacy_roles ? 'representative' AND legacy_roles ? 'referee' THEN 'review_conflicting_roles'
    WHEN NOT is_active THEN 'review_no_role'
    ELSE 'review_unclassified'
  END AS key, count(*)::int AS count
  FROM public.users GROUP BY 1`

const ACTIVE_ROLES = `SELECT operational_role::text AS key, count(*)::int AS count
  FROM public.users WHERE is_active AND operational_role IS NOT NULL GROUP BY 1`

const REQUEST_OWNERSHIP = `SELECT CASE
    WHEN r.company_id IS NOT NULL AND c.id IS NOT NULL THEN 'company_linked'
    WHEN r.company_id IS NOT NULL THEN 'review_unknown_company'
    WHEN owned.companies > 1 THEN 'review_ambiguous_owner'
    WHEN u.id IS NULL THEN 'review_unknown_owner'
    ELSE 'review_owner_without_company'
  END AS key, count(*)::int AS count
  FROM dashboard.requests r
  LEFT JOIN public.companies c ON c.id::text = r.company_id
  LEFT JOIN public.users u ON u.id::text = r.owner_id
  LEFT JOIN (
    SELECT representative_id::text AS owner_id, count(*) AS companies
    FROM public.companies GROUP BY 1
  ) owned ON owned.owner_id = r.owner_id
  GROUP BY 1`

// An old case has no pinned event RFP. Converting one needs an explicit mapping.
const REQUEST_SCOPE = `SELECT CASE
    WHEN EXISTS (SELECT 1 FROM dashboard.request_rfps rfp WHERE rfp.request_id = r.id) THEN 'event_path'
    WHEN r.status IN ('approved', 'rejected') THEN 'legacy_closed'
    ELSE 'legacy_open'
  END AS key, count(*)::int AS count
  FROM dashboard.requests r GROUP BY 1`

const EVIDENCE = `SELECT
  (SELECT count(*)::int FROM (
    SELECT company_national_id FROM public.users WHERE company_national_id IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1
  ) duplicates) AS duplicate_national_id_groups,
  (SELECT count(*)::int FROM public.users u WHERE u.company_national_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.representative_id = u.id)
  ) AS accounts_with_unlinked_company_data,
  (SELECT count(*)::int FROM (
    SELECT representative_id FROM public.companies GROUP BY 1 HAVING count(*) > 1
  ) multiple) AS representatives_with_several_companies,
  (SELECT count(*)::int FROM dashboard.letters l
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id::text = l.recipient_id)
  ) AS letters_with_unknown_recipient,
  (SELECT count(*)::int FROM dashboard.support_tickets t
    WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id::text = t.requester_id)
  ) AS tickets_with_unknown_requester`

const JOURNALS = `SELECT
  (SELECT count(*)::int FROM public.payload_migrations WHERE batch <> -1) AS cms_applied,
  (SELECT name FROM public.payload_migrations WHERE batch <> -1 ORDER BY name DESC LIMIT 1) AS cms_latest,
  (SELECT count(*)::int FROM dashboard.pgmigrations) AS backend_applied,
  (SELECT name FROM dashboard.pgmigrations ORDER BY name DESC LIMIT 1) AS backend_latest`

const toCounts = (rows: { key: string; count: number }[]): Counts =>
  Object.fromEntries(rows.map(({ key, count }) => [key, count]).sort())

/**
 * Sorts migrated accounts and cases into dispositions: aggregate counts and
 * migration names only, never identifiers, contact details or row contents.
 */
export async function collectMigrationReconciliation(client: Pick<Client, 'query'>) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  try {
    await client.query("SET LOCAL statement_timeout = '30s'")
    const counts = async (sql: string) =>
      toCounts((await client.query<{ key: string; count: number }>(sql)).rows)
    const accounts = await counts(ACCOUNTS)
    const activeRoles = await counts(ACTIVE_ROLES)
    const requestOwnership = await counts(REQUEST_OWNERSHIP)
    const requestScope = await counts(REQUEST_SCOPE)
    const evidence = (await client.query(EVIDENCE)).rows[0]
    const journals = (await client.query(JOURNALS)).rows[0]
    await client.query('COMMIT')
    const pendingReview = (group: Counts) => Object.entries(group)
      .filter(([key]) => key.startsWith('review_'))
      .reduce((total, [, count]) => total + count, 0)
    return {
      accounts,
      activeRoles,
      requestOwnership,
      requestScope,
      evidence,
      journals,
      pending: {
        accounts: pendingReview(accounts),
        requests: pendingReview(requestOwnership),
        // No migration may choose an owner; bootstrapping one is an operator action.
        systemOwnerMissing: !activeRoles['system-owner'],
      },
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}
