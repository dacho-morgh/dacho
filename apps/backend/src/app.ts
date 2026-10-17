import express from 'express'
import type { Express } from 'express'
import type { Pool } from 'pg'

import { createAuthRouter, type AuthDeps } from './auth/router.js'
import type { CompanyStore } from './auth/company-store.js'
import type { ServiceCatalog } from './catalog/service-catalog.js'
import { createDashboardRouter } from './dashboard/router.js'

export interface AppDeps extends AuthDeps {
  pool: Pool
  serviceCatalog: ServiceCatalog
  proxySecret: string
  companyStore: CompanyStore
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
  app.use('/', createDashboardRouter(deps))

  return app
}
