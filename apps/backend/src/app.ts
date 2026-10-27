import express from 'express'
import type { Express } from 'express'
import path from 'node:path'
import type { Pool } from 'pg'

import { createAuthRouter, type AuthDeps } from './auth/router.js'
import type { CompanyStore } from './auth/company-store.js'
import type { ServiceCatalog } from './catalog/service-catalog.js'
import type { DossierDocumentSource } from './dashboard/dossier.js'
import type { EventStore } from './dashboard/event-repo.js'
import type { NotificationOutbox } from './dashboard/notification-outbox.js'
import { createDashboardRouter } from './dashboard/router.js'
import { PrivateDocumentStorage } from './documents/storage.js'
import type { BoothCatalogueRepository } from './exhibitions/catalogue-repo.js'
import type { ExhibitionStore } from './exhibitions/exhibition-store.js'

export interface AppDeps extends AuthDeps {
  pool: Pool
  serviceCatalog: ServiceCatalog
  proxySecret: string
  companyStore: CompanyStore
  /** Required in production; tests may inject a disposable directory. */
  privateDocumentStorage?: PrivateDocumentStorage
  /** Test seam for the company dossier document inventory. */
  dossierDocuments?: DossierDocumentSource
  /** Tests may inject an in-memory store; production always uses Postgres. */
  eventStore?: EventStore
  boothCatalogue?: BoothCatalogueRepository
  exhibitionStore?: ExhibitionStore
  notificationOutbox?: NotificationOutbox
}

export function createApp(deps: AppDeps): Express {
  const app = express()
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.get('/.well-known/jwks.json', async (_req, res) => {
    res.json(await deps.jwt.jwks())
  })

  app.use('/auth', createAuthRouter(deps))
  app.use(
    '/',
    createDashboardRouter({
      ...deps,
      privateDocumentStorage:
        deps.privateDocumentStorage ??
        new PrivateDocumentStorage(
          process.env.PRIVATE_DOCUMENTS_DIR ?? path.resolve(process.cwd(), '.private-documents'),
        ),
    }),
  )

  return app
}
