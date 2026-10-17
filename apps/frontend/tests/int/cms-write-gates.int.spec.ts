import { adminOnly } from '@cms-core/access/adminOnly'
import { hasContentRole } from '@cms-core/access/editorContent'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { User } from '@dacho/cms-core'
import config from '@/payload.config'

/**
 * Nobody outside the Fund may write the CMS.
 *
 * Every content collection and every global used to gate writes on the bare
 * `authenticated` rule — "any signed-in user" — which meant a self-registered
 * company representative could create, edit and delete site content, services,
 * events and navigation through the REST API. Only two gates are legitimate
 * now: `adminOnly` (everything outside the content desk) and `hasContentRole`
 * (the content desk, which `editor` also holds).
 *
 * The first test is the real guard — it walks the sanitized config and fails if
 * any write gate is missing, undefined, or anything else. The rest prove the
 * gates behave, because a config-level assertion cannot tell you whether the
 * access function returns the right answer.
 */

const PHONES = ['09910000021', '09910000022', '09910000023']
const EMAILS = [
  'int-cmswrite-representative@example.com',
  'int-cmswrite-editor@example.com',
  'int-cmswrite-admin@example.com',
]

let payload: Payload
let representative: User
let editor: User
let admin: User

const cleanup = async () => {
  await payload.delete({ collection: 'users', where: { phone: { in: PHONES } } })
}

const makeUser = (index: number, name: string, roles?: User['roles']) =>
  payload.create({
    collection: 'users',
    data: {
      email: EMAILS[index],
      password: 'int-test-password',
      phone: PHONES[index],
      name,
      ...(roles ? { roles } : {}),
    },
    context: { allowRoleAssignment: true },
  })

describe('CMS write gates', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
    representative = await makeUser(0, 'نماینده تست')
    editor = await makeUser(1, 'تحریر تست', ['editor'])
    admin = await makeUser(2, 'مدیر تست', ['admin'])
  })

  afterAll(cleanup)

  describe('no write gate is left open', () => {
    it('gates every collection write on adminOnly or hasContentRole', async () => {
      const sanitized = await config
      // Deliberate exceptions, each a decision rather than an oversight:
      //   payload-*  — Payload's own internals, never user-reachable.
      //   users      — public on create (self-signup), self-scoped after.
      //   companies  — a company creates itself at signup and its own
      //                representative edits it; see access/Companies.ts.
      //   search     — a derived index of posts/news that Payload syncs
      //                internally; gating it would only break the sync.
      //   form-submissions — publicly creatable, because the site's contact
      //                forms are how a company reaches the Secretariat.
      const EXEMPT = ['users', 'companies', 'search', 'form-submissions']
      const offenders = sanitized.collections
        .filter((c) => !c.slug.startsWith('payload-') && !EXEMPT.includes(c.slug))
        .filter(
          (c) =>
            c.access?.create !== adminOnly ||
            c.access?.update !== adminOnly ||
            c.access?.delete !== adminOnly,
        )
        // The content desk is the one documented exception.
        .filter(
          (c) =>
            !(
              c.access?.create === hasContentRole &&
              c.access?.update === hasContentRole &&
              c.access?.delete === hasContentRole
            ),
        )
        .map((c) => c.slug)

      expect(offenders).toEqual([])
    })

    it('keeps the exemptions exempt, so the list above cannot rot', async () => {
      const sanitized = await config
      const users = sanitized.collections.find((c) => c.slug === 'users')!
      const companies = sanitized.collections.find((c) => c.slug === 'companies')!

      expect(users.access?.create).toBeTypeOf('function')
      expect(companies.access?.create).toBeTypeOf('function')
      expect(companies.access?.delete).toBe(adminOnly)
      // Not deletable or editable by another company, only by an admin or the
      // company's own representative.
      expect(companies.access?.update).not.toBe(adminOnly)
    })

    it('gates every global update on adminOnly or hasContentRole', async () => {
      const sanitized = await config
      // `SanitizedGlobalConfig` does not type `access.update`, so read it off
      // the loose shape rather than narrowing the whole config.
      const offenders = sanitized.globals
        .map((g) => ({ slug: g.slug, update: (g as { access?: { update?: unknown } }).access?.update }))
        .filter((g) => g.update !== adminOnly && g.update !== hasContentRole)
        .map((g) => g.slug)

      expect(offenders).toEqual([])
    })
  })

  describe('behaviour', () => {
    it('refuses a company representative everywhere outside the content desk', async () => {
      // Each case keeps its own literal so Payload's generated types still
      // check the data; `slug` doubles as the test label.
      const attempt = (slug: string, create: () => Promise<unknown>) =>
        expect(create(), slug).rejects.toThrow()

      await attempt('pages', () =>
        payload.create({
          collection: 'pages',
          data: { title: 'صفحه غیرمجاز', slug: 'int-cmswrite-page' },
          draft: true,
          user: representative,
          overrideAccess: false,
        }),
      )
      await attempt('services', () =>
        payload.create({
          collection: 'services',
          data: { title: 'خدمت غیرمجاز' },
          draft: true,
          user: representative,
          overrideAccess: false,
        }),
      )
      await attempt('sponsors', () =>
        payload.create({
          collection: 'sponsors',
          data: { name: 'حامی غیرمجاز' },
          draft: true,
          user: representative,
          overrideAccess: false,
        }),
      )
      await attempt('exhibitions', () =>
        payload.create({
          collection: 'exhibitions',
          data: { title: 'نمایشگاه غیرمجاز' },
          draft: true,
          user: representative,
          overrideAccess: false,
        }),
      )
      await attempt('reviews', () =>
        payload.create({
          collection: 'reviews',
          data: { displayName: 'نظر غیرمجاز' },
          draft: true,
          user: representative,
          overrideAccess: false,
        }),
      )
      await attempt('sliders', () =>
        payload.create({
          collection: 'sliders',
          data: { name: 'اسلاید غیرمجاز' },
          draft: true,
          user: representative,
          overrideAccess: false,
        }),
      )

      await expect(
        payload.updateGlobal({
          slug: 'header',
          data: {},
          user: representative,
          overrideAccess: false,
        }),
      ).rejects.toThrow()

      await expect(
        payload.updateGlobal({
          slug: 'site-settings',
          data: {},
          user: representative,
          overrideAccess: false,
        }),
      ).rejects.toThrow()

      await expect(
        payload.find({
          collection: 'newsletter-subscribers',
          user: representative,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })

    it('refuses an anonymous visitor', async () => {
      await expect(
        payload.create({
          collection: 'services',
          data: { title: 'خدمت ناشناس' },
          overrideAccess: false,
        }),
      ).rejects.toThrow()

      await expect(
        payload.updateGlobal({ slug: 'footer', data: {}, overrideAccess: false }),
      ).rejects.toThrow()
    })

    it('still lets an admin write admin-only content', async () => {
      await expect(
        payload.create({
          collection: 'services',
          data: { title: 'خدمت مدیر' },
          draft: true,
          user: admin,
          overrideAccess: false,
          context: { disableRevalidate: true },
        }),
      ).resolves.toBeDefined()

      await payload.delete({
        collection: 'services',
        where: { title: { equals: 'خدمت مدیر' } },
      })
    })

    it('refuses an editor the admin-only content too', async () => {
      await expect(
        payload.create({
          collection: 'services',
          data: { title: 'خدمت تحریر' },
          draft: true,
          user: editor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()

      await expect(
        payload.updateGlobal({
          slug: 'site-settings',
          data: {},
          user: editor,
          overrideAccess: false,
          context: { disableRevalidate: true },
        }),
      ).rejects.toThrow()
    })
  })
})