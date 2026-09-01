import type { NextFunction, Request, Response } from 'express'

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

    const rolesHeader = req.headers['x-user-roles']
    res.locals.userRoles =
      typeof rolesHeader === 'string'
        ? rolesHeader
            .split(',')
            .map((role) => role.trim())
            .filter(Boolean)
        : []

    const cmsRole = req.headers['x-user-cms-role']
    res.locals.userCmsRole = typeof cmsRole === 'string' ? cmsRole : undefined

    next()
  }
}
