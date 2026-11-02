import { adminOnly } from '@cms-core/access/adminOnly'
import path from 'path'
import { APIError, type CollectionConfig } from 'payload'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/** docs/system/document-policy.json: Word/PDF, 10 MB (decimal, inclusive) per file. */
export const PERSONNEL_FILE_MAX_BYTES = 10_000_000
export const PERSONNEL_FILE_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

/**
 * Personnel resumes. Unlike `media`, files are stored outside `public/` and are
 * served only through Payload's access-checked file route, so a resume is never
 * reachable by URL guessing.
 */
export const PersonnelFiles: CollectionConfig = {
  slug: 'personnel-files',
  labels: { singular: 'فایل کارمند', plural: 'فایل‌های کارکنان' },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    beforeOperation: [
      ({ req, operation }) => {
        if ((operation === 'create' || operation === 'update') && req.file) {
          if (req.file.size > PERSONNEL_FILE_MAX_BYTES)
            throw new APIError('حجم هر فایل حداکثر ۱۰ مگابایت است.', 413)
        }
      },
    ],
  },
  fields: [],
  upload: {
    staticDir:
      process.env.PAYLOAD_PRIVATE_FILES_DIR || path.resolve(dirname, '../../private/personnel-files'),
    mimeTypes: PERSONNEL_FILE_MIME_TYPES,
    focalPoint: false,
  },
}
