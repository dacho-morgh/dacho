import path from 'path'
import { APIError, type Access, type CollectionConfig } from 'payload'
import { fileURLToPath } from 'url'

import { isBackendService, isCompanyAdministrator, isInternalAdmin } from '@cms-core/access/roles'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const COMPANY_LOGO_MAX_BYTES = 2_000_000
export const COMPANY_LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/** Owner and Secretariat manage logos; the backend service removes a replaced one. */
const canManageLogo: Access = ({ req }) =>
  isInternalAdmin(req.user) || isCompanyAdministrator(req.user) || isBackendService(req.user)

/**
 * Company logos. Like personnel resumes, files live outside `public/` and are served
 * only through Payload's access-checked file route, so a logo is not reachable by URL guessing.
 */
export const CompanyLogos: CollectionConfig = {
  slug: 'company-logos',
  labels: { singular: 'لوگوی شرکت', plural: 'لوگوهای شرکت‌ها' },
  access: {
    create: canManageLogo,
    read: canManageLogo,
    update: canManageLogo,
    delete: canManageLogo,
  },
  hooks: {
    beforeOperation: [
      ({ req, operation }) => {
        if ((operation === 'create' || operation === 'update') && req.file) {
          if (req.file.size > COMPANY_LOGO_MAX_BYTES)
            throw new APIError('حجم لوگو حداکثر ۲ مگابایت است.', 413)
        }
      },
    ],
  },
  fields: [],
  upload: {
    // A subfolder of the shared private volume, so a logo can never overwrite a personnel file of the same name.
    staticDir: process.env.PAYLOAD_PRIVATE_FILES_DIR
      ? path.join(process.env.PAYLOAD_PRIVATE_FILES_DIR, 'company-logos')
      : path.resolve(dirname, '../../private/company-logos'),
    mimeTypes: COMPANY_LOGO_MIME_TYPES,
    focalPoint: false,
  },
}
