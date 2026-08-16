import { randomInt } from 'node:crypto'
import { Router } from 'express'

import type { JwtSigner } from '../jwt.js'
import type { CodeStore } from '../otp/code-store.js'
import type { OtpDelivery } from '../otp/delivery.js'
import { requireAuth } from './middleware.js'
import type { ProfileFields, UserStore } from './user-store.js'

const OTP_TTL_SECONDS = 5 * 60

export interface AuthDeps {
  codeStore: CodeStore
  delivery: OtpDelivery
  jwt: JwtSigner
  userStore: UserStore
}

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function createAuthRouter(deps: AuthDeps): Router {
  const router = Router()

  router.post('/request-otp', async (req, res) => {
    const phone = req.body?.phone
    if (typeof phone !== 'string' || phone.trim() === '') {
      res.status(400).json({ error: 'invalid_phone' })
      return
    }

    try {
      const code = generateCode()
      await deps.codeStore.save(phone, code, OTP_TTL_SECONDS)
      await deps.delivery.send(phone, code)
      res.status(202).json({ ok: true })
    } catch (err) {
      console.error('[auth] request-otp failed', err)
      res.status(500).json({ error: 'delivery_failed' })
    }
  })

  router.post('/verify-otp', async (req, res) => {
    const { phone, code } = req.body ?? {}
    if (typeof phone !== 'string' || typeof code !== 'string') {
      res.status(400).json({ error: 'invalid_request' })
      return
    }

    const valid = await deps.codeStore.verify(phone, code)
    if (!valid) {
      res.status(401).json({ error: 'invalid_code' })
      return
    }

    const user = await deps.userStore.findOrCreateByPhone(phone)
    const token = await deps.jwt.sign({ phone }, user.id)

    res.json({ token, user })
  })

  router.post('/complete-profile', requireAuth(deps.jwt), async (req, res) => {
    const userId = res.locals.userId as string
    const user = await deps.userStore.findById(userId)
    if (!user) {
      res.status(404).json({ error: 'not_found' })
      return
    }

    const { name, companyId } = req.body ?? {}
    const fields: ProfileFields = {}
    if (name !== undefined) {
      if (typeof name !== 'string') {
        res.status(400).json({ error: 'invalid_name' })
        return
      }
      fields.name = name
    }
    if (companyId !== undefined) {
      if (typeof companyId !== 'string') {
        res.status(400).json({ error: 'invalid_company' })
        return
      }
      fields.companyId = companyId
    }

    const updated = await deps.userStore.update(userId, fields)
    res.json({ user: updated })
  })

  return router
}
