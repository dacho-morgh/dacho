import {
  EDITOR_CONTENT_GLOBALS,
  EDITOR_CONTENT_SLUGS,
  hasContentRole,
  isEditorWritableCollection,
  isEditorWritableGlobal,
  isEditorWritableSlug,
} from '@cms-core/access/editorContent'
import { hasCmsRole } from '@cms-core/access/hasCmsRole'
import { isContentEditor } from '@cms-core/access/roles'
import { Categories } from '@cms-core/collections/Categories'
import { FAQ } from '@cms-core/collections/FAQ'
import { Media } from '@cms-core/collections/Media'
import { News } from '@cms-core/collections/News'
import { Posts } from '@cms-core/collections/Posts'
import { Mag } from '@cms-core/globals/Mag'
import type { User } from '@dacho/cms-core'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'

/**
 * The `editor` («تحریر») content desk.
 *
 * Two things are asserted here. First, that the declared scope in
 * `access/editorContent` still matches the collections that actually use
 * `hasContentRole` — the scope is declared in one place but wired per
 * collection, so it needs a drift guard. Second, the behaviour that matters:
 * an editor can publish, and a company representative can no longer write
 * content at all (they never should have been able to — every content
 * collection used to be gated on `authenticated` alone).
 */

const CONFIGS = { categories: Categories, faq: FAQ, media: Media, news: News, posts: Posts }
const PHONES = ['09910000011', '09910000012', '09910000013']
const EMAILS = [
  'int-editor@example.com',
  'int-editor-representative@example.com',
  'int-editor-admin@example.com',
]

let payload: Payload
let editor: User
let representative: User
let admin: User

const cleanup = async () => {
  await payload.delete({ collection: 'posts', where: { slug: { like: 'int-editor-%' } } })
  await payload.delete({ collection: 'users', where: { phone: { in: PHONES } } })
}

/** A `req` carrying `user` for the pure access predicates. */
const reqFor = (user: unknown) => ({ req: { user } }) as never

// `allowRoleAssignment` opts out of the beforeChange escalation guard, which
// otherwise rewrites every non-admin create to `representative` — the guard the
// signup tests cover. Without it no fixture could hold a non-default role.
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

// The minimal rich-text body `posts.content` requires.
const CONTENT = {
  root: {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', text: 'متن' }] }],
  },
} as never

describe('editor role', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
    // Created with overrideAccess on (the default) so the admin guard does not
    // block the fixtures themselves; the role is what the tests then exercise.
    editor = await makeUser(0, 'تحریر تست', ['editor'])
    representative = await makeUser(1, 'نماینده تست')
    admin = await makeUser(2, 'مدیر تست', ['admin'])
  })

  afterAll(async () => {
    await cleanup()
  })

  describe('declared scope has not drifted from the wiring', () => {
    it('gates every declared collection on hasContentRole for all three writes', () => {
      for (const slug of EDITOR_CONTENT_SLUGS) {
        const collection = CONFIGS[slug as keyof typeof CONFIGS]
        expect(collection, `${slug} is declared but has no imported config`).toBeDefined()
        expect(isEditorWritableCollection(collection!), slug).toBe(true)
      }
    })

    it('gates the declared global on hasContentRole for update', () => {
      for (const slug of EDITOR_CONTENT_GLOBALS) {
        const global = slug === 'mag' ? Mag : undefined
        expect(global, `${slug} is declared but has no imported config`).toBeDefined()
        expect(isEditorWritableGlobal(global!)).toBe(true)
      }
    })

    it('gates nothing outside the declared scope', async () => {
      const sanitized = await config
      const editorsGated = [
        ...sanitized.collections
          .filter((c) => c.access?.create === hasContentRole)
          .map((c) => c.slug),
        ...sanitized.globals.filter((g) => g.access?.update === hasContentRole).map((g) => g.slug),
      ]

      expect([...editorsGated].sort()).toEqual(
        [...EDITOR_CONTENT_SLUGS, ...EDITOR_CONTENT_GLOBALS].sort(),
      )
    })

    it('recognises exactly the declared slugs as editor-writable', () => {
      expect(isEditorWritableSlug('posts')).toBe(true)
      expect(isEditorWritableSlug('mag')).toBe(true)
      expect(isEditorWritableSlug('companies')).toBe(false)
      expect(isEditorWritableSlug('services')).toBe(false)
      expect(isEditorWritableSlug('users')).toBe(false)
    })
  })

  describe('predicates', () => {
    it('treats admin and editor as content writers, and nobody else', () => {
      expect(isContentEditor({ roles: ['admin'] })).toBe(true)
      expect(isContentEditor({ roles: ['editor'] })).toBe(true)
      expect(isContentEditor({ roles: ['editor', 'referee'] })).toBe(true)
      expect(isContentEditor({ roles: ['representative'] })).toBe(false)
      expect(isContentEditor({ roles: ['referee'] })).toBe(false)
      expect(isContentEditor({ roles: [] })).toBe(false)
      expect(isContentEditor(null)).toBe(false)
    })

    it('lets an editor reach the Payload panel but not a representative', () => {
      expect(hasCmsRole(reqFor({ roles: ['editor'] }))).toBe(true)
      expect(hasCmsRole(reqFor({ roles: ['admin'] }))).toBe(true)
      expect(hasCmsRole(reqFor({ roles: ['representative'] }))).toBe(false)
      expect(hasCmsRole(reqFor(null))).toBe(false)
    })
  })

  describe('publishing', () => {
    it('lets an editor create a post', async () => {
      const post = await payload.create({
        collection: 'posts',
        data: { title: 'مقاله تحریر', slug: 'int-editor-post', content: CONTENT },
        user: editor,
        // The Local API bypasses access unless told otherwise, so every
        // behavioural assertion below opts back in explicitly.
        overrideAccess: false,
      })

      expect(post.id).toBeDefined()
    })

    it('lets an editor update the mag global', async () => {
      // Write the value that is already there, so the assertion is about access
      // rather than about a specific field.
      const before = await payload.findGlobal({ slug: 'mag', depth: 0 })
      // A never-saved global omits the relationship; persisted empty values are null.
      const hero = before.hero ?? null
      const updated = await payload.updateGlobal({
        slug: 'mag',
        data: { hero },
        depth: 0,
        user: editor,
        overrideAccess: false,
        context: { disableRevalidate: true },
      })

      expect(updated.hero).toEqual(hero)
    })

    it('still lets an admin create a post', async () => {
      const post = await payload.create({
        collection: 'posts',
        data: { title: 'مقاله مدیر', slug: 'int-editor-admin-post', content: CONTENT },
        user: admin,
        overrideAccess: false,
      })

      expect(post.id).toBeDefined()
    })

    it('refuses a company representative', async () => {
      await expect(
        payload.create({
          collection: 'posts',
          data: { title: 'مقاله غیرمجاز', slug: 'int-editor-forbidden', content: CONTENT },
          user: representative,
          overrideAccess: false,
        }),
      ).rejects.toThrow()

      await expect(
        payload.updateGlobal({
          slug: 'mag',
          data: {},
          user: representative,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })

    it('refuses an anonymous visitor', async () => {
      await expect(
        payload.create({
          collection: 'posts',
          data: { title: 'مقاله ناشناس', slug: 'int-editor-anonymous', content: CONTENT },
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })
  })
})
