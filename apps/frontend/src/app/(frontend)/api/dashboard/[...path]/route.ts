import { getPayload } from 'payload'
import { NextRequest } from 'next/server'

import configPromise from '@payload-config'

import { buildBackendRequest, type ProxyUser } from '@/utilities/dashboard-proxy'
import { getPayloadAuthHeaders } from '@/utilities/payload-auth-headers'

type Context = { params: Promise<{ path: string[] }> }

async function handle(req: NextRequest, path: string[]): Promise<Response> {
  const payload = await getPayload({ config: configPromise })

  let user: ProxyUser | null = null
  try {
    const result = await payload.auth({ headers: getPayloadAuthHeaders(req) })
    user = (result.user ?? null) as unknown as ProxyUser | null
  } catch {
    user = null
  }

  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const { url, init } = await buildBackendRequest(user, req, path, {
    backendUrl: process.env.BACKEND_URL ?? 'http://localhost:4000',
    proxySecret: process.env.INTERNAL_PROXY_SECRET ?? '',
  })

  const res = await fetch(url, init)
  const body = await res.arrayBuffer()
  return new Response(body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  })
}

export async function GET(req: NextRequest, ctx: Context): Promise<Response> {
  const { path } = await ctx.params
  return handle(req, path)
}

export async function POST(req: NextRequest, ctx: Context): Promise<Response> {
  const { path } = await ctx.params
  return handle(req, path)
}

export async function PATCH(req: NextRequest, ctx: Context): Promise<Response> {
  const { path } = await ctx.params
  return handle(req, path)
}

export async function PUT(req: NextRequest, ctx: Context): Promise<Response> {
  const { path } = await ctx.params
  return handle(req, path)
}

export async function DELETE(req: NextRequest, ctx: Context): Promise<Response> {
  const { path } = await ctx.params
  return handle(req, path)
}
