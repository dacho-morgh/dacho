import { exportPKCS8, generateKeyPair } from 'jose'
import { describe, expect, it } from 'vitest'

import { JwtSigner } from '../src/jwt.js'

describe('JwtSigner', () => {
  it('signs a token that verifies back to the same payload and subject', async () => {
    const signer = await JwtSigner.create('test-kid')
    const token = await signer.sign({ phone: '09123456789' }, 'user-1')
    const payload = await signer.verify(token)

    expect(payload.sub).toBe('user-1')
    expect(payload.phone).toBe('09123456789')
  })

  it('loads a persistent private key and derives its public half', async () => {
    const { privateKey } = await generateKeyPair('ES256')
    const pem = await exportPKCS8(privateKey)

    const signer = await JwtSigner.fromPrivateKeyPem('pem-kid', pem)
    const token = await signer.sign({ phone: '0912' }, 'user-1')
    const payload = await signer.verify(token)

    expect(payload.sub).toBe('user-1')

    const { keys } = await signer.jwks()
    expect(keys[0]!.kid).toBe('pem-kid')
    expect(keys[0]!.alg).toBe('ES256')
  })

  it('exposes a P-256 JWKS with the right kid, use and alg', async () => {
    const signer = await JwtSigner.create('test-kid')
    const { keys } = await signer.jwks()

    expect(keys).toHaveLength(1)
    expect(keys[0]!.kty).toBe('EC')
    expect(keys[0]!.crv).toBe('P-256')
    expect(keys[0]!.kid).toBe('test-kid')
    expect(keys[0]!.use).toBe('sig')
    expect(keys[0]!.alg).toBe('ES256')
  })

  it('rejects a token signed by a different key', async () => {
    const a = await JwtSigner.create('a')
    const b = await JwtSigner.create('b')
    const token = await a.sign({}, 'user-1')

    await expect(b.verify(token)).rejects.toThrow()
  })
})
