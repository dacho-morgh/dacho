import type { Endpoint } from 'payload'

/** Public presentation is independent of private dossier access and queries. */
export const companyDirectory: Endpoint = {
  path: '/directory',
  method: 'get',
  handler: async (req) => {
    const rawPage = new URL(req.url!).searchParams.get('page') ?? '1'
    const page = Number(rawPage)
    if (!Number.isSafeInteger(page) || page < 1) {
      return Response.json({ errors: [{ message: 'Invalid page.' }] }, { status: 400 })
    }

    // This service read intentionally bypasses private collection access. Only
    // these public fields are selected and projected; arbitrary where/select/
    // populate/sort parameters never enter the query or its pagination counts.
    const result = await req.payload.find({
      collection: 'companies',
      overrideAccess: true,
      depth: 0,
      limit: 20,
      page,
      sort: 'name',
      select: { name: true, type: true, province: true, city: true },
    })
    return Response.json({
      docs: result.docs.map(({ id, name, type, province, city }) => ({
        id, name, type: type ?? null, province: province ?? null, city: city ?? null,
      })),
      page: result.page,
      totalPages: result.totalPages,
      totalDocs: result.totalDocs,
      hasNextPage: result.hasNextPage,
    })
  },
}
