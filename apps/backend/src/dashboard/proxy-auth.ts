import type { NextFunction, Request, Response } from 'express'

import type { UserRole } from '../auth/user-store.js'
import { USER_ROLES } from '../auth/user-store.js'

/**
 * Authenticates dashboard requests that arrive through the same-origin Next.js
 * proxy. The proxy resolves the Payload session server-side and forwards the
 * acting user id; the shared `x-internal-proxy-secret` header proves the request
 * came from our proxy rather than a direct external caller.
 */
export function requireProxyAuth(proxySecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.headers['x-internal-proxy-secret'] !== proxySecret) {
      res.status(403).json({ error: 'forbidden' })
      return
    }

    const userId = req.headers['x-user-id']
    if (typeof userId !== 'string' || userId.trim() === '') {
      res.status(401).json({ error: 'unauthorized' })
      return
    }

    res.locals.userId = userId

    // The acting user's roles, comma-separated. This is the single
    // authorization axis — the former `x-user-role` (applicant|staff) and
    // `x-user-cms-role` (admin|editor) headers are gone.
    const rolesHeader = req.headers['x-user-roles']
    const roles = typeof rolesHeader === 'string' ? rolesHeader.split(',') : []
    res.locals.userRoles = roles
      .map((role) => role.trim())
      .filter((role): role is UserRole => (USER_ROLES as readonly string[]).includes(role))

    next()
  }
}
