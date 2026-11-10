/*
 * Design-review data for the request page (#288): one event application at each
 * stage, driven through the real dashboard API as the people who would act, so
 * every row, history step, assignment and file is what the product itself writes.
 *
 * - «بررسی اولیه»: submitted, waiting for the chief's triage.
 * - «داوری»: triaged with a started round of four slots; the employer is final,
 *   one reviewer has a draft, one has opened the case and one has not.
 * - «سرمایه‌گذاری»: four final evaluations, advanced by the chief, the company's
 *   package submitted, so the event's investment person holds the case.
 *
 * Idempotent: every step first reads the current state and only does what is
 * missing, so re-running continues an interrupted run and otherwise changes
 * nothing. Local development only; see `seed-review-stages-cli.ts`.
 */

export interface SeedResponse {
  status: number
  // Response bodies are the API's JSON; the seed reads only what it checks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
}

export interface SeedFile {
  filename: string
  content: Buffer
  contentType: string
}

/** Calls the dashboard API as one person, as the same-origin proxy would. */
export interface SeedClient {
  json(actorId: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH', path: string, body?: unknown): Promise<SeedResponse>
  upload(actorId: string, path: string, fields: Record<string, string>, field: string, file: SeedFile): Promise<SeedResponse>
}

export interface SeedPeople {
  owner: string
  secretariat: string
  chief: string
  investment: string
  employer: string
  /** Three distinct ordinary reviewers; the first is the one dev login sees «مشاهده نشده» for. */
  reviewers: readonly [string, string, string]
  representative: string
}

export interface SeedOptions {
  serviceId: string
  /** Called once the event exists, e.g. to attach a poster to its public page. */
  afterEvent?: (event: { id: string; publicEventId: string | null }) => Promise<void>
  log?: (line: string) => void
}

export interface SeedResult {
  eventId: string
  requests: Record<StageKey, string>
}

type StageKey = 'triage' | 'review' | 'investment'

export const SEED_EVENT_TITLE = 'رویداد نمونه بازبینی طراحی'
const CATEGORY_TITLE = 'فناوری‌های نفت و گاز'
const STAGES: readonly { key: StageKey; subtopic: string; title: string }[] = [
  { key: 'triage', subtopic: 'پایش هوشمند خطوط لوله', title: 'نمونه بازبینی — سامانه پایش خطوط لوله' },
  { key: 'review', subtopic: 'بازیافت گازهای مشعل', title: 'نمونه بازبینی — بازیافت گاز مشعل' },
  { key: 'investment', subtopic: 'کاهش مصرف انرژی پالایشگاه', title: 'نمونه بازبینی — بهینه‌سازی انرژی پالایشگاه' },
]

const pdf = (name: string): SeedFile => ({
  filename: `${name}.pdf`,
  content: Buffer.from(`%PDF-1.4\n% dacho design-review seed: ${name}\n%%EOF\n`),
  contentType: 'application/pdf',
})

const CONSENT_VERSIONS = {
  nonCompete: 'non-compete-unapproved-placeholder',
  eventRules: 'event-rules-unapproved-placeholder',
}

const SCORES = {
  a: {
    technologyLevel: { tier: 'mid', score: 5 },
    interdisciplinary: 6,
    innovation: { articles: true, domesticPatentCount: 2, international: true },
    customization: 7,
    developmentMethod: { tier: 'improvement', score: 5 },
    environment: { tier: 'appropriate', score: 7 },
  },
  b: {
    developmentStage: { tier: 'industrial', score: 8 },
    addedValue: 6,
    marketReach: { tier: 'international', score: 12 },
    futureOilGasDemand: 7,
    importSubstitution: 8,
  },
  c: {
    technicalReportQuality: { tier: 'appropriate', score: 8 },
    scientificAuthorityEndorsement: 5,
    nationalStandard: 10,
    isoProductQuality: 10,
    salesContracts: 4,
  },
}

const ORDINARY_ANSWERS = {
  technicalApproachClear: 'yes',
  objectivesAchievableOnTime: 'yes',
  scientificPrinciplesSound: 'yes',
  operationsDetailedRealistic: 'yes',
  resourcesListed: 'yes',
  scheduleExecutable: 'yes',
  budgetBreakdown: 'yes',
  costsJustified: 'yes',
  costBenefitAnalysis: 'no',
  environmentalImpactsIdentified: 'yes',
  environmentalMitigation: 'yes',
  riskAssessmentDone: 'yes',
  risksMitigated: 'no',
  recommendation: 'recommend',
  topFive: { answer: 'yes', rationale: 'پیشنهاد فنی روشن و قابل اجرا است.' },
}

const EMPLOYER_ANSWERS = {
  risk: {
    assessment: { done: 'yes' },
    financial: { budgetSufficiency: 'yes', costDrivers: 'قیمت تجهیزات وارداتی', minMaxCosts: 'بین ۱۰ تا ۳۰ میلیارد ریال' },
    technical: { newTechnology: 'yes', teamSkills: 'yes', materialsEquipmentTimely: 'yes', productionIssues: 'تأمین قطعات' },
    schedule: { schedule: 'سه فاز سه‌ماهه', supplyDelays: 'no', otherTimingFactors: 'شرایط آب‌وهوایی' },
    legal: { permits: 'yes', localNationalCompliance: 'yes', futureIssues: 'no' },
    human: { teamSizeSkills: 'yes', tensionsConflicts: 'no', training: 'yes' },
    environment: { negativeImpacts: 'no', mitigation: 'yes' },
    stakeholders: { keyStakeholders: 'شرکت ملی نفت', support: 'yes', conflicts: 'no' },
    external: { economicPoliticalSocial: 'no', unpredictable: 'نوسان نرخ ارز' },
  },
  recommendation: 'strongly_recommend',
  topFive: { answer: 'yes', rationale: 'با نیاز صنعت هم‌خوان است.' },
}

const FINANCIAL_UPLOADS = [
  'debtFacilityEvidence',
  'taxInsuranceRecords',
  'contractsOrdersMousCommitments',
  'projectEstimateUseOfFunds',
  'guaranteeCollateral',
] as const

export class SeedError extends Error {}

function expectStatus(res: SeedResponse, allowed: number[], step: string): SeedResponse {
  if (!allowed.includes(res.status)) {
    throw new SeedError(`${step}: HTTP ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res
}

export async function seedReviewStages(client: SeedClient, people: SeedPeople, options: SeedOptions): Promise<SeedResult> {
  const log = options.log ?? (() => undefined)
  const { owner, secretariat, chief, investment, employer, reviewers, representative } = people

  /* ── Event, category, three subtopics with an RFP each ─────────────── */
  const events = expectStatus(await client.json(owner, 'GET', '/admin/events'), [200], 'list events').body.items as {
    id: string
    title: string
    publicEventId: string | null
  }[]
  let event = events.find((item) => item.title === SEED_EVENT_TITLE)
  if (!event) {
    const now = Date.now()
    const created = await client.json(owner, 'POST', '/admin/events', {
      title: SEED_EVENT_TITLE,
      description: 'رویداد نمونه برای بازبینی طراحی صفحه جزئیات درخواست. داده‌ها آزمایشی است.',
      registrationOpenAt: new Date(now - 30 * 86_400_000).toISOString(),
      registrationCloseAt: new Date(now + 365 * 86_400_000).toISOString(),
      responsibleChiefId: chief,
      responsibleInvestmentId: investment,
      location: 'بوشهر، مرکز همایش‌های کارخانه نوآوری',
      startDate: new Date(now + 60 * 86_400_000).toISOString(),
      endDate: new Date(now + 62 * 86_400_000).toISOString(),
      status: 'upcoming',
    })
    event = expectStatus(created, [201], 'create event').body.event
    log(`• event created: ${SEED_EVENT_TITLE}`)
  } else {
    log(`• event exists: ${SEED_EVENT_TITLE}`)
  }
  const eventId = event!.id
  await options.afterEvent?.({ id: eventId, publicEventId: event!.publicEventId ?? null })

  const categories = expectStatus(await client.json(owner, 'GET', `/admin/events/${eventId}/categories`), [200], 'list categories').body.items as { id: string; title: string }[]
  let categoryId = categories.find((item) => item.title === CATEGORY_TITLE)?.id
  if (!categoryId) {
    categoryId = expectStatus(
      await client.json(owner, 'POST', `/admin/events/${eventId}/categories`, { title: CATEGORY_TITLE }),
      [201], 'create category',
    ).body.category.id as string
  }

  const subtopicOf = new Map<StageKey, { id: string; rfpVersionId: string }>()
  for (const stage of STAGES) {
    const listed = expectStatus(await client.json(owner, 'GET', `/admin/events/${eventId}/subtopics`), [200], 'list subtopics').body.items as {
      id: string
      title: string
      currentRfpVersionId?: string | null
    }[]
    let subtopic = listed.find((item) => item.title === stage.subtopic)
    if (!subtopic) {
      subtopic = expectStatus(
        await client.json(owner, 'POST', `/admin/events/${eventId}/subtopics`, { title: stage.subtopic, categoryId, employerId: employer }),
        [201], `create subtopic ${stage.subtopic}`,
      ).body.subtopic
    }
    let rfpVersionId = subtopic!.currentRfpVersionId ?? null
    if (!rfpVersionId) {
      rfpVersionId = expectStatus(
        await client.upload(owner, `/admin/events/${eventId}/subtopics/${subtopic!.id}/rfp`, { expectedVersionId: '', reason: 'نسخه اولیه نمونه' }, 'files', pdf(`rfp-${stage.key}`)),
        [201], `publish RFP ${stage.subtopic}`,
      ).body.version.id as string
    }
    subtopicOf.set(stage.key, { id: subtopic!.id, rfpVersionId })
  }

  /* ── The representative's company is verified ─────────────────────── */
  const verification = expectStatus(await client.json(representative, 'GET', '/profile/verification'), [200], 'read verification').body
  if (verification.status !== 'approved') {
    const profile = expectStatus(await client.json(representative, 'GET', '/profile'), [200], 'read profile').body
    const companyId = profile.companyId as string | null
    if (!companyId) throw new SeedError('The representative has no company. Run the frontend seed `seed:dev-review` first.')
    if (verification.status !== 'pending') {
      const dossier = expectStatus(await client.json(representative, 'GET', '/profile/dossier'), [200], 'read dossier').body
      const present = new Set((dossier.documents as { category: string }[]).map((doc) => doc.category))
      for (const category of ['articlesOfAssociation', 'establishmentNotices']) {
        if (present.has(category)) continue
        expectStatus(
          await client.upload(representative, '/documents', { category, companyId }, 'file', pdf(category)),
          [201], `upload ${category}`,
        )
      }
      const submitted = await client.json(representative, 'POST', '/profile/verification/submit')
      if (submitted.status === 400) {
        throw new SeedError(`The company profile is incomplete (${JSON.stringify(submitted.body.missing)}). Run the frontend seed \`seed:dev-review\` first.`)
      }
      expectStatus(submitted, [201, 409], 'submit verification')
    }
    expectStatus(
      await client.json(secretariat, 'POST', `/admin/companies/${representative}/verification/decision`, { action: 'approve' }),
      [200], 'approve verification',
    )
    log('• company verification approved')
  }

  /* ── One application per stage ────────────────────────────────────── */
  const mine = expectStatus(await client.json(representative, 'GET', '/requests?limit=100'), [200], 'list requests').body.items as {
    id: string
    title: string
  }[]
  const requests = {} as Record<StageKey, string>

  for (const stage of STAGES) {
    const target = subtopicOf.get(stage.key)!
    let id = mine.find((item) => item.title === stage.title)?.id
    if (!id) {
      id = expectStatus(
        await client.json(representative, 'POST', '/requests', {
          serviceId: options.serviceId,
          title: stage.title,
          answers: {
            summary: 'خلاصه طرح نمونه برای بازبینی طراحی.',
            applicationTeam: [
              { name: 'سارا حسینی', role: 'مدیر پروژه' },
              { name: 'رضا کمالی', role: 'کارشناس فنی' },
            ],
          },
          eventId,
          subtopicId: target.id,
          rfpVersionId: target.rfpVersionId,
        }),
        [201], `create request ${stage.title}`,
      ).body.request.id as string
      log(`• request created: ${stage.title}`)
    }
    requests[stage.key] = id
    await advance(client, people, id, stage.key, log)
  }

  return { eventId, requests }

  async function read(actor: string, id: string) {
    return expectStatus(await client.json(actor, 'GET', `/requests/${id}`), [200], 'read request').body.request as {
      status: string
      reviewStage: string | null
      revision: number
    }
  }

  async function advance(client: SeedClient, people: SeedPeople, id: string, stage: StageKey, log: (line: string) => void) {
    let current = await read(representative, id)
    if (current.status === 'draft') {
      const documents = expectStatus(await client.json(representative, 'GET', `/documents?requestId=${id}`), [200], 'list proposal').body.items as { category: string }[]
      if (!documents.some((doc) => doc.category === 'proposal')) {
        expectStatus(await client.upload(representative, '/documents', { category: 'proposal', requestId: id }, 'file', pdf(`proposal-${stage}`)), [201], 'upload proposal')
      }
      expectStatus(
        await client.json(representative, 'POST', `/requests/${id}/submit`, {
          nonCompeteAcceptance: { accepted: true, textVersionId: CONSENT_VERSIONS.nonCompete },
          eventRulesAcceptance: { accepted: true, textVersionId: CONSENT_VERSIONS.eventRules },
        }),
        [200], 'submit request',
      )
      current = await read(representative, id)
    }
    if (stage === 'triage') return

    if (current.status === 'in_review' && current.reviewStage === 'chief_triage') {
      expectStatus(await client.json(chief, 'POST', `/requests/${id}/triage`, { action: 'accept', expectedRevision: current.revision }), [200], 'triage accept')
      current = await read(chief, id)
    }

    if (current.status === 'in_review' && current.reviewStage === 'triaged') {
      const round = expectStatus(await client.json(chief, 'GET', `/requests/${id}/review-round`), [200], 'read round').body.round
      if (!round || round.requestRevision !== current.revision) {
        expectStatus(
          await client.json(chief, 'POST', `/requests/${id}/review-round`, { reviewerIds: [...reviewers], expectedRevision: current.revision }),
          [201], 'start round',
        )
        log(`• review round started on ${id}`)
      }
      const revision = current.revision
      const evaluation = (person: string) => ({
        revision,
        scores: SCORES,
        answers: person === employer ? EMPLOYER_ANSWERS : ORDINARY_ANSWERS,
      })
      const stateOf = async (person: string) => {
        const res = await client.json(person, 'GET', `/requests/${id}/evaluation`)
        return res.status === 200 ? (res.body.evaluation?.state as string | undefined) ?? null : null
      }
      const finalize = async (person: string) => {
        if ((await stateOf(person)) === 'final') return
        expectStatus(await client.json(person, 'POST', `/requests/${id}/evaluation/finalize`, evaluation(person)), [200], `finalize ${person}`)
      }

      if (stage === 'review') {
        // Employer final, reviewers[2] draft, reviewers[1] opened the case, reviewers[0] has not.
        await finalize(employer)
        if ((await stateOf(reviewers[2])) === null) {
          expectStatus(await client.json(reviewers[2], 'PUT', `/requests/${id}/evaluation`, evaluation(reviewers[2])), [200], 'save draft')
        }
        expectStatus(await client.json(reviewers[1], 'GET', `/review/cases/${id}`), [200], 'open case')
        return
      }

      for (const person of [employer, ...reviewers]) await finalize(person)
      expectStatus(
        await client.json(chief, 'POST', `/requests/${id}/review-decision`, { action: 'advance', expectedRevision: revision }),
        [200], 'advance after review',
      )
      log(`• review advanced on ${id}`)
      current = await read(chief, id)
    }

    if (stage !== 'investment' || current.reviewStage !== 'advanced') return
    const invitation = expectStatus(await client.json(representative, 'GET', `/requests/${id}/financial-invitation`), [200], 'read invitation').body
    const existing = await client.json(representative, 'GET', `/requests/${id}/financial-package`)
    if (existing.status === 200) return
    const files = expectStatus(await client.json(representative, 'GET', `/documents?requestId=${id}`), [200], 'list package files').body.items as {
      category: string
      statementYear?: number | null
    }[]
    for (const category of FINANCIAL_UPLOADS) {
      if (files.some((file) => file.category === category)) continue
      expectStatus(await client.upload(representative, '/documents', { category, requestId: id }, 'file', pdf(category)), [201], `upload ${category}`)
    }
    for (const year of (invitation.statementYears ?? []) as number[]) {
      if (files.some((file) => file.category === 'financialStatements' && file.statementYear === year)) continue
      expectStatus(
        await client.upload(representative, '/documents', { category: 'financialStatements', requestId: id, statementYear: String(year) }, 'file', pdf(`statements-${year}`)),
        [201], `upload statements ${year}`,
      )
    }
    expectStatus(await client.json(representative, 'POST', `/requests/${id}/financial-package`), [200, 201], 'submit package')
    log(`• package submitted, case handed to the investment person: ${id}`)
  }
}

/** A client for a dashboard API listening at `baseUrl`, signing calls as the proxy does. */
export function httpSeedClient(baseUrl: string, proxySecret: string): SeedClient {
  const root = baseUrl.replace(/\/+$/, '')
  const headers = (actorId: string): Record<string, string> => ({ 'x-internal-proxy-secret': proxySecret, 'x-user-id': actorId })
  const parse = async (res: Response): Promise<SeedResponse> => {
    const text = await res.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      // Keep the raw text for the error message.
    }
    return { status: res.status, body }
  }
  return {
    async json(actorId, method, path, body) {
      const res = await fetch(`${root}${path}`, {
        method,
        headers: { ...headers(actorId), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return parse(res)
    },
    async upload(actorId, path, fields, field, file) {
      const form = new FormData()
      for (const [name, value] of Object.entries(fields)) form.append(name, value)
      form.append(field, new Blob([new Uint8Array(file.content)], { type: file.contentType }), file.filename)
      const res = await fetch(`${root}${path}`, { method: 'POST', headers: headers(actorId), body: form })
      return parse(res)
    },
  }
}
