// The fixed reviewer forms (docs/system/review-rubric.md) and the reviewer's own
// evaluation API (T24/T25: `GET|PUT /requests/:id/evaluation`,
// `POST /requests/:id/evaluation/finalize`).
//
// The browser renders the questions and their ranges and turns what the person
// typed into the request body. It never calculates a score: section totals and
// the weighted total shown are the values the server returned for the last saved
// or finalized evaluation. Bounds, requiredness and locking are enforced by the
// server; the checks here only help the person find what is still empty.

export type EvaluationVariant = 'ordinary' | 'employer'
export type EvaluationState = 'draft' | 'final'
export type SectionKey = 'a' | 'b' | 'c'
export type YesNo = 'yes' | 'no'

/**
 * Which fixed form the assigned person answers. The server does not return a
 * rubric version yet; this names the supplied source the form renders
 * (review-rubric.md, user-supplied 2026-10-23).
 */
export const REVIEW_RUBRIC_VERSION = 'فرم ثابت داوری — منبع مصوب ۱۴۰۵/۰۸/۰۱ (۲۰۲۶-۱۰-۲۳)'

/** The supplied formula's maximum, in hundredths: 45×64 + 40×51 + 15×39. */
export const WEIGHTED_MAX_HUNDREDTHS = 5505

export interface EvaluationDto {
  id: string
  requestId: string
  role: 'reviewer' | 'employer-reviewer'
  variant: EvaluationVariant
  state: EvaluationState
  revision: number
  scores: Record<string, unknown>
  scoreA: number
  scoreB: number
  scoreC: number
  weightedHundredths: number
  answers: Record<string, unknown>
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
}

export interface OwnEvaluationResponse {
  evaluation: EvaluationDto | null
  /** The request revision this person's round reviews; every write must send it back. */
  revision: number
}

/* ── Rubric ────────────────────────────────────────────────────────────── */

export type ScoreRow =
  | { kind: 'tier'; key: string; source: string; label: string; max: number; tiers: { key: string; label: string; min: number; max: number }[] }
  | { kind: 'number'; key: string; source: string; label: string; max: number }
  | { kind: 'binary'; key: string; source: string; label: string; max: number }
  | { kind: 'innovation'; key: string; source: string; label: string; max: number }

export interface RubricSection {
  key: SectionKey
  title: string
  weightLabel: string
  rawMax: number
  rows: ScoreRow[]
}

