import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { AuthStrategy } from 'payload'

/** Extracts the raw token from an `Authorization: Bearer <token>` header. */
export function extractBearerToken(headers: Headers): string | undefined {
  const value = headers.get('authorization')
  if (!value || !value.startsWith('Bearer ')) return undefined
  const token = value.slice('Bearer '.length).trim()
  return token || undefined
}

/** Verifies an ES256 token and returns its `sub`, or undefined when invalid. */
export async function verifyBackendToken(
  token: string,
  key: Parameters<typeof jwtVerify>[1],
): Promise<string | undefined> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['ES256'] })
    return typeof payload.sub === 'string' ? payload.sub : undefined
  } catch {
    return undefined
  }
}

/**
 * Custom auth strategy: verifies backend-issued ES256 JWTs against the
 * backend's JWKS, then resolves the `sub` claim to a users-collection doc.
 * Returns `{ user: null }` (falls through to other strategies) on any failure.
 */
export function createBackendJwtStrategy(jwksUrl: string | undefined): AuthStrategy {
  const jwks = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null

  return {
    name: 'backend-jwt',
    authenticate: async ({ headers, payload }) => {
      if (!jwks) return { user: null }

      const token = extractBearerToken(headers)
      if (!token) return { user: null }

      const id = await verifyBackendToken(token, jwks)
      if (!id) return { user: null }

      try {
        const user = await payload.findByID({ collection: 'users', id })
        if (!user) return { user: null }
        return { user: { ...user, collection: 'users' } }
      } catch {
        return { user: null }
      }
    },
  }
}
