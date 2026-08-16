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
  otpDelivery: OtpDeliveryKind
  kavenegar?: KavenegarConfig
}

function require(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  if (value === undefined || value === '') {
    throw new MissingEnvError(name)
  }
  return value
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = require(env, 'DATABASE_URL')
  const jwtPrivateKey = require(env, 'JWT_PRIVATE_KEY')
  const payloadUrl = require(env, 'PAYLOAD_URL')
  const payloadApiKey = require(env, 'PAYLOAD_API_KEY')

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
    otpDelivery,
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
