import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import type { Pool } from 'pg'
import type { CompanyStore } from '../auth/company-store.js'
import { actorOf } from './proxy-auth.js'
import { isUuid } from '../db/uuid.js'
import { DOCUMENT_POLICY_VERSION, MAX_DOCUMENT_BYTES, validateDocumentFile } from '../documents/policy.js'
import type { PrivateDocumentStorage } from '../documents/storage.js'
import { RequestRepository } from './request-repo.js'
import { bindRequestScope, requestScopeFor } from '../access/policy.js'
import {
  DEFAULT_PROPOSAL_TEMPLATE_FILENAME,
  DEFAULT_PROPOSAL_TEMPLATE_MIME,
  defaultProposalTemplateBody,
} from './default-proposal-template.js'

interface Deps {
  pool: Pool
  companyStore: CompanyStore
  privateDocumentStorage: PrivateDocumentStorage
}

const base = '/events/:eventId/subtopics/:subtopicId/rfp'
const templatePath = '/events/:eventId/proposal-template'
const fileColumns = 'id, filename, mime_type AS "mimeType", size_bytes AS "sizeBytes", policy_version AS "policyVersion"'

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
                  `INSERT INTO dashboard.rfp_files (version_id, storage_key, filename, mime_type, size_bytes, position, policy_version)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   RETURNING ${fileColumns}`,
                  [version.id, key, file.filename, file.mimeType, file.sizeBytes, records.length, DOCUMENT_POLICY_VERSION],
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

  // ── The event's sample proposal form (نمونه فرم پروپوزال) ───────────────────────────────────────────
  // Every event offers one. Until the owner replaces it, the bundled default below is served; a reset
  // deletes the replacement so the default applies again.
  router.use(`/admin${templatePath}`, (_req, res, next) => {
    if (actorOf(res).operationalRole !== 'system-owner') {
      res.status(403).json({ error: 'forbidden' })
      return
    }
    next()
  })

  const eventExists = async (eventId: string | undefined): Promise<boolean> =>
    typeof eventId === 'string' &&
    isUuid(eventId) &&
    ((await pool.query('SELECT 1 FROM dashboard.events WHERE id=$1', [eventId])).rowCount ?? 0) > 0

  interface TemplateRow {
    storage_key: string
    filename: string
    mimeType: string
    sizeBytes: number
    updatedAt: string
  }
  const readTemplateRow = async (eventId: string): Promise<TemplateRow | undefined> =>
    (
      await pool.query<TemplateRow>(
        `SELECT storage_key, filename, mime_type AS "mimeType", size_bytes AS "sizeBytes", updated_at AS "updatedAt"
         FROM dashboard.event_proposal_templates WHERE event_id=$1`,
        [eventId],
      )
    ).rows[0]

  const describeTemplate = (row: TemplateRow | undefined) =>
    row
      ? { filename: row.filename, mimeType: row.mimeType, sizeBytes: row.sizeBytes, isDefault: false, updatedAt: row.updatedAt }
      : {
          filename: DEFAULT_PROPOSAL_TEMPLATE_FILENAME,
          mimeType: DEFAULT_PROPOSAL_TEMPLATE_MIME,
          sizeBytes: defaultProposalTemplateBody().length,
          isDefault: true,
          updatedAt: null,
        }

  router.get(templatePath, async (req, res, next) => {
    try {
      const { eventId } = req.params
      if (!(await eventExists(eventId))) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      res.set('Cache-Control', 'private, no-store').json({ template: describeTemplate(await readTemplateRow(eventId!)) })
    } catch (error) {
      next(error)
    }
  })

  router.get(`${templatePath}/file`, async (req, res, next) => {
    try {
      const { eventId } = req.params
      if (!(await eventExists(eventId))) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const row = await readTemplateRow(eventId!)
      const meta = describeTemplate(row)
      const body = row ? await storage.read(row.storage_key) : defaultProposalTemplateBody()
      if (!body) {
        res.status(410).json({ error: 'document_unavailable' })
        return
      }
      res
        .set({
          'Content-Type': meta.mimeType,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.filename)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
        })
        .send(body)
    } catch (error) {
      next(error)
    }
  })

  const uploadTemplate = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_DOCUMENT_BYTES + 1 },
  }).single('file')

  router.put(
    `/admin${templatePath}`,
    (req, res, next) => {
      uploadTemplate(req, res, (error: unknown) => {
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
      let savedKey: string | null = null
      try {
        const { eventId } = req.params
        if (!(await eventExists(eventId))) {
          res.status(404).json({ error: 'not_found' })
          return
        }
        if (!req.file) {
          res.status(400).json({ error: 'invalid_file' })
          return
        }
        const result = validateDocumentFile({
          category: 'rfp',
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          body: req.file.buffer,
        })
        if (!result.ok) {
          res.status(result.error === 'file_too_large' ? 413 : 400).json({ error: result.error })
          return
        }
        const file = result.file
        savedKey = await storage.save(file.body, file.extension)
        const previous = await readTemplateRow(eventId!)
        await pool.query(
          `INSERT INTO dashboard.event_proposal_templates
             (event_id, storage_key, filename, mime_type, size_bytes, policy_version, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (event_id) DO UPDATE SET
             storage_key=EXCLUDED.storage_key, filename=EXCLUDED.filename, mime_type=EXCLUDED.mime_type,
             size_bytes=EXCLUDED.size_bytes, policy_version=EXCLUDED.policy_version,
             updated_by=EXCLUDED.updated_by, updated_at=now()`,
          [eventId, savedKey, file.filename, file.mimeType, file.sizeBytes, DOCUMENT_POLICY_VERSION, actorOf(res).id],
        )
        const keep = savedKey
        savedKey = null
        if (previous && previous.storage_key !== keep) await storage.remove(previous.storage_key).catch(() => undefined)
        res.json({ template: describeTemplate(await readTemplateRow(eventId!)) })
      } catch (error) {
        if (savedKey) await storage.remove(savedKey).catch(() => undefined)
        next(error)
      }
    },
  )

  router.delete(`/admin${templatePath}`, async (req, res, next) => {
    try {
      const { eventId } = req.params
      if (!(await eventExists(eventId))) {
        res.status(404).json({ error: 'not_found' })
        return
      }
      const removed = (
        await pool.query<{ storage_key: string }>(
          'DELETE FROM dashboard.event_proposal_templates WHERE event_id=$1 RETURNING storage_key',
          [eventId],
        )
      ).rows[0]
      if (removed) await storage.remove(removed.storage_key).catch(() => undefined)
      res.json({ template: describeTemplate(undefined) })
    } catch (error) {
      next(error)
    }
  })


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
           JOIN dashboard.events e ON e.id = s.event_id
           JOIN dashboard.rfp_versions v ON v.subtopic_id = s.id
           WHERE s.event_id = $1 AND s.id = $2 AND v.id = COALESCE($3::uuid, s.current_rfp_version_id)
             AND ($4::boolean OR (v.id = s.current_rfp_version_id AND (
               $5::text IS NOT NULL
               OR ($6::text = 'chief-reviewer' AND e.responsible_chief_id = $7)
               OR ($6::text = 'employer-reviewer' AND s.employer_id = $7)
             )))`,
          [eventId, subtopicId, versionId ?? null, admin, company?.id ?? null, actor.operationalRole, actor.id],
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
