import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import type { Pool } from 'pg'
import type { CompanyStore } from '../auth/company-store.js'
import { actorOf } from './proxy-auth.js'
import { isUuid } from '../db/uuid.js'
import { MAX_DOCUMENT_BYTES, validateDocumentFile } from '../documents/policy.js'
import type { PrivateDocumentStorage } from '../documents/storage.js'
import { RequestRepository } from './request-repo.js'
import { bindRequestScope, requestScopeFor } from '../access/policy.js'

interface Deps {
  pool: Pool
  companyStore: CompanyStore
  privateDocumentStorage: PrivateDocumentStorage
}

const base = '/events/:eventId/subtopics/:subtopicId/rfp'
const fileColumns = 'id, filename, mime_type AS "mimeType", size_bytes AS "sizeBytes"'

export function createRfpRouter({ pool, companyStore, privateDocumentStorage: storage }: Deps): Router {
  const router = Router()
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_DOCUMENT_BYTES + 1 },
  }).array('files')

  router.use(`/admin${base}`, (_req, res, next) => {
    if (actorOf(res).operationalRole !== 'system-owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  })

  router.post(
    `/admin${base}`,
    (req, res, next) => {
      upload(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError) {
          res
            .status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
            .json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : 'invalid_file' })
          return
        }
        if (error) {
          next(error)
          return
        }
        next()
      })
    },
    async (req, res, next) => {
      const saved: string[] = []
      try {
        const { eventId, subtopicId } = req.params
        if (!isUuid(eventId) || !isUuid(subtopicId)) {
          res.status(404).json({ error: 'not_found' })
          return
        }
        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
        const expected = req.body?.expectedVersionId
        if (!reason || typeof expected !== 'string' || (expected !== '' && !isUuid(expected))) {
          res.status(400).json({ error: 'invalid_rfp' })
          return
        }
        const files = Array.isArray(req.files) ? req.files : []
        if (!files.length) {
          res.status(400).json({ error: 'invalid_file' })
          return
        }
        const validated = files.map((file) =>
          validateDocumentFile({
            category: 'rfp',
            filename: file.originalname,
            mimeType: file.mimetype,
            body: file.buffer,
          }),
        )
        for (const result of validated) {
          if (!result.ok) {
            res
              .status(result.error === 'file_too_large' ? 413 : 400)
              .json({ error: result.error })
            return
          }
        }
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const current = (
            await client.query<{ current_rfp_version_id: string | null }>(
              'SELECT current_rfp_version_id FROM dashboard.event_subtopics WHERE id=$1 AND event_id=$2 FOR UPDATE',
              [subtopicId, eventId],
            )
          ).rows[0]
          if (!current) {
            await client.query('ROLLBACK')
            res.status(404).json({ error: 'not_found' })
            return
          }
          if ((current.current_rfp_version_id ?? '') !== expected) {
            await client.query('ROLLBACK')
            res.status(409).json({ error: 'stale_rfp' })
            return
          }
          const version = (
            await client.query(
              `INSERT INTO dashboard.rfp_versions (subtopic_id, created_by, reason)
               VALUES ($1, $2, $3)
               RETURNING id, subtopic_id AS "subtopicId", created_by AS "createdBy", created_at AS "createdAt", reason`,
              [subtopicId, actorOf(res).id, reason],
            )
          ).rows[0]
          const records = []
          for (const result of validated) {
            if (!result.ok) continue
            const file = result.file
            const key = await storage.save(file.body, file.extension)
            saved.push(key)
            records.push(
              (
                await client.query(
                  `INSERT INTO dashboard.rfp_files (version_id, storage_key, filename, mime_type, size_bytes, position)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   RETURNING ${fileColumns}`,
                  [version.id, key, file.filename, file.mimeType, file.sizeBytes, records.length],
                )
              ).rows[0],
            )
          }
          await client.query('UPDATE dashboard.event_subtopics SET current_rfp_version_id=$2 WHERE id=$1', [
            subtopicId,
            version.id,
          ])
          await client.query('COMMIT')
          res.status(201).json({ version: { ...version, files: records } })
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined)
          throw error
        } finally {
          client.release()
        }
      } catch (error) {
        await Promise.allSettled(saved.map((key) => storage.remove(key)))
        next(error)
      }
    },
  )

  async function readRfp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let { eventId, subtopicId, versionId } = req.params
      const { fileId, requestId } = req.params
      const actor = actorOf(res)
      const company =
        actor.operationalRole === 'representative' ? await companyStore.findByRepresentative(actor.id) : undefined
      let pinned = false

      if (requestId) {
        const parent = await new RequestRepository(pool).findByIdScoped(
          requestId,
          bindRequestScope(requestScopeFor(actor.operationalRole), actor.id, company?.id),
        )
        if (!parent) {
          res.status(404).json({ error: 'not_found' })
          return
        }
        const context = (
          await pool.query<{ event_id: string; subtopic_id: string; version_id: string }>(
            'SELECT event_id, subtopic_id, version_id FROM dashboard.request_rfps WHERE request_id=$1',
            [requestId],
          )
        ).rows[0]
        if (!context) {
          res.status(404).json({ error: 'not_found' })
          return
        }
        eventId = context.event_id
        subtopicId = context.subtopic_id
        versionId = context.version_id
        pinned = true
      }

      if (
        ![
          eventId,
          subtopicId,
          ...(versionId ? [versionId] : []),
          ...(fileId ? [fileId] : []),
        ].every((id) => typeof id === 'string' && isUuid(id))
      ) {
        res.status(404).json({ error: 'not_found' })
        return
      }

      const admin = pinned || actor.operationalRole === 'system-owner' || actor.operationalRole === 'central-secretariat'
      const version = (
        await pool.query(
          `SELECT v.id, v.subtopic_id AS "subtopicId", v.created_by AS "createdBy", v.created_at AS "createdAt", v.reason
           FROM dashboard.event_subtopics s
           JOIN dashboard.rfp_versions v ON v.subtopic_id = s.id
           WHERE s.event_id = $1 AND s.id = $2 AND v.id = COALESCE($3::uuid, s.current_rfp_version_id)
             AND ($4::boolean OR ($5::text IS NOT NULL AND v.id = s.current_rfp_version_id))`,
          [eventId, subtopicId, versionId ?? null, admin, company?.id ?? null],
        )
      ).rows[0]

      if (!version) {
        res.status(404).json({ error: 'not_found' })
        return
      }

      if (!fileId) {
        const files = (
          await pool.query(
            `SELECT ${fileColumns} FROM dashboard.rfp_files WHERE version_id=$1 ORDER BY position`,
            [version.id],
          )
        ).rows
        res.set('Cache-Control', 'private, no-store').json({ version: { ...version, files } })
        return
      }

      const file = (
        await pool.query(
          `SELECT ${fileColumns}, storage_key FROM dashboard.rfp_files WHERE id=$1 AND version_id=$2`,
          [fileId, version.id],
        )
      ).rows[0]

      if (!file) {
        res.status(404).json({ error: 'not_found' })
        return
      }

      const body = await storage.read(file.storage_key)
      if (!body) {
        res.status(410).json({ error: 'document_unavailable' })
        return
      }

      res
        .set({
          'Content-Type': file.mimeType,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
        })
        .send(body)
    } catch (error) {
      next(error)
    }
  }

  router.get(
    [
      base,
      `${base}/:versionId/files/:fileId`,
      '/requests/:requestId/rfp',
      '/requests/:requestId/rfp/files/:fileId',
    ],
    readRfp,
  )

  return router
}
