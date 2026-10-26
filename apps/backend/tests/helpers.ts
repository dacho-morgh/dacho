import type { Express } from 'express'
import { Pool } from 'pg'

import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore, type UserStore } from '../src/auth/user-store.js'
import { createApp } from '../src/app.js'
import { InMemoryServiceCatalog } from '../src/catalog/service-catalog.js'
import {
  InMemoryBoothCatalogueRepository,
  type BoothCatalogueRepository,
} from '../src/exhibitions/catalogue-repo.js'
import type { ExhibitionStore } from '../src/exhibitions/exhibition-store.js'
import { JwtSigner } from '../src/jwt.js'
import { InMemoryCodeStore } from '../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../src/otp/console-delivery.js'

export interface TestApp {
  app: Express
  delivery: ConsoleOtpDelivery
  codeStore: InMemoryCodeStore
  userStore: UserStore
  companyStore: InMemoryCompanyStore
  boothCatalogue: BoothCatalogueRepository
  jwt: JwtSigner
}

export interface TestAppOptions {
  /** Swap the in-memory identity store for a remote-backed implementation. */
  userStore?: UserStore
  boothCatalogue?: BoothCatalogueRepository
  exhibitionStore?: ExhibitionStore
  pool?: Pool
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const delivery = new ConsoleOtpDelivery()
  const codeStore = new InMemoryCodeStore()
  const userStore = options.userStore ?? new InMemoryUserStore()
  const companyStore = new InMemoryCompanyStore()
  const boothCatalogue = options.boothCatalogue ?? new InMemoryBoothCatalogueRepository()
  const jwt = await JwtSigner.create('test-kid')
  // Tests that query dashboard routes inject a pool stub; default stays unconnected.
  const pool = options.pool ?? new Pool()
  const app = createApp({
    codeStore,
    delivery,
    jwt,
    userStore,
    companyStore,
    pool,
    serviceCatalog: new InMemoryServiceCatalog(),
    proxySecret: 'test-proxy-secret',
    boothCatalogue,
    exhibitionStore: options.exhibitionStore,
  })
  return { app, delivery, codeStore, userStore, companyStore, boothCatalogue, jwt }
}
