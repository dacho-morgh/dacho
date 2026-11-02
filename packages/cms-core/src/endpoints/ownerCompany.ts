import { commitTransaction, initTransaction, type Endpoint } from 'payload'

import { hasOperationalRole, isActiveAccount } from '@cms-core/access/roles'
import { normalizeDigits, runSelfSignup } from '@cms-core/auth/self-signup'

/**
 * T57 (#219, slice S4 #242): the System Owner enrolls a company together with
 * its representative, atomically, through the same validation as public
 * signup. The representative signs in with the phone and the temporary
 * password the owner sets, then changes it from their profile (T58).
 *
 * The company starts unverified and goes through the Secretariat's normal
 * verification. The creator and time are recorded on the representative's
 * `personnelHistory` (source `owner`), because the owner's session performs
 * the create.
 */
export const ownerCreateCompany: Endpoint = {
  path: '/owner-create',
  method: 'post',
  handler: async (req) => {
    if (!isActiveAccount(req.user) || !hasOperationalRole(req.user, 'system-owner'))
      return Response.json({ errors: [{ code: 'forbidden', message: 'Forbidden.' }] }, { status: 403 })
    const body = await req.json?.().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return Response.json({ errors: [{ code: 'invalid_body', message: 'Invalid body.' }] }, { status: 400 })

    // Unlike anonymous signup, the owner is told which identifier is already in use.
    const conflicts: { code: string; field: string; message: string }[] = []
    const phone = typeof body.phone === 'string' ? normalizeDigits(body.phone.trim()) : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (phone) {
      const taken = await req.payload.find({
        collection: 'users', where: { or: [{ phone: { equals: phone } }, { username: { equals: phone } }] },
        limit: 1, depth: 0, overrideAccess: true,
      })
      if (taken.docs.length > 0) conflicts.push({ code: 'phone_taken', field: 'phone', message: 'Phone already in use.' })
    }
    if (email) {
      const taken = await req.payload.find({
        collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true,
      })
      if (taken.docs.length > 0) conflicts.push({ code: 'email_taken', field: 'email', message: 'Email already in use.' })
    }
    if (conflicts.length > 0) return Response.json({ errors: conflicts }, { status: 409 })

    const result = await runSelfSignup(
      body,
      {
        companyNationalIdExists: async (nationalId) => {
          const existing = await req.payload.find({
            collection: 'companies', where: { nationalId: { equals: nationalId } },
            limit: 1, depth: 0, overrideAccess: true,
          })
          return existing.docs.length > 0
        },
        inTransaction: async (run) => {
          await initTransaction(req)
          try {
            const value = await run()
            await commitTransaction(req)
            return value
          } catch (error) {
            if (req.transactionID !== undefined) await req.payload.db.rollbackTransaction(req.transactionID)
            throw error
          }
        },
        createUser: async (data) =>
          req.payload.create({
            collection: 'users',
            data: { ...data, operationalRole: 'representative', isActive: true } as never,
            overrideAccess: false,
            req,
          }),
        createCompany: async (data) =>
          req.payload.create({ collection: 'companies', data: data as never, overrideAccess: false, req }),
      },
      (error) => console.error('[companies] owner-create failed', error),
    )
    return Response.json(result.body, { status: result.status })
  },
}
