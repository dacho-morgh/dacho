import express from 'express'
import type { Express } from 'express'

import { createAuthRouter, type AuthDeps } from './auth/router.js'

export function createApp(deps: AuthDeps): Express {
  const app = express()
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.get('/.well-known/jwks.json', async (_req, res) => {
    res.json(await deps.jwt.jwks())
  })

  app.use('/auth', createAuthRouter(deps))

  return app
}
