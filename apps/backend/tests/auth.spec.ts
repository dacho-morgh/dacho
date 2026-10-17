import { describe, expect, it } from 'vitest'
import request from 'supertest'

import { createTestApp } from './helpers.js'

async function signIn(app: Parameters<typeof request>[0], phone: string, delivery: { lastCodeFor(p: string): string | undefined }) {
  await request(app).post('/auth/request-otp').send({ phone })
  const code = delivery.lastCodeFor(phone)!
  const res = await request(app).post('/auth/verify-otp').send({ phone, code })
  return res.body.token as string
}

describe('OTP auth flow', () => {
  it('request-otp delivers a code; verify-otp returns a JWT + user', async () => {
    const { app, delivery } = await createTestApp()

    const reqRes = await request(app).post('/auth/request-otp').send({ phone: '09123456789' })
    expect(reqRes.status).toBe(202)

    const code = delivery.lastCodeFor('09123456789')
    expect(code).toBeDefined()

    const verifyRes = await request(app)
      .post('/auth/verify-otp')
      .send({ phone: '09123456789', code })
    expect(verifyRes.status).toBe(200)
    expect(verifyRes.body.token).toBeTruthy()
    expect(verifyRes.body.user.id).toBeTruthy()
    expect(verifyRes.body.user.phone).toBe('09123456789')
  })

  it('rejects a wrong code with 401', async () => {
    const { app } = await createTestApp()
    await request(app).post('/auth/request-otp').send({ phone: '09123456789' })

    const res = await request(app)
      .post('/auth/verify-otp')
      .send({ phone: '09123456789', code: '000000' })
    expect(res.status).toBe(401)
  })

  it('rejects request-otp without a phone with 400', async () => {
    const { app } = await createTestApp()
    const res = await request(app).post('/auth/request-otp').send({})
    expect(res.status).toBe(400)
  })

  it('exposes the ES256 signing key via JWKS', async () => {
    const { app } = await createTestApp()
    const res = await request(app).get('/.well-known/jwks.json')
    expect(res.status).toBe(200)
    expect(res.body.keys).toHaveLength(1)
    expect(res.body.keys[0].alg).toBe('ES256')
  })

  it('issues a token that verifies back to the same user (round-trip)', async () => {
    const { app, delivery, jwt } = await createTestApp()
    await request(app).post('/auth/request-otp').send({ phone: '09123456789' })
    const code = delivery.lastCodeFor('09123456789')!

    const verifyRes = await request(app)
      .post('/auth/verify-otp')
      .send({ phone: '09123456789', code })

    const payload = await jwt.verify(verifyRes.body.token)
    expect(payload.sub).toBe(verifyRes.body.user.id)
    expect(payload.phone).toBe('09123456789')
  })

  it('complete-profile updates the user when authenticated', async () => {
    const { app, delivery } = await createTestApp()
    const token = await signIn(app, '0912', delivery)

    const res = await request(app)
      .post('/auth/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Ali' })

    expect(res.status).toBe(200)
    expect(res.body.user.name).toBe('Ali')
    expect(res.body.user.phone).toBe('0912')
  })

  it('rejects complete-profile without a token with 401', async () => {
    const { app } = await createTestApp()
    const res = await request(app).post('/auth/complete-profile').send({ name: 'Ali' })
    expect(res.status).toBe(401)
  })
})