export const RUBRIC_SECTIONS: RubricSection[] = [
  {
    key: 'a',
    title: 'نوآوری و فناوری',
    weightLabel: '۴۵٪',
    rawMax: 64,
    rows: [
      {
        kind: 'tier', key: 'technologyLevel', source: 'A1', label: 'سطح فناوری محصول', max: 9,
        tiers: [
          { key: 'low', label: 'پایین', min: 0, max: 3 },
          { key: 'mid', label: 'متوسط', min: 4, max: 6 },
          { key: 'high', label: 'بالا', min: 7, max: 9 },
        ],
      },
      { kind: 'number', key: 'interdisciplinary', source: 'A2', label: 'میزان بین رشته‌ای بودن محصول', max: 9 },
      {
        kind: 'innovation', key: 'innovation', source: 'A3',
        label: 'نوآوری محصول (مجموع موارد پایین): مقاله، پتنت داخلی، در سطح بین‌المللی', max: 20,
      },
      {
        kind: 'number', key: 'customization', source: 'A4',
        label: 'ظرفیت سفارشی‌سازی محصول (تولید بر اساس مشخصات مورد نظر مشتری)', max: 9,
      },
      {
        kind: 'tier', key: 'developmentMethod', source: 'A5', label: 'روش توسعه فناوری محصول', max: 9,
        tiers: [
          { key: 'reverse_engineering', label: 'مهندسی معکوس', min: 0, max: 3 },
          { key: 'improvement', label: 'بهبود', min: 4, max: 6 },
          {
            key: 'internationally_new',
            label: 'ایده نو در سطح بین‌المللی یا دانش فنی حاصل از تحقیق و توسعه دانشگاه و صنعت',
            min: 7,
            max: 9,
          },
        ],
      },
      {
        kind: 'tier', key: 'environment', source: 'A6',
        label: 'سازگاری محصول با محیط زیست (مستقیم یا غیرمستقیم در فرآیند مصرف یا بهره‌برداری)', max: 8,
        tiers: [
          { key: 'weak', label: 'ضعیف', min: 0, max: 2 },
          { key: 'medium', label: 'متوسط', min: 3, max: 5 },
          { key: 'appropriate', label: 'مناسب', min: 6, max: 8 },
        ],
      },
    ],
  },
  {
    key: 'b',
    title: 'تجاری‌سازی و بازار',
    weightLabel: '۴۰٪',
    rawMax: 51,
    rows: [
      {
        kind: 'tier', key: 'developmentStage', source: 'B1',
        label: 'محصول از نظر سطح توسعه فناوری در چه مرحله‌ای است؟', max: 9,
        tiers: [
          { key: 'laboratory', label: 'آزمایشگاهی', min: 0, max: 3 },
          { key: 'pilot', label: 'پایلوت', min: 4, max: 6 },
          { key: 'industrial', label: 'صنعتی', min: 7, max: 9 },
        ],
      },
      { kind: 'number', key: 'addedValue', source: 'B2', label: 'ارزش افزوده محصول', max: 9 },
      {
        kind: 'tier', key: 'marketReach', source: 'B3', label: 'بازار و تقاضای موجود', max: 15,
        tiers: [
          { key: 'oil_gas_petrochemicals', label: 'نفت، گاز و پتروشیمی', min: 0, max: 5 },
          { key: 'national_other_industries', label: 'بازار ملی سایر صنایع', min: 6, max: 10 },
          { key: 'international', label: 'بین‌المللی', min: 11, max: 15 },
        ],
      },
      { kind: 'number', key: 'futureOilGasDemand', source: 'B4', label: 'بازار و تقاضای آتی صنعت نفت، گاز و پتروشیمی', max: 9 },
      { kind: 'number', key: 'importSubstitution', source: 'B5', label: 'ظرفیت جایگزینی محصول با کالاهای مشابه وارداتی', max: 9 },
    ],
  },
  {
    key: 'c',
    title: 'مستندسازی و ارائه مستندات محصول',
    weightLabel: '۱۵٪',
    rawMax: 39,
    rows: [
      {
        kind: 'tier', key: 'technicalReportQuality', source: '۱', label: 'کیفیت گزارش فنی فناوری تولید محصول', max: 9,
        tiers: [
          { key: 'weak', label: 'ضعیف', min: 0, max: 3 },
          { key: 'medium', label: 'متوسط', min: 4, max: 6 },
          { key: 'appropriate', label: 'مناسب همراه با مستندات', min: 7, max: 9 },
        ],
      },
      {
        kind: 'binary', key: 'scientificAuthorityEndorsement', source: '۳*',
        label: 'تأییدیه علمی از مراجع ذی‌صلاح (دانشگاه، پارک علم و فناوری‌ها، پژوهشگاه‌ها)', max: 5,
      },
      { kind: 'binary', key: 'nationalStandard', source: '۴*', label: 'تأییدیه استاندارد ملی', max: 10 },
      { kind: 'binary', key: 'isoProductQuality', source: '۵*', label: 'گواهینامه کیفیت محصول (ایزو)', max: 10 },
      {
        kind: 'number', key: 'salesContracts', source: '۷',
        label: 'قراردادهای فروش محصول (بر اساس تعدد قرارداد و میزان فروش محصول در هر قرارداد)', max: 5,
      },
    ],
  },
]

