import type { Pool } from 'pg'

import type { DocumentCategory } from './policy.js'

export interface PrivateDocumentDto {
  id: string
  category: DocumentCategory
  filename: string
  mimeType: string
  sizeBytes: number
  logicalVersion: number
  requestId: string | null
  companyId: string | null
  uploaderId: string
  createdAt: string
  updatedAt: string
}

export interface PrivateDocumentRecord extends PrivateDocumentDto {
  storageKey: string
  requestOwnerId: string | null
  requestStatus: string | null
  requestCompanyId: string | null
}

interface DocumentRow {
  id: string
  storage_key: string
  category: DocumentCategory
  original_filename: string
  mime_type: string
  size_bytes: number
  logical_version: number
  request_id: string | null
  company_id: string | null
  uploader_id: string
  created_at: Date
  updated_at: Date
  request_owner_id: string | null
  request_status: string | null
  request_company_id: string | null
}

const DOCUMENT_COLUMNS = `
  d.id, d.storage_key, d.category, d.original_filename, d.mime_type, d.size_bytes,
  d.logical_version, d.request_id, d.company_id, d.uploader_id, d.created_at, d.updated_at,
  r.owner_id AS request_owner_id, r.status::text AS request_status, NULL::text AS request_company_id
`

const DOCUMENT_FROM = `
  FROM dashboard.private_documents d
  LEFT JOIN dashboard.requests r ON r.id = d.request_id
`

function mapRow(row: DocumentRow): PrivateDocumentRecord {
  return {
    id: row.id,
    storageKey: row.storage_key,
    category: row.category,
    filename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    logicalVersion: row.logical_version,
    requestId: row.request_id,
    companyId: row.company_id,
    uploaderId: row.uploader_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    requestOwnerId: row.request_owner_id,
    requestStatus: row.request_status,
    requestCompanyId: row.request_company_id ?? row.company_id,
  }
}

export function toDocumentDto(record: PrivateDocumentRecord): PrivateDocumentDto {
  return {
    id: record.id,
    category: record.category,
    filename: record.filename,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    logicalVersion: record.logicalVersion,
    requestId: record.requestId,
    companyId: record.companyId,
    uploaderId: record.uploaderId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export interface CreateDocumentInput {
  storageKey: string
  category: DocumentCategory
  filename: string
  mimeType: string
  sizeBytes: number
  logicalVersion: number
  requestId: string | null
  companyId: string | null
  uploaderId: string
}

export class DocumentRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateDocumentInput): Promise<PrivateDocumentRecord> {
    const { rows } = await this.pool.query<DocumentRow>(
      `WITH inserted AS (
         INSERT INTO dashboard.private_documents
           (storage_key, category, original_filename, mime_type, size_bytes, logical_version,
            request_id, company_id, uploader_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *
       )
       SELECT ${DOCUMENT_COLUMNS}
       FROM inserted d
       LEFT JOIN dashboard.requests r ON r.id = d.request_id`,
      [
        input.storageKey,
        input.category,
        input.filename,
        input.mimeType,
        input.sizeBytes,
        input.logicalVersion,
        input.requestId,
        input.companyId,
        input.uploaderId,
      ],
    )
    const row = rows[0]
    if (!row) throw new Error('INSERT private_documents returned no row')
    return mapRow(row)
  }

  async findById(id: string): Promise<PrivateDocumentRecord | undefined> {
    const { rows } = await this.pool.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS} ${DOCUMENT_FROM} WHERE d.id = $1`,
      [id],
    )
    return rows[0] ? mapRow(rows[0]) : undefined
  }

  async listForRequest(requestId: string): Promise<PrivateDocumentRecord[]> {
    const { rows } = await this.pool.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS} ${DOCUMENT_FROM} WHERE d.request_id = $1 ORDER BY d.logical_version DESC, d.created_at ASC`,
      [requestId],
    )
    return rows.map(mapRow)
  }

  async listForCompany(companyId: string): Promise<PrivateDocumentRecord[]> {
    const { rows } = await this.pool.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS} ${DOCUMENT_FROM}
       WHERE d.company_id = $1 AND d.request_id IS NULL
       ORDER BY d.category ASC, d.logical_version DESC, d.created_at ASC`,
      [companyId],
    )
    return rows.map(mapRow)
  }

  async listForRequestCategory(requestId: string, category: DocumentCategory): Promise<PrivateDocumentRecord[]> {
    const { rows } = await this.pool.query<DocumentRow>(
      `SELECT ${DOCUMENT_COLUMNS} ${DOCUMENT_FROM} WHERE d.request_id = $1 AND d.category = $2 ORDER BY d.created_at ASC`,
      [requestId, category],
    )
    return rows.map(mapRow)
  }

  /**
   * All files uploaded to the same logical field share one version until an
   * explicit new revision is opened by a later workflow (T20/T30). This is why
   * the default is the current maximum, not maximum + 1.
   */
  async logicalVersionFor(requestId: string, category: DocumentCategory): Promise<number> {
    const { rows } = await this.pool.query<{ version: string }>(
      `SELECT COALESCE(MAX(logical_version), 1)::text AS version
       FROM dashboard.private_documents WHERE request_id = $1 AND category = $2`,
      [requestId, category],
    )
    return Number(rows[0]?.version ?? 1)
  }

  async logicalVersionForCompany(companyId: string, category: DocumentCategory): Promise<number> {
    const { rows } = await this.pool.query<{ version: string }>(
      `SELECT COALESCE(MAX(logical_version), 1)::text AS version
       FROM dashboard.private_documents
       WHERE company_id = $1 AND request_id IS NULL AND category = $2`,
      [companyId, category],
    )
    return Number(rows[0]?.version ?? 1)
  }

  async delete(id: string): Promise<PrivateDocumentRecord | undefined> {
    const { rows } = await this.pool.query<DocumentRow>(
      `WITH removed AS (
         DELETE FROM dashboard.private_documents WHERE id = $1 RETURNING *
       )
       SELECT ${DOCUMENT_COLUMNS}
       FROM removed d
       LEFT JOIN dashboard.requests r ON r.id = d.request_id`,
      [id],
    )
    const row = rows[0]
    return row ? mapRow(row) : undefined
  }
}
