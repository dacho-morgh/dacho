import { SignJWT, exportJWK, generateKeyPair, importJWK, importPKCS8, jwtVerify } from 'jose'
import type { JWK, KeyLike } from 'jose'

/** Signs and verifies ES256 JWTs and publishes the public half as JWKS. */
export class JwtSigner {
  private constructor(
    private readonly privateKey: KeyLike,
    private readonly publicKey: KeyLike,
    private readonly kid: string,
  ) {}

  /** Generates an ephemeral keypair (dev only — tokens do not survive restart). */
  static async create(kid: string): Promise<JwtSigner> {
    const { privateKey, publicKey } = await generateKeyPair('ES256')
    return new JwtSigner(privateKey, publicKey, kid)
  }

  /** Loads a persistent private key (PKCS8 PEM) and derives its public half. */
  static async fromPrivateKeyPem(kid: string, pem: string): Promise<JwtSigner> {
    const privateKey = (await importPKCS8(pem, 'ES256')) as KeyLike
    const jwk = (await exportJWK(privateKey)) as JWK & { d?: string }
    const { d: _private, ...publicJwk } = jwk
    const publicKey = (await importJWK(publicJwk, 'ES256')) as KeyLike
    return new JwtSigner(privateKey, publicKey, kid)
  }

  async sign(payload: Record<string, unknown>, subject: string): Promise<string> {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'ES256', kid: this.kid })
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(this.privateKey)
  }

  async verify(token: string): Promise<Record<string, unknown>> {
    const { payload } = await jwtVerify(token, this.publicKey, { algorithms: ['ES256'] })
    return payload as Record<string, unknown>
  }

  async jwks(): Promise<{ keys: JWK[] }> {
    const jwk = await exportJWK(this.publicKey)
    return { keys: [{ ...jwk, kid: this.kid, use: 'sig', alg: 'ES256' }] }
  }
}
