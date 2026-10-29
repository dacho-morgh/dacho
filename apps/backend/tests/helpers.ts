import type { Express } from 'express'
import { Pool } from 'pg'

import { InMemoryCompanyStore } from '../src/auth/company-store.js'
import { InMemoryUserStore, type UserStore } from '../src/auth/user-store.js'
import { createApp } from '../src/app.js'
import type { EventCategoryStore } from '../src/dashboard/event-category-repo.js'
import type { EventStore } from '../src/dashboard/event-repo.js'
import {
  PostgresNotificationOutbox,
  type NotificationOutbox,
} from '../src/dashboard/notification-outbox.js'
import { InMemoryServiceCatalog } from '../src/catalog/service-catalog.js'
import { InMemoryDossierDocumentSource } from '../src/dashboard/dossier.js'
import {
  InMemoryBoothCatalogueRepository,
  type BoothCatalogueRepository,
} from '../src/exhibitions/catalogue-repo.js'
import {
  InMemoryBoothReservationRepository,
  type BoothCompanyEligibility,
  type BoothReservationRepository,
} from '../src/exhibitions/reservation-repo.js'
import type { ExhibitionStore } from '../src/exhibitions/exhibition-store.js'
import type { EvaluationStore } from '../src/reviews/evaluation-repo.js'
import {
  InMemoryVerificationStore,
  type VerificationStore,
} from '../src/dashboard/verification-repo.js'
import { JwtSigner } from '../src/jwt.js'
import { InMemoryCodeStore } from '../src/otp/code-store.js'
import { ConsoleOtpDelivery } from '../src/otp/console-delivery.js'

export interface TestApp {
  app: Express
  delivery: ConsoleOtpDelivery
  codeStore: InMemoryCodeStore
  userStore: UserStore
  companyStore: InMemoryCompanyStore
  dossierDocuments: InMemoryDossierDocumentSource
  boothCatalogue: BoothCatalogueRepository
  boothReservations: BoothReservationRepository
  jwt: JwtSigner
  notificationOutbox: NotificationOutbox
  verificationStore: VerificationStore
}

export interface TestAppOptions {
  /** Swap the in-memory identity store for a remote-backed implementation. */
  userStore?: UserStore
  companyStore?: InMemoryCompanyStore
  /** Keep event authorization/validation tests independent of Postgres. */
  eventStore?: EventStore
  eventCategoryStore?: EventCategoryStore
  boothCatalogue?: BoothCatalogueRepository
  boothReservations?: BoothReservationRepository
  boothCompanyEligibility?: BoothCompanyEligibility
  eventCompanyEligibility?: BoothCompanyEligibility
  exhibitionStore?: ExhibitionStore
  evaluationStore?: EvaluationStore
  pool?: Pool
  notificationOutbox?: NotificationOutbox
  verificationStore?: VerificationStore
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const delivery = new ConsoleOtpDelivery()
  const codeStore = new InMemoryCodeStore()
  const userStore = options.userStore ?? new InMemoryUserStore()
  const companyStore = options.companyStore ?? new InMemoryCompanyStore([
    { name: 'Company 1', nationalId: '10000000001', representativeId: 'user-1' },
    { name: 'Company 2', nationalId: '10000000002', representativeId: 'user-2' },
  ])
  const dossierDocuments = new InMemoryDossierDocumentSource()
  const boothCatalogue = options.boothCatalogue ?? new InMemoryBoothCatalogueRepository()
  const boothReservations =
    options.boothReservations ?? new InMemoryBoothReservationRepository(boothCatalogue)
  const verificationStore =
    options.verificationStore ??
    new InMemoryVerificationStore()
  const jwt = await JwtSigner.create('test-kid')
  // Tests that query dashboard routes inject a pool stub; default stays unconnected.
  const pool = options.pool ?? new Pool()
  const notificationOutbox =
    options.notificationOutbox ?? new PostgresNotificationOutbox(pool)
  const app = createApp({
    codeStore,
    delivery,
    jwt,
    userStore,
    companyStore,
    dossierDocuments,
    pool,
    serviceCatalog: new InMemoryServiceCatalog(),
    proxySecret: 'test-proxy-secret',
    eventStore: options.eventStore,
    eventCategoryStore: options.eventCategoryStore,
    boothCatalogue,
    boothReservations,
    boothCompanyEligibility: options.boothCompanyEligibility,
    eventCompanyEligibility: options.eventCompanyEligibility,
    exhibitionStore: options.exhibitionStore,
    evaluationStore: options.evaluationStore,
    notificationOutbox,
    verificationStore,
  })
  return {
    app,
    delivery,
    codeStore,
    userStore,
    companyStore,
    dossierDocuments,
    boothCatalogue,
    boothReservations,
    jwt,
    notificationOutbox,
    verificationStore,
  }
}
