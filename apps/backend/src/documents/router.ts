import { Router } from 'express'
import type { Request, Response } from 'express'
import multer from 'multer'
import type { Pool } from 'pg'

import {
  canDeleteDocument,
  canReadDocument,
  canUploadOwnedDocument,
  documentAudience,
  isDocumentCategory,
  type DocumentCategory,
} from '../access/policy.js'
import { bindRequestScope, requestScopeFor } from '../access/policy.js'
import type { CompanyStore } from '../auth/company-store.js'
import type { UserStore } from '../auth/user-store.js'
import { AssignmentRepository } from '../dashboard/assignment-repo.js'
import { actorOf } from '../dashboard/proxy-auth.js'
import { RequestRepository } from '../dashboard/request-repo.js'
import {
  MAX_DOCUMENT_BYTES,
  validateDocumentFile,
  type DocumentValidationError,
} from './policy.js'
import { DocumentRepository, toDocumentDto, type PrivateDocumentRecord } from './repo.js'
import { PrivateDocumentStorage } from './storage.js'

export interface DocumentRouterDeps {
  pool: Pool
  userStore: UserStore
  companyStore: CompanyStore
  privateDocumentStorage: PrivateDocumentStorage
}

const MAX_MULTIPART_BYTES = MAX_DOCUMENT_BYTES + 1

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function errorStatus(error: DocumentValidationError): number {
  return error === 'file_too_large' ? 413 : 400
}

function isoContentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export function createDocumentRouter(deps: DocumentRouterDeps): Router {
  const router = Router()
  const documents = new DocumentRepository(deps.pool)
  const requests = new RequestRepository(deps.pool)
  const assignments = new AssignmentRepository(deps.pool)
  const storage = deps.privateDocumentStorage

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MULTIPART_BYTES, files: 1, fields: 10 },
  })

  const actorCompanyId = async (actorId: string, role: string): Promise<string | null> => {
    if (role !== 'representative') return null
    const company = await deps.companyStore.findByRepresentative(actorId)
    return company?.id ?? null
  }

  async function isAssignedTo(requestId: string, actorId: string, role: string): Promise<boolean> {
    if (role === 'chief-reviewer' || role === 'reviewer' || role === 'employer-reviewer' || role === 'investment-reviewer') {
      return assignments.activeFor(requestId, actorId, role)
    }
    return false
  }

  function present(
    record: PrivateDocumentRecord,
    actorId: string,
    role: Parameters<typeof canReadDocument>[0],
    companyId: string | null,
    assigned: boolean,
  ) {
    const allowed = canReadDocument(
      role,
      {
        category: record.category,
        companyId: record.companyId,
        requestId: record.requestId,
        requestOwnerId: record.requestOwnerId,
        requestCompanyId: record.requestCompanyId,
        assigned,
      },
      actorId,
      companyId,
    )
    const actions: ('download' | 'delete')[] = []
    if (allowed) actions.push('download')
    if (
      record.requestId &&
      canDeleteDocument(
        role,
        {
          requestOwnerId: record.requestOwnerId,
          requestCompanyId: record.requestCompanyId,
          requestStatus: record.requestStatus,
        },
        actorId,
        companyId,
      )
    ) {
      actions.push('delete')
    }
    return { ...toDocumentDto(record), allowedActions: actions }
  }

  async function authorizeRecord(
    record: PrivateDocumentRecord,
    actorId: string,
    role: Parameters<typeof canReadDocument>[0],
    companyId: string | null,
  ): Promise<boolean> {
    const assigned = record.requestId
      ? await isAssignedTo(record.requestId, actorId, role)
      : false
    return canReadDocument(
      role,
      {
        category: record.category,
        companyId: record.companyId,
        requestId: record.requestId,
        requestOwnerId: record.requestOwnerId,
        requestCompanyId: record.requestCompanyId,
        assigned,
      },
      actorId,
      companyId,
    )
  }

  router.get('/documents', async (req: Request, res: Response) => {
    const actor = actorOf(res)
    const companyId = await actorCompanyId(actor.id, actor.operationalRole)
    const requestId = stringField(req.query.requestId)
    const requestedCompanyId = stringField(req.query.companyId)

    if (requestId) {
      const request = await requests.findByIdScoped(
        requestId,
        bindRequestScope(requestScopeFor(actor.operationalRole), actor.id, companyId),
      )
      if (!request) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const assigned = await isAssignedTo(requestId, actor.id, actor.operationalRole)
      const records = await documents.listForRequest(requestId)
      const items = records
        .map((record) => present(record, actor.id, actor.operationalRole, companyId, assigned))
        .filter((record) => record.allowedActions.length > 0)
      res.json({ items })
      return
    }

    if (actor.operationalRole === 'representative') {
      if (!companyId) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      if (requestedCompanyId && requestedCompanyId !== companyId) {
        res.status(404).json({ error: 'not_found' })
        return
      }
    } else if (actor.operationalRole !== 'system-owner' && actor.operationalRole !== 'central-secretariat') {
      // Chief/reviewer/employer/investment roles have no company dossier access.
      res.status(403).json({ error: 'forbidden' })
      return
    } else if (!requestedCompanyId) {
      res.status(400).json({ error: 'invalid_document_parent' })
      return
    }

    const targetCompanyId = requestedCompanyId ?? companyId
    if (!targetCompanyId) {
      res.status(400).json({ error: 'invalid_document_parent' })
      return
    }
    const records = await documents.listForCompany(targetCompanyId)
    const items = records
      .map((record) => present(record, actor.id, actor.operationalRole, companyId, false))
      .filter((record) => record.allowedActions.length > 0)
    res.json({ items })
  })

  router.post(
    '/documents',
    (req, res, next) => {
      upload.single('file')(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError) {
          if (error.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ error: 'file_too_large', maxBytes: MAX_DOCUMENT_BYTES })
            return
          }
          res.status(400).json({ error: 'invalid_file' })
          return
        }
        if (error) {
          next(error)
          return
        }
        next()
      })
    },
    async (req: Request, res: Response) => {
      const actor = actorOf(res)
      const category = req.body?.category
      if (!isDocumentCategory(category)) {
        res.status(422).json({ error: 'unsupported_category' })
        return
      }
      const audience = documentAudience(category)
      if (audience === 'unsupported') {
        res.status(422).json({ error: 'unsupported_category', category })
        return
      }

      const requestId = stringField(req.body?.requestId)
      const requestedCompanyId = stringField(req.body?.companyId)
      const companyId = await actorCompanyId(actor.id, actor.operationalRole)

      if (audience === 'company') {
        if (requestId || !requestedCompanyId) {
          res.status(400).json({ error: 'invalid_document_parent' })
          return
        }
        const parentCompany = await deps.companyStore.findById(requestedCompanyId).catch(() => undefined)
        if (!parentCompany) {
          res.status(404).json({ error: 'not_found' })
          return
        }
      } else if (!requestId || requestedCompanyId) {
        res.status(400).json({ error: 'invalid_document_parent' })
        return
      }

      let requestOwnerId: string | null = null
      let requestStatus: string | null = null
      let parentCompanyId: string | null = requestedCompanyId
      if (requestId) {
        const request = await requests.findByIdScoped(
          requestId,
          bindRequestScope(requestScopeFor(actor.operationalRole), actor.id, companyId),
        )
        if (!request) {
          res.status(404).json({ error: 'not_found' })
          return
        }
        requestOwnerId = request.ownerId
        requestStatus = request.status
        parentCompanyId = request.companyId ?? parentCompanyId
        if (!parentCompanyId) {
          const ownerCompany = await deps.companyStore.findByRepresentative(request.ownerId)
          parentCompanyId = ownerCompany?.id ?? null
        }
      }

      const permitted = canUploadOwnedDocument(
        actor.operationalRole,
        category,
        {
          companyId: audience === 'company' ? parentCompanyId : null,
          requestOwnerId,
          requestStatus,
          requestCompanyId: parentCompanyId,
        },
        actor.id,
        companyId,
      )
      if (!permitted) {
        // Do not reveal whether a guessed parent/record exists.
        res.status(404).json({ error: 'not_found' })
        return
      }

      const file = req.file
      if (!file) {
        res.status(400).json({ error: 'invalid_file' })
        return
      }
      const validated = validateDocumentFile({
        category,
        filename: file.originalname,
        mimeType: file.mimetype,
        body: file.buffer,
      })
      if (!validated.ok) {
        res.status(errorStatus(validated.error)).json({
          error: validated.error,
          ...(validated.error === 'file_too_large' ? { maxBytes: MAX_DOCUMENT_BYTES } : {}),
        })
        return
      }

      const requestedVersion = Number.parseInt(String(req.body?.logicalVersion ?? ''), 10)
      const logicalVersion =
        Number.isSafeInteger(requestedVersion) && requestedVersion > 0
          ? requestedVersion
          : requestId
            ? await documents.logicalVersionFor(requestId, category as DocumentCategory)
            : await documents.logicalVersionForCompany(parentCompanyId as string, category as DocumentCategory)

      const storageKey = await storage.save(validated.file.body, validated.file.extension)
      let record: PrivateDocumentRecord
      try {
        const input = {
          storageKey,
          category: validated.file.category,
          filename: validated.file.filename,
          mimeType: validated.file.mimeType,
          sizeBytes: validated.file.sizeBytes,
          logicalVersion,
          requestId: requestId ?? null,
          companyId: parentCompanyId,
          uploaderId: actor.id,
        }
        if (requestId) {
          const client = await deps.pool.connect()
          try {
            await client.query('BEGIN')
            const locked = await client.query<{ owner_id: string; status: string }>(
              'SELECT owner_id, status::text AS status FROM dashboard.requests WHERE id = $1 FOR UPDATE',
              [requestId],
            )
            const current = locked.rows[0]
            const currentPermission = current && canUploadOwnedDocument(
              actor.operationalRole,
              category,
              { requestOwnerId: current.owner_id, requestStatus: current.status, requestCompanyId: parentCompanyId },
              actor.id,
              companyId,
            )
            if (!currentPermission) {
              await client.query('ROLLBACK')
              await storage.remove(storageKey)
              res.status(404).json({ error: 'not_found' })
              return
            }
            record = await documents.create(input, client)
            await client.query('COMMIT')
          } catch (error) {
            await client.query('ROLLBACK')
            throw error
          } finally {
            client.release()
          }
        } else {
          record = await documents.create(input)
        }
      } catch (error) {
        await storage.remove(storageKey)
        throw error
      }
      const assigned = requestId
        ? await isAssignedTo(requestId, actor.id, actor.operationalRole)
        : false
      res.status(201).json({
        document: present(record, actor.id, actor.operationalRole, companyId, assigned),
      })
    },
  )

  router.get('/documents/:id', async (req: Request, res: Response) => {
    const actor = actorOf(res)
    const companyId = await actorCompanyId(actor.id, actor.operationalRole)
    const record = await documents.findById(String(req.params.id))
    if (!record || !(await authorizeRecord(record, actor.id, actor.operationalRole, companyId))) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const assigned = record.requestId
      ? await isAssignedTo(record.requestId, actor.id, actor.operationalRole)
      : false
    res.json({
      document: present(record, actor.id, actor.operationalRole, companyId, assigned),
    })
  })

  router.get('/documents/:id/download', async (req: Request, res: Response) => {
    const actor = actorOf(res)
    const companyId = await actorCompanyId(actor.id, actor.operationalRole)
    const record = await documents.findById(String(req.params.id))
    if (!record || !(await authorizeRecord(record, actor.id, actor.operationalRole, companyId))) {
      // Denied and absent ids are indistinguishable.
      res.status(404).json({ error: 'not_found' })
      return
    }
    const body = await storage.read(record.storageKey)
    if (!body) {
      res.status(410).json({ error: 'document_unavailable' })
      return
    }
    res.setHeader('Content-Type', record.mimeType)
    res.setHeader('Content-Length', String(body.length))
    res.setHeader('Content-Disposition', isoContentDisposition(record.filename))
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox")
    res.status(200).send(body)
  })

  router.delete('/documents/:id', async (req: Request, res: Response) => {
    const actor = actorOf(res)
    const record = await documents.findById(String(req.params.id))
    if (!record || record.requestId === null) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    const client = await deps.pool.connect()
    let removed: PrivateDocumentRecord | undefined
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<{ owner_id: string; company_id: string | null; status: string }>(
        'SELECT owner_id, company_id, status::text AS status FROM dashboard.requests WHERE id = $1 FOR UPDATE',
        [record.requestId],
      )
      const current = rows[0]
      if (!current) {
        await client.query('ROLLBACK')
        res.status(404).json({ error: 'not_found' })
        return
      }
      const companyId = await actorCompanyId(actor.id, actor.operationalRole)
      if (
        !canDeleteDocument(
          actor.operationalRole,
          { requestOwnerId: current.owner_id, requestCompanyId: current.company_id, requestStatus: current.status },
          actor.id,
          companyId,
        )
      ) {
        await client.query('ROLLBACK')
        res.status(403).json({ error: 'forbidden' })
        return
      }
      removed = await documents.delete(record.id, client)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    if (!removed) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    await storage.remove(removed.storageKey)
    res.json({ success: true })
  })

  return router
}
