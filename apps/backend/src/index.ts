import { PayloadUserStore } from './auth/payload-user-store.js'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { createPool } from './db.js'
import { JwtSigner } from './jwt.js'
import { ConsoleOtpDelivery } from './otp/console-delivery.js'
import { KavenegarOtpDelivery } from './otp/kavenegar-delivery.js'
import { ensureOtpCodesTable, PostgresCodeStore } from './otp/postgres-code-store.js'

const config = loadConfig()

const pool = createPool(config.databaseUrl)
await ensureOtpCodesTable(pool)

const delivery = config.kavenegar
  ? new KavenegarOtpDelivery({ apiKey: config.kavenegar.apiKey, template: config.kavenegar.template })
  : new ConsoleOtpDelivery()

const jwt = await JwtSigner.fromPrivateKeyPem(config.jwtKid, config.jwtPrivateKey)

const app = createApp({
  codeStore: new PostgresCodeStore(pool),
  delivery,
  jwt,
  userStore: new PayloadUserStore({ baseUrl: config.payloadUrl, apiKey: config.payloadApiKey }),
})

app.listen(config.port, () => {
  console.log(`[backend] listening on :${config.port}`)
})
