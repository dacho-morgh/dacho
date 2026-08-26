import configPromise from '@payload-config'
import { getPayload } from 'payload'

/**
 * Resolves the Payload `forms` doc id for a given title (the forms are seeded
 * by `scripts/seed-forms.ts`). Returns `null` when the form hasn't been seeded
 * yet, so pages can render the form disabled instead of crashing.
 */
export const getFormIdByTitle = async (title: string): Promise<number | null> => {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'forms',
    limit: 1,
    pagination: false,
    where: { title: { equals: title } },
  })
  return docs[0]?.id ?? null
}
