import type { Endpoint } from 'payload'

// Naive type map — expand as needed
const typeMap: Record<string, { type: string; format?: string }> = {
  text: { type: 'string' },
  textarea: { type: 'string' },
  email: { type: 'string', format: 'email' },
  number: { type: 'number' },
  date: { type: 'string', format: 'date-time' },
  checkbox: { type: 'boolean' },
  richText: { type: 'object' },
  upload: { type: 'string', format: 'uri' },
  relationship: { type: 'string' },
  select: { type: 'string' },
  array: { type: 'array' },
  json: { type: 'object' },
  code: { type: 'string' },
  point: { type: 'array', format: undefined },
  radio: { type: 'string' },
  blocks: { type: 'object' },
  group: { type: 'object' },
  tabs: { type: 'object' },
  ui: { type: 'object' },
  join: { type: 'object' },
}

const fieldToProperty = (field: any): any => {
  const mapped = typeMap[field.type] || { type: 'string' }
  const prop: any = { ...mapped }
  if (field.required) {
    // handled at the schema level
  }
  return prop
}

const collectionToSchema = (collection: any) => {
  const properties: Record<string, any> = {
    id: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  }

  const required: string[] = []

  const walkFields = (fields: any[]) => {
    for (const field of fields) {
      if (field.type === 'tabs') {
        for (const tab of field.tabs) {
          walkFields(tab.fields)
        }
      } else if (field.type === 'group') {
        properties[field.name] = {
          type: 'object',
          properties: {},
        }
      } else if (field.type === 'array') {
        properties[field.name] = {
          type: 'array',
          items: {
            type: 'object',
            properties: {},
          },
        }
        for (const subField of field.fields || []) {
          properties[field.name].items.properties[subField.name] = fieldToProperty(subField)
        }
      } else {
        properties[field.name] = fieldToProperty(field)
        if (field.required) required.push(field.name)
      }
    }
  }

  walkFields(collection.fields || [])

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  }
}

export const openApiEndpoint: Endpoint = {
  path: '/openapi.json',
  method: 'get',
  handler: (req) => {
    const { config } = req.payload

    const schemas: Record<string, any> = {}
    const paths: Record<string, any> = {}

    for (const collection of config.collections) {
      const slug = collection.slug
      if (slug === 'payload-preferences' || slug === 'payload-migrations') continue

      schemas[slug] = collectionToSchema(collection)

      paths[`/api/${slug}`] = {
        get: {
          summary: `List ${slug}`,
          tags: [slug],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'sort', in: 'query', schema: { type: 'string' } },
            { name: 'where', in: 'query', schema: { type: 'object' } },
            { name: 'depth', in: 'query', schema: { type: 'integer' } },
          ],
          responses: {
            '200': {
              description: `List of ${slug}`,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      docs: { type: 'array', items: { $ref: `#/components/schemas/${slug}` } },
                      totalDocs: { type: 'integer' },
                      limit: { type: 'integer' },
                      totalPages: { type: 'integer' },
                      page: { type: 'integer' },
                      pagingCounter: { type: 'integer' },
                      hasPrevPage: { type: 'boolean' },
                      hasNextPage: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: `Create ${slug}`,
          tags: [slug],
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${slug}` },
              },
            },
          },
          responses: {
            '201': { description: 'Created' },
          },
        },
      }

      paths[`/api/${slug}/{id}`] = {
        get: {
          summary: `Get ${slug} by ID`,
          tags: [slug],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            '200': {
              description: `${slug} document`,
              content: { 'application/json': { schema: { $ref: `#/components/schemas/${slug}` } } },
            },
          },
        },
        patch: {
          summary: `Update ${slug}`,
          tags: [slug],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${slug}` },
              },
            },
          },
          responses: {
            '200': { description: 'Updated' },
          },
        },
        delete: {
          summary: `Delete ${slug}`,
          tags: [slug],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            '200': { description: 'Deleted' },
          },
        },
      }
    }

    const spec = {
      openapi: '3.0.3',
      info: {
        title: 'Dacho CMS API',
        version: '1.0.0',
        description: 'Auto-generated OpenAPI spec from Payload CMS collections',
      },
      servers: [{ url: config.serverURL || 'http://localhost:3000' }],
      paths,
      components: { schemas },
    }

    return Response.json(spec)
  },
}
