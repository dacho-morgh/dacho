import type { Access, AccessArgs, CollectionConfig, GlobalConfig } from 'payload'

import type { User } from '@cms-core/payload-types'

import { isContentEditor } from '@cms-core/access/roles'

/**
 * What an `editor` («تحریر») is allowed to write.
 *
 * The role was added for a small content desk: it can publish posts and news,
 * keep their categories and FAQ tidy, upload media, and shape the `mag`
 * landing page. Everything else — companies, services, the events calendar,
 * users, the dashboard instances — stays with `admin`.
 *
 * The scope is declared here once rather than being re-derived at each call
 * site, so the answer to "what may an editor touch?" has a single source.
 * Wiring it into a collection is still a per-collection edit
 * (`create`/`update`/`delete` → `hasContentRole`), which
 * `tests/access/editor-scope.int.spec.ts` asserts has not drifted from this
 * list.
 */
export const EDITOR_CONTENT_SLUGS = ['posts', 'news', 'categories', 'media', 'faq'] as const

/** `EDITOR_CONTENT_SLUGS` plus the single global an editor may write. */
export const EDITOR_CONTENT_GLOBALS = ['mag'] as const

export type EditorContentSlug = (typeof EDITOR_CONTENT_SLUGS)[number]

/**
 * Write access for editorial content: `admin` or `editor`.
 *
 * This replaces the bare `authenticated` gate these collections used to carry,
 * under which any signed-in company representative could create, edit and
 * delete site content through the REST API.
 */
export const hasContentRole: Access = ({ req }: AccessArgs<User>) => isContentEditor(req.user)

/** True when the given collection/global slug is within the editor's scope. */
export function isEditorWritableSlug(slug: string): boolean {
  return (
    (EDITOR_CONTENT_SLUGS as readonly string[]).includes(slug) ||
    (EDITOR_CONTENT_GLOBALS as readonly string[]).includes(slug)
  )
}

/** True when all three write operations on the collection are gated by `hasContentRole`. */
export function isEditorWritableCollection(config: CollectionConfig): boolean {
  const { create, update, delete: remove } = config.access ?? {}
  return create === hasContentRole && update === hasContentRole && remove === hasContentRole
}

/** True when the global's update is gated by `hasContentRole`. Globals have no create/delete. */
export function isEditorWritableGlobal(config: GlobalConfig): boolean {
  return config.access?.update === hasContentRole
}