import type { NextFunction, Request, Response } from 'express'

import type { JwtSigner } from '../jwt.js'

/** Express middleware: verifies the Bearer token and puts its `sub` into `res.locals.userId`. */
export function requireAuth(jwt: JwtSigner) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined

    if (!token) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }

    try {
      const payload = await jwt.verify(token)
      const subject = payload.sub
      if (typeof subject !== 'string') {
        res.status(401).json({ error: 'unauthorized' })
        return
      }
      res.locals.userId = subject
      next()
    } catch {
      res.status(401).json({ error: 'unauthorized' })
    }
  }
}
