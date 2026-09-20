import { getPayload } from 'payload'
import config from '@/payload.config'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request): Promise<Response> {
  let input: unknown
  try {
    input = await request.json()
  } catch {
    return Response.json({ error: 'درخواست نامعتبر است.' }, { status: 400 })
  }
  const email =
    typeof input === 'object' && input && 'email' in input && typeof input.email === 'string'
      ? input.email.trim().toLowerCase()
      : ''
  if (email.length > 254 || !emailPattern.test(email)) {
    return Response.json({ error: 'آدرس ایمیل معتبر وارد کنید.' }, { status: 400 })
  }
  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'newsletter-subscribers',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
  })
  if (!existing.totalDocs) {
    try {
      await payload.create({ collection: 'newsletter-subscribers', data: { email, source: 'mag' } })
    } catch (error) {
      // Concurrent duplicate submissions are successful subscriptions too.
      const duplicate = await payload.find({
        collection: 'newsletter-subscribers',
        where: { email: { equals: email } },
        limit: 1,
        depth: 0,
      })
      if (!duplicate.totalDocs) throw error
    }
  }
  return Response.json({ ok: true })
}