export const ORDINARY_QUESTIONS: { key: string; label: string }[] = [
  { key: 'technicalApproachClear', label: 'آیا رویکرد فنی به وضوح تعریف شده است؟' },
  { key: 'objectivesAchievableOnTime', label: 'آیا اهداف پروپوزال در چارچوب زمان پیشنهادی قابل دستیابی هستند؟' },
  { key: 'scientificPrinciplesSound', label: 'آیا پروپوزال درک مناسبی از اصول فنی و علمی مربوطه را نشان می‌دهد؟' },
  { key: 'operationsDetailedRealistic', label: 'آیا برنامه‌های عملیاتی دقیق و واقع‌گرایانه هستند؟' },
  { key: 'resourcesListed', label: 'آیا فهرستی از منابع مورد نیاز (پرسنل، امکانات و غیره) ارائه شده است؟' },
  { key: 'scheduleExecutable', label: 'آیا زمان‌بندی‌های اجرایی منطقی و عملی بودنِ آنها مشخص است؟' },
  { key: 'budgetBreakdown', label: 'آیا تفکیک بودجه به وضوح شامل شده است؟' },
  { key: 'costsJustified', label: 'آیا هزینه‌های پیش‌بینی‌شده با نتایج مورد انتظار توجیه شده‌اند؟' },
  { key: 'costBenefitAnalysis', label: 'آیا پروپوزال شامل یک تحلیل هزینه-فایده است؟' },
  { key: 'environmentalImpactsIdentified', label: 'آیا پروپوزال تأثیرات زیست‌محیطی بالقوه را شناسایی کرده است؟' },
  { key: 'environmentalMitigation', label: 'آیا تدابیری برای کاهش تأثیرات منفی زیست‌محیطی پیشنهاد شده است؟' },
  { key: 'riskAssessmentDone', label: 'آیا ارزیابی ریسک انجام شده است؟' },
  { key: 'risksMitigated', label: 'آیا ریسک‌های شناسایی‌شده به‌عنوان استراتژی‌های کاهش مناسب پوشش داده شده‌اند؟' },
]

export interface RiskItem { key: string; kind: 'yesno' | 'text'; label: string }
export interface RiskGroup { key: string; title: string; items: RiskItem[] }

