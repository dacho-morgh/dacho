import type { Pool } from 'pg'
import type { CompanyStore } from '../../src/auth/company-store.js'

const fixtureIds = new WeakMap<Pool, Set<string>>()

/** Legacy workflow suites start from explicitly verified synthetic companies. */
export async function seedVerifiedCompanies(pool: Pool, companies: CompanyStore): Promise<void> {
  for (const company of await companies.list()) {
    const ids = fixtureIds.get(pool) ?? new Set<string>()
    ids.add(company.id)
    fixtureIds.set(pool, ids)
    await pool.query(
      `INSERT INTO dashboard.company_verifications (company_id, representative_id, status, snapshot)
       SELECT $1, $2, 'approved', $3 WHERE NOT EXISTS (
         SELECT 1 FROM dashboard.company_verifications WHERE company_id = $1
       )`,
      [company.id, company.representativeId, JSON.stringify({ company })],
    )
    await pool.query(
      `UPDATE dashboard.company_verifications SET status = 'approved'
       WHERE company_id = $1 AND revision = (
         SELECT MAX(revision) FROM dashboard.company_verifications WHERE company_id = $1
       )`,
      [company.id],
    )
  }
}

export async function clearVerifiedCompanies(pool: Pool): Promise<void> {
  const ids = [...(fixtureIds.get(pool) ?? [])]
  await pool.query('DELETE FROM dashboard.requests WHERE company_id = ANY($1::text[])', [ids])
  await pool.query('DELETE FROM dashboard.company_verifications WHERE company_id = ANY($1::text[])', [ids])
  fixtureIds.delete(pool)
}
