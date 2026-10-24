import type { Express } from 'express'
import { Pool } from 'pg'

import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore, type UserStore } from '../src/auth/user-store.js'
import { createApp } from '../src/app.js'
import { InMemoryServiceCatalog } from '../src/catalog/service-catalog.js'
import { JwtSigner } from '../src/jwt.js'
import { InMemoryCodeStore } from '../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../src/otp/console-delivery.js'

export interface TestApp {
  app: Express
  delivery: ConsoleOtpDelivery
  codeStore: InMemoryCodeStore
  userStore: UserStore
  companyStore: InMemoryCompanyStore
  jwt: JwtSigner
}

export interface TestAppOptions {
  /** Swap the in-memory identity store for a remote-backed implementation. */
  userStore?: UserStore
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const delivery = new ConsoleOtpDelivery()
  const codeStore = new InMemoryCodeStore()
  const userStore = options.userStore ?? new InMemoryUserStore()
  const companyStore = new InMemoryCompanyStore()
  const jwt = await JwtSigner.create('test-kid')
  // Unit tests never touch the dashboard routes, so the pool is never queried;
  // a lazy, unconnected pool satisfies the type without requiring a live DB.
  const pool = new Pool()
  const app = createApp({
    codeStore,
    delivery,
    jwt,
    userStore,
    companyStore,
    pool,
    serviceCatalog: new InMemoryServiceCatalog(),
    proxySecret: 'test-proxy-secret',
  })
  return { app, delivery, codeStore, userStore, companyStore, jwt }
}
