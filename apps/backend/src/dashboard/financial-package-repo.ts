import type { Pool, PoolClient } from 'pg'

import { FINANCIAL_CATEGORIES, isFinancialStageOpen, type DocumentCategory } from '../access/policy.js'
import { isUuid } from '../db/uuid.js'
import {
  isPackageComplete,
  packageGaps,
  type FinancialPackageDocumentDto,
  type FinancialPackageDto,
  type PackageGaps,
} from './financial-package.js'
import { appendTransition } from './transition-history.js'

export type SubmitFinancialPackageResult =
  | { status: 'submitted' | 'already_submitted'; package: FinancialPackageDto }
  | { status: 'incomplete'; gaps: PackageGaps }
  | { status: 'stage_closed' }
  | { status: 'not_found' }

interface PackageRow {
  id: string
  request_id: string
  invitation_id: string
  package_version: number
  checklist_version: string
  statement_years: number[]
  documents: FinancialPackageDocumentDto[]
  submitted_by: string
  submitted_at: Date
}

const PACKAGE_COLUMNS = `
  p.id, p.request_id, p.invitation_id, p.package_version, p.checklist_version,
  p.statement_years, p.documents, p.submitted_by, p.submitted_at
`

function mapPackage(row: PackageRow): FinancialPackageDto {
  return {
    id: row.id,
    requestId: row.request_id,
    invitationId: row.invitation_id,
    packageVersion: row.package_version,
    checklistVersion: row.checklist_version,
    statementYears: row.statement_years,
    documents: row.documents,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at.toISOString(),
  }
}

/**
 * True when the case's latest invitation holds a package. The invitation is one per
 * advancement, so a package of an earlier one does not freeze a later stage (T30).
 * `requestRef` is a trusted SQL expression, never user input.
 */
export function latestInvitationPackageExists(requestRef: string): string {
  return `EXISTS (
    SELECT 1 FROM dashboard.financial_packages fp
    WHERE fp.invitation_id = (
      SELECT fi.id FROM dashboard.financial_invitations fi
      WHERE fi.request_id = ${requestRef}
      ORDER BY fi.request_revision DESC LIMIT 1
    )
  )`
}

export class FinancialPackageRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Read in its own statement, so a wait for the request lock sees a package that
   * committed meanwhile. Upload and delete call it after taking that lock. Only a
   * package of the case's latest invitation freezes the files, matching submit.
   */
  async isSubmitted(requestId: string, client: Pool | PoolClient = this.pool): Promise<boolean> {
    if (!isUuid(requestId)) return false
    const { rows } = await client.query<{ submitted: boolean }>(
      `SELECT ${latestInvitationPackageExists('$1::uuid')} AS submitted`,
      [requestId],
    )
    return rows[0]?.submitted === true
  }

  async submittedRequestIds(requestIds: string[]): Promise<Set<string>> {
    const valid = requestIds.filter(isUuid)
    if (valid.length === 0) return new Set()
    const { rows } = await this.pool.query<{ request_id: string }>(
      `SELECT ids.request_id FROM unnest($1::uuid[]) AS ids(request_id)
       WHERE ${latestInvitationPackageExists('ids.request_id')}`,
      [valid],
    )
    return new Set(rows.map((row) => row.request_id))
  }

  /** The newest package of the case's latest invitation. */
  async findLatest(requestId: string): Promise<FinancialPackageDto | null> {
    if (!isUuid(requestId)) return null
    const { rows } = await this.pool.query<PackageRow>(
      `SELECT ${PACKAGE_COLUMNS}
       FROM dashboard.financial_packages p
       JOIN dashboard.financial_invitations i ON i.id = p.invitation_id
       WHERE p.request_id = $1
       ORDER BY i.request_revision DESC, p.package_version DESC
       LIMIT 1`,
      [requestId],
    )
    return rows[0] ? mapPackage(rows[0]) : null
  }

  /**
   * Freezes the company's financial files as one package. It runs under the request
   * row lock that uploads and deletes also take, so a file cannot land between the
   * completeness check and the snapshot. A repeated submit returns the package
   * already stored and writes nothing.
   */
  async submit(input: { requestId: string; actorId: string; expectedYears: number[] }): Promise<SubmitFinancialPackageResult> {
    if (!isUuid(input.requestId)) return { status: 'not_found' }
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const locked = await client.query<{ owner_id: string; status: string; review_stage: string | null; revision: number }>(
        `SELECT owner_id, status::text AS status, review_stage, revision
         FROM dashboard.requests WHERE id = $1 FOR UPDATE`,
        [input.requestId],
      )
      const request = locked.rows[0]
      if (!request) return await rollback(client, { status: 'not_found' })
      if (!isFinancialStageOpen(request.status, request.review_stage)) {
        return await rollback(client, { status: 'stage_closed' })
      }

      const invitationResult = await client.query<{ id: string; checklist_version: string }>(
        `SELECT id, checklist_version FROM dashboard.financial_invitations
         WHERE request_id = $1 ORDER BY request_revision DESC LIMIT 1`,
        [input.requestId],
      )
      const invitation = invitationResult.rows[0]
      if (!invitation) return await rollback(client, { status: 'stage_closed' })

      const existing = await client.query<PackageRow>(
        `SELECT ${PACKAGE_COLUMNS} FROM dashboard.financial_packages p
         WHERE p.invitation_id = $1 ORDER BY p.package_version DESC LIMIT 1`,
        [invitation.id],
      )
      if (existing.rows[0]) {
        await client.query('COMMIT')
        return { status: 'already_submitted', package: mapPackage(existing.rows[0]) }
      }

      const files = await client.query<{
        id: string
        category: DocumentCategory
        original_filename: string
        size_bytes: number
        logical_version: number
        statement_year: number | null
      }>(
        `SELECT id, category::text AS category, original_filename, size_bytes, logical_version, statement_year
         FROM dashboard.private_documents
         WHERE request_id = $1 AND category::text = ANY($2::text[])
         ORDER BY category::text, created_at, id`,
        [input.requestId, FINANCIAL_CATEGORIES],
      )
      const gaps = packageGaps(
        files.rows.map((file) => ({ category: file.category, statementYear: file.statement_year })),
        input.expectedYears,
      )
      if (!isPackageComplete(gaps)) return await rollback(client, { status: 'incomplete', gaps })

      const documents: FinancialPackageDocumentDto[] = files.rows.map((file) => ({
        id: file.id,
        category: file.category,
        filename: file.original_filename,
        sizeBytes: file.size_bytes,
        logicalVersion: file.logical_version,
        statementYear: file.statement_year,
      }))
      const inserted = await client.query<PackageRow>(
        `INSERT INTO dashboard.financial_packages
           (request_id, invitation_id, package_version, checklist_version, statement_years, documents, submitted_by)
         VALUES ($1, $2, 1, $3, $4::integer[], $5::jsonb, $6)
         RETURNING ${PACKAGE_COLUMNS.replace(/p\./g, '')}`,
        [input.requestId, invitation.id, invitation.checklist_version, input.expectedYears, JSON.stringify(documents), input.actorId],
      )
      await appendTransition(client, {
        requestId: input.requestId,
        ownerId: request.owner_id,
        actorId: input.actorId,
        action: 'financial_package_submit',
        fromState: request.status,
        toState: request.status,
        revision: request.revision,
      })
      await client.query('COMMIT')
      return { status: 'submitted', package: mapPackage(inserted.rows[0]!) }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}

async function rollback(client: PoolClient, result: SubmitFinancialPackageResult): Promise<SubmitFinancialPackageResult> {
  await client.query('ROLLBACK')
  return result
}
