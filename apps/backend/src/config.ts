import { readFileSync } from 'node:fs'
import path from 'node:path'

export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`)
    this.name = 'MissingEnvError'
  }
}

export type OtpDeliveryKind = 'console' | 'kavenegar'

export interface KavenegarConfig {
  apiKey: string
  template: string
}

export interface Config {
  port: number
  databaseUrl: string
  jwtPrivateKey: string
  jwtKid: string
  payloadUrl: string
  payloadApiKey: string
  internalProxySecret: string
  otpDelivery: OtpDeliveryKind
  kavenegar?: KavenegarConfig
  /**
   * Private document bytes. This must be a persistent, non-public directory
   * separate from `PAYLOAD_MEDIA_DIR`; no static route serves it.
   */
  privateDocumentsDir: string
}

function require(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  if (value === undefined || value === '') {
    throw new MissingEnvError(name)
  }
  return value
}

/** JWT key comes from a mounted file when JWT_PRIVATE_KEY_FILE is set, else from JWT_PRIVATE_KEY. */
function resolveJwtPrivateKey(env: NodeJS.ProcessEnv): string {
  if (env.JWT_PRIVATE_KEY_FILE) {
    return readFileSync(env.JWT_PRIVATE_KEY_FILE, 'utf8')
  }
  return require(env, 'JWT_PRIVATE_KEY')
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = require(env, 'DATABASE_URL')
  const jwtPrivateKey = resolveJwtPrivateKey(env)
  const payloadUrl = require(env, 'PAYLOAD_URL')
  const payloadApiKey = require(env, 'PAYLOAD_API_KEY')
  const internalProxySecret = require(env, 'INTERNAL_PROXY_SECRET')

  const otpDelivery = env.OTP_DELIVERY ?? 'console'
  if (otpDelivery !== 'console' && otpDelivery !== 'kavenegar') {
    throw new Error(`Invalid OTP_DELIVERY: ${otpDelivery}`)
  }

  const config: Config = {
    port: Number(env.PORT ?? 4000),
    databaseUrl,
    jwtPrivateKey,
    jwtKid: env.JWT_KID ?? 'dacho-backend',
    payloadUrl,
    payloadApiKey,
    internalProxySecret,
    otpDelivery,
    privateDocumentsDir:
      env.PRIVATE_DOCUMENTS_DIR && env.PRIVATE_DOCUMENTS_DIR !== ''
        ? path.resolve(env.PRIVATE_DOCUMENTS_DIR)
        : path.resolve(process.cwd(), '.private-documents'),
  }

  if (otpDelivery === 'kavenegar') {
    const apiKey = env.KAVENEGAR_API_KEY
    const template = env.KAVENEGAR_TEMPLATE
    if (apiKey === undefined || apiKey === '' || template === undefined || template === '') {
      throw new MissingEnvError('KAVENEGAR_API_KEY and KAVENEGAR_TEMPLATE (required when OTP_DELIVERY=kavenegar)')
    }
    config.kavenegar = { apiKey, template }
  }

  return config
}
