import type { Express } from 'express'

import { InMemoryUserStore } from '../src/auth/user-store.js'
import { createApp } from '../src/app.js'
import { JwtSigner } from '../src/jwt.js'
import { InMemoryCodeStore } from '../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../src/otp/console-delivery.js'

export interface TestApp {
  app: Express
  delivery: ConsoleOtpDelivery
  codeStore: InMemoryCodeStore
  userStore: InMemoryUserStore
  jwt: JwtSigner
}

export async function createTestApp(): Promise<TestApp> {
  const delivery = new ConsoleOtpDelivery()
  const codeStore = new InMemoryCodeStore()
  const userStore = new InMemoryUserStore()
  const jwt = await JwtSigner.create('test-kid')
  const app = createApp({ codeStore, delivery, jwt, userStore })
  return { app, delivery, codeStore, userStore, jwt }
}
