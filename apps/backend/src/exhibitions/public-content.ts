import {
  PUBLIC_STATUSES,
  type PublicCollection,
  type PublicContent,
  type PublicRecordStore,
  type PublicStatus,
} from './exhibition-store.js'

export type PublicContentValidation =
  | { ok: true; value: PublicContent }
  | { ok: false; error: 'invalid_public_content'; fields: string[] }
  | { ok: false; error: 'invalid_public_dates' }

const MAX_TITLE = 200
const MAX_LOCATION = 300
const MAX_DESCRIPTION = 5000

/**
 * The public page fields an event or exhibition form sends (S5). `existing` fills
 * omitted fields on an edit; dates are compared, so the end must follow the start.
 */
export function parsePublicContent(body: unknown, existing?: PublicContent): PublicContentValidation {
  const source = body !== null && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {}
  const valueOf = (key: keyof PublicContent): unknown => (key in source ? source[key] : existing?.[key])
  const text = (key: keyof PublicContent) => {
    const value = valueOf(key)
    return typeof value === 'string' ? value.trim() : null
  }

  const title = text('title')
  const description = text('description') ?? (valueOf('description') === undefined ? '' : null)
  const location = text('location')
  const startText = text('startDate')
  const endText = text('endDate')
  const status = valueOf('status')

  const fields: string[] = []
  if (!title || title.length > MAX_TITLE) fields.push('title')
  if (description === null || description.length > MAX_DESCRIPTION) fields.push('description')
  if (!location || location.length > MAX_LOCATION) fields.push('location')
  if (!startText || !Number.isFinite(Date.parse(startText))) fields.push('startDate')
  if (!endText || !Number.isFinite(Date.parse(endText))) fields.push('endDate')
  if (!PUBLIC_STATUSES.includes(status as PublicStatus)) fields.push('status')
  if (fields.length > 0) return { ok: false, error: 'invalid_public_content', fields }

  const start = Date.parse(startText!)
  const end = Date.parse(endText!)
  if (end <= start) return { ok: false, error: 'invalid_public_dates' }

  return {
    ok: true,
    value: {
      title: title!,
      description: description ?? '',
      location: location!,
      startDate: new Date(start).toISOString(),
      endDate: new Date(end).toISOString(),
      status: status as PublicStatus,
    },
  }
}

/** A CMS write or read failed; nothing operational was committed because of it. */
export class PublicRecordFailure extends Error {
  constructor(readonly reason: 'failed' | 'missing', options?: { cause?: unknown }) {
    super(`public record ${reason}`, options)
  }
}

/** Runs one CMS call, tagging its failure so routes can tell it from a database failure. */
export async function publicCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    throw new PublicRecordFailure('failed', { cause: error })
  }
}

/** Only the editable fields, so a restore never sends the record's id or timestamps back. */
export function contentOf(record: PublicContent): PublicContent {
  const { title, description, location, startDate, endDate, status } = record
  return { title, description, location, startDate, endDate, status }
}

export type PublicWrite =
  | { kind: 'created'; id: string }
  | { kind: 'updated'; id: string; previous: PublicContent }

/**
 * Undoes a CMS write whose operational half failed, so neither record is left
 * half made. A failed undo is logged with the record id for manual cleanup; the
 * caller still reports the original failure.
 */
export async function undoPublicWrite(
  store: PublicRecordStore,
  collection: PublicCollection,
  write: PublicWrite,
): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (write.kind === 'created') await store.remove(collection, write.id)
      else await store.update(collection, write.id, contentOf(write.previous))
      return
    } catch (error) {
      if (attempt === 3) {
        console.error(
          `[public-records] could not undo ${write.kind} ${collection}/${write.id}; remove or restore it by hand`,
          error,
        )
      }
    }
  }
}

/** CMS record ids are numeric today; anything else in a path is not a record. */
export function isPublicRecordId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value)
}

/** The 400 body for a rejected form: the error code and, when known, the fields. */
export function contentErrorBody(
  invalid: Exclude<PublicContentValidation, { ok: true }>,
): { error: string; fields?: string[] } {
  return invalid.error === 'invalid_public_content'
    ? { error: invalid.error, fields: invalid.fields }
    : { error: invalid.error }
}