export const EMPLOYER_RISK_GROUPS: RiskGroup[] = [
  { key: 'assessment', title: 'ارزیابی ریسک', items: [{ key: 'done', kind: 'yesno', label: 'آیا ارزیابی ریسک انجام شده است؟' }] },
  {
    key: 'financial', title: 'ریسک مالی', items: [
      { key: 'budgetSufficiency', kind: 'yesno', label: 'آیا بودجه کافی برای این پروژه وجود دارد؟' },
      { key: 'costDrivers', kind: 'text', label: 'چه عواملی می‌توانند بر هزینه‌های پروژه تأثیر بگذارند؟' },
      { key: 'minMaxCosts', kind: 'text', label: 'حداقل و حداکثر هزینه‌هایی که ممکن است اتفاق بیافتد را بیان کنید.' },
    ],
  },
  {
    key: 'technical', title: 'ریسک فنی', items: [
      { key: 'newTechnology', kind: 'yesno', label: 'آیا تکنولوژی مورد استفاده در پروژه جدید است؟' },
      { key: 'teamSkills', kind: 'yesno', label: 'آیا تیم فنی مهارت‌های لازم برای اجرا را دارد؟' },
      { key: 'materialsEquipmentTimely', kind: 'yesno', label: 'آیا تجهیزات و مواد لازم به موقع تهیه خواهند شد؟' },
      { key: 'productionIssues', kind: 'text', label: 'چه مشکلاتی ممکن است در فرایند تولید یا اجرا بروز کند؟' },
    ],
  },
  {
    key: 'schedule', title: 'ریسک زمان‌بندی', items: [
      { key: 'schedule', kind: 'text', label: 'زمان‌بندی پروژه چگونه است؟' },
      { key: 'supplyDelays', kind: 'yesno', label: 'آیا ممکن است تأخیر در تأمین مواد اولیه یا تجهیزات به‌وجود آید؟' },
      { key: 'otherTimingFactors', kind: 'text', label: 'چه عواملی می‌توانند بر زمان‌بندی پروژه تأثیر بگذارند؟' },
    ],
  },
  {
    key: 'legal', title: 'ریسک حقوقی', items: [
      { key: 'permits', kind: 'yesno', label: 'آیا مجوزهای لازم برای پروژه دریافت شده است؟' },
      { key: 'localNationalCompliance', kind: 'yesno', label: 'آیا این پروژه به قوانین و مقررات محلی یا ملی پایبند است؟' },
      { key: 'futureIssues', kind: 'yesno', label: 'آیا ممکن است در آینده مشکلات حقوقی به‌وجود بیاید؟' },
    ],
  },
  {
    key: 'human', title: 'ریسک نیروی انسانی', items: [
      { key: 'teamSizeSkills', kind: 'yesno', label: 'آیا اعضای تیم از نظر تعداد و مهارت کافی هستند؟' },
      { key: 'tensionsConflicts', kind: 'yesno', label: 'آیا تنش‌ها و تضادهای بین اعضای تیم وجود دارد؟' },
      { key: 'training', kind: 'yesno', label: 'آیا برنامه‌ای برای آموزش و توسعه کارکنان وجود دارد؟' },
    ],
  },
  {
    key: 'environment', title: 'ریسک زیست‌محیطی', items: [
      { key: 'negativeImpacts', kind: 'yesno', label: 'آیا پروژه تأثیرات منفی بر محیط زیست خواهد گذاشت؟' },
      { key: 'mitigation', kind: 'yesno', label: 'آیا برنامه‌ای برای کاهش تأثیرات زیست‌محیطی وجود دارد؟' },
    ],
  },
  {
    key: 'stakeholders', title: 'ریسک ذی‌نفعان', items: [
      { key: 'keyStakeholders', kind: 'text', label: 'ذی‌نفعان کلیدی پروژه چه کسانی هستند؟' },
      { key: 'support', kind: 'yesno', label: 'آیا حمایت کافی از طرف ذی‌نفعان وجود دارد؟' },
      { key: 'conflicts', kind: 'yesno', label: 'آیا ممکن است تضاد منافع با ذی‌نفعان باشد؟' },
    ],
  },
  {
    key: 'external', title: 'ریسک عوامل بیرونی', items: [
      { key: 'economicPoliticalSocial', kind: 'yesno', label: 'آیا تغییرات اقتصادی، سیاسی یا اجتماعی ممکن است بر پروژه تأثیر بگذارد؟' },
      { key: 'unpredictable', kind: 'text', label: 'چه امور غیرقابل پیش‌بینی وجود دارد که ممکن است بر پروژه تأثیرگذار باشد؟' },
    ],
  },
]

export const RECOMMENDATIONS: { key: string; label: string }[] = [
  { key: 'strongly_recommend', label: 'به شدت توصیه می‌کنم' },
  { key: 'recommend', label: 'توصیه می‌کنم' },
  { key: 'neutral', label: 'بی‌طرف' },
  { key: 'not_recommend', label: 'توصیه نمی‌کنم' },
  { key: 'strongly_not_recommend', label: 'به شدت توصیه نمی‌کنم' },
]

export const TOP_FIVE_QUESTION =
  'به نظر شما طرح بررسی‌شده شایستگی پذیرفته‌شدن در ۵ طرح برگزیده نهایی این رویداد را دارد؟ دلیل یا دلایل خود را مختصراً بیان فرمایید.'

/* ── Form state ────────────────────────────────────────────────────────── */

/** What the person typed, kept as text so a half-typed value is never lost. */
export interface ScoreInput {
  tier?: string
  score?: string
  /** Innovation (A3) components. */
  articles?: boolean
  domesticPatentCount?: string
  international?: boolean
}

export interface EvaluationFormValues {
  scores: Record<SectionKey, Record<string, ScoreInput>>
  /** Optional per-row reviewer comment, keyed `a.technologyLevel`; never scored. */
  comments: Record<string, string>
  questions: Record<string, YesNo | undefined>
  risk: Record<string, Record<string, string | undefined>>
  recommendation?: string
  topFiveAnswer?: YesNo
  topFiveRationale: string
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
const text = (value: unknown): string | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value : undefined
const yesNo = (value: unknown): YesNo | undefined => (value === 'yes' || value === 'no' ? value : undefined)

export function emptyFormValues(): EvaluationFormValues {
  return { scores: { a: {}, b: {}, c: {} }, comments: {}, questions: {}, risk: {}, topFiveRationale: '' }
}

/** Reopens what the server persisted for this person. */
export function formValuesFromEvaluation(evaluation: EvaluationDto | null): EvaluationFormValues {
  const values = emptyFormValues()
  if (!evaluation) return values
  const scores = record(evaluation.scores)
  for (const section of RUBRIC_SECTIONS) {
    const saved = record(scores[section.key])
    for (const row of section.rows) {
      if (!Object.hasOwn(saved, row.key)) continue
      const value = saved[row.key]
      if (row.kind === 'tier') {
        const tier = record(value)
        values.scores[section.key][row.key] = { tier: typeof tier.tier === 'string' ? tier.tier : undefined, score: text(tier.score) }
      } else if (row.kind === 'innovation') {
        const parts = record(value)
        values.scores[section.key][row.key] = {
          articles: parts.articles === true,
          domesticPatentCount: text(parts.domesticPatentCount),
          international: parts.international === true,
        }
      } else {
        values.scores[section.key][row.key] = { score: text(value) }
      }
    }
  }
  const answers = record(evaluation.answers)
  for (const [key, value] of Object.entries(record(answers.comments))) {
    if (typeof value === 'string') values.comments[key] = value
  }
  for (const question of ORDINARY_QUESTIONS) values.questions[question.key] = yesNo(answers[question.key])
  const risk = record(answers.risk)
  for (const group of EMPLOYER_RISK_GROUPS) {
    const saved = record(risk[group.key])
    values.risk[group.key] = {}
    for (const item of group.items) {
      values.risk[group.key][item.key] = item.kind === 'yesno' ? yesNo(saved[item.key]) : text(saved[item.key])
    }
  }
  values.recommendation = typeof answers.recommendation === 'string' ? answers.recommendation : undefined
  const topFive = record(answers.topFive)
  values.topFiveAnswer = yesNo(topFive.answer)
  values.topFiveRationale = typeof topFive.rationale === 'string' ? topFive.rationale : ''
  return values
}

/** Persian or Latin digits typed into a score field, as a number; anything else stays as typed for the server to refuse. */
function numberFrom(value: string): number | string {
  const latin = value.trim().replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  return /^-?\d+$/.test(latin) ? Number(latin) : latin
}

/**
 * The PUT/finalize body. Only rows the person has started are sent: the server
 * accepts a partial draft, and requires everything on finalization itself.
 */
export function evaluationPayload(values: EvaluationFormValues, variant: EvaluationVariant, revision: number) {
  const scores: Record<string, Record<string, unknown>> = {}
  for (const section of RUBRIC_SECTIONS) {
    const rows: Record<string, unknown> = {}
    for (const row of section.rows) {
      const input = values.scores[section.key][row.key]
      if (!input) continue
      if (row.kind === 'tier') {
        if (!input.tier && !input.score?.trim()) continue
        rows[row.key] = { tier: input.tier ?? '', score: numberFrom(input.score ?? '') }
      } else if (row.kind === 'innovation') {
        if (!input.domesticPatentCount?.trim() && !input.articles && !input.international) continue
        rows[row.key] = {
          articles: input.articles === true,
          domesticPatentCount: numberFrom(input.domesticPatentCount?.trim() || '0'),
          international: input.international === true,
        }
      } else if (input.score?.trim()) {
        rows[row.key] = numberFrom(input.score)
      }
    }
    if (Object.keys(rows).length) scores[section.key] = rows
  }

  const answers: Record<string, unknown> = {}
  if (variant === 'ordinary') {
    for (const question of ORDINARY_QUESTIONS) {
      const value = values.questions[question.key]
      if (value) answers[question.key] = value
    }
  } else {
    const risk: Record<string, Record<string, string>> = {}
    for (const group of EMPLOYER_RISK_GROUPS) {
      for (const item of group.items) {
        const value = values.risk[group.key]?.[item.key]
        if (value === undefined || (item.kind === 'text' && !value.trim())) continue
        risk[group.key] = { ...risk[group.key], [item.key]: value }
      }
    }
    if (Object.keys(risk).length) answers.risk = risk
  }
  if (values.recommendation) answers.recommendation = values.recommendation
  const topFive: Record<string, string> = {}
  if (values.topFiveAnswer) topFive.answer = values.topFiveAnswer
  if (values.topFiveRationale.trim()) topFive.rationale = values.topFiveRationale
  if (Object.keys(topFive).length) answers.topFive = topFive
  const comments = Object.fromEntries(Object.entries(values.comments).filter(([, value]) => value.trim()))
  if (Object.keys(comments).length) answers.comments = comments

  return { revision, scores, answers }
}

/** Field paths (server error keys) for every required entry still empty. */
export function missingForFinal(values: EvaluationFormValues, variant: EvaluationVariant): string[] {
  const missing: string[] = []
  for (const section of RUBRIC_SECTIONS) {
    for (const row of section.rows) {
      const input = values.scores[section.key][row.key]
      const path = `scores.${section.key}.${row.key}`
      if (row.kind === 'tier' ? !input?.tier || !input.score?.trim()
        : row.kind === 'innovation' ? !input?.domesticPatentCount?.trim()
          : !input?.score?.trim()) missing.push(path)
    }
  }
  if (variant === 'ordinary') {
    for (const question of ORDINARY_QUESTIONS) if (!values.questions[question.key]) missing.push(`answers.${question.key}`)
  } else {
    for (const group of EMPLOYER_RISK_GROUPS) {
      for (const item of group.items) {
        const value = values.risk[group.key]?.[item.key]
        if (!value || !value.trim()) missing.push(`answers.risk.${group.key}.${item.key}`)
      }
    }
  }
  if (!values.recommendation) missing.push('answers.recommendation')
  if (!values.topFiveAnswer) missing.push('answers.topFive.answer')
  if (!values.topFiveRationale.trim()) missing.push('answers.topFive.rationale')
  return missing
}

/** How many rows of a section have an entry, for the step summary. Not a score. */
export function answeredRows(values: EvaluationFormValues, section: RubricSection): number {
  const missing = new Set(missingForFinal(values, 'ordinary'))
  return section.rows.filter((row) => !missing.has(`scores.${section.key}.${row.key}`)).length
}

/** Which form step a server error path belongs to. */
export function stepOfPath(path: string): number {
  if (path.startsWith('scores.a')) return 0
  if (path.startsWith('scores.b')) return 1
  if (path.startsWith('scores.c')) return 2
  return path.startsWith('answers') ? 3 : 4
}

/** Server validation messages are stable English sentences; the person reads Persian. */
export function serverErrorText(message: string): string {
  if (message === 'Required score is missing.') return 'امتیاز این ردیف الزامی است.'
  const range = /^Expected integer from 0 to (\d+)\.$/.exec(message)
  if (range) return `یک عدد صحیح از ۰ تا ${Number(range[1]).toLocaleString('fa-IR')} وارد کنید.`
  const binary = /^Expected 0 or (\d+)\.$/.exec(message)
  if (binary) return `فقط ۰ یا ${Number(binary[1]).toLocaleString('fa-IR')} پذیرفته می‌شود.`
  if (message === 'Score does not match selected tier.') return 'امتیاز با سطح انتخاب‌شده هم‌خوانی ندارد.'
  if (message === 'Expected allowed tier and integer score.') return 'یک سطح و امتیاز صحیح در بازه آن انتخاب کنید.'
  if (message.startsWith('Expected articles flag')) return 'تعداد پتنت داخلی باید عدد صحیح نامنفی باشد.'
  if (message === 'Answer yes or no.') return 'بله یا خیر را انتخاب کنید.'
  if (message === 'Provide a meaningful response.') return 'پاسخی معنادار بنویسید.'
  if (message === 'Select a recommendation.') return 'یکی از گزینه‌های توصیه را انتخاب کنید.'
  if (message === 'Provide a brief reason.') return 'دلیل خود را مختصراً بنویسید.'
  if (message === 'Unknown score row.') return 'این ردیف در فرم مصوب وجود ندارد.'
  if (message.startsWith('Client totals')) return 'جمع امتیازها با محاسبه سرور یکسان نیست.'
  return 'سرور این مقدار را نپذیرفت.'
}

export const MISSING_TEXT = 'این مورد برای ثبت نهایی الزامی است.'

/** Exact hundredths as a Persian two-decimal number, e.g. 3456 → «۳۴٫۵۶». */
export function formatHundredths(hundredths: number): string {
  return (hundredths / 100).toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/* ── API ───────────────────────────────────────────────────────────────── */

export type EvaluationWriteResult =
  | { kind: 'ok'; evaluation: EvaluationDto }
  | { kind: 'invalid'; errors: Record<string, string> }
  /** The request revision or round moved on: answers must not attach to a new round. */
  | { kind: 'stale' }
  | { kind: 'locked' }
  | { kind: 'denied' }
  | { kind: 'not-assigned' }
  | { kind: 'expired' }
  | { kind: 'error' }

async function writeEvaluation(url: string, method: 'PUT' | 'POST', body: unknown): Promise<EvaluationWriteResult> {
  let response: Response
  try {
    response = await fetch(url, {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { kind: 'error' }
  }
  const data = (await response.json().catch(() => null)) as { error?: unknown; errors?: unknown; evaluation?: unknown } | null
  if (response.ok) {
    return data && record(data.evaluation).id ? { kind: 'ok', evaluation: data.evaluation as EvaluationDto } : { kind: 'error' }
  }
  if (response.status === 401) return { kind: 'expired' }
  if (response.status === 403) return { kind: 'denied' }
  if (response.status === 404) return { kind: 'not-assigned' }
  if (response.status === 409) return data?.error === 'evaluation_locked' ? { kind: 'locked' } : { kind: 'stale' }
  if (response.status === 400) {
    if (data?.error === 'invalid_revision') return { kind: 'stale' }
    if (data?.error === 'validation_failed') {
      const errors: Record<string, string> = {}
      for (const [key, value] of Object.entries(record(data.errors))) if (typeof value === 'string') errors[key] = value
      return { kind: 'invalid', errors }
    }
  }
  return { kind: 'error' }
}

const evaluationUrl = (requestId: string) => `/api/dashboard/requests/${encodeURIComponent(requestId)}/evaluation`

export function saveEvaluationDraft(requestId: string, body: ReturnType<typeof evaluationPayload>) {
  return writeEvaluation(evaluationUrl(requestId), 'PUT', body)
}

export function finalizeEvaluation(requestId: string, body: ReturnType<typeof evaluationPayload>) {
  return writeEvaluation(`${evaluationUrl(requestId)}/finalize`, 'POST', body)
}
