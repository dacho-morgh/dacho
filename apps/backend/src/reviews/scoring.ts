type Variant = 'ordinary' | 'employer'
type RecordValue = Record<string, unknown>
type ValidationResult = {
  valid: boolean
  scores: { a: number; b: number; c: number; weightedHundredths: number }
  errors: Record<string, string>
}

const ordinaryQuestions = [
  'technicalApproachClear', 'objectivesAchievableOnTime', 'scientificPrinciplesSound',
  'operationsDetailedRealistic', 'resourcesListed', 'scheduleExecutable', 'budgetBreakdown',
  'costsJustified', 'costBenefitAnalysis', 'environmentalImpactsIdentified',
  'environmentalMitigation', 'riskAssessmentDone', 'risksMitigated',
]
const employerRisks: Record<string, Record<string, 'yesno' | 'text'>> = {
  assessment: { done: 'yesno' },
  financial: { budgetSufficiency: 'yesno', costDrivers: 'text', minMaxCosts: 'text' },
  technical: { newTechnology: 'yesno', teamSkills: 'yesno', materialsEquipmentTimely: 'yesno', productionIssues: 'text' },
  schedule: { schedule: 'text', supplyDelays: 'yesno', otherTimingFactors: 'text' },
  legal: { permits: 'yesno', localNationalCompliance: 'yesno', futureIssues: 'yesno' },
  human: { teamSizeSkills: 'yesno', tensionsConflicts: 'yesno', training: 'yesno' },
  environment: { negativeImpacts: 'yesno', mitigation: 'yesno' },
  stakeholders: { keyStakeholders: 'text', support: 'yesno', conflicts: 'yesno' },
  external: { economicPoliticalSocial: 'yesno', unpredictable: 'text' },
}
const ownRecord = (value: unknown): value is RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const isIntegerBetween = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max
const has = (record: RecordValue, key: string) => Object.hasOwn(record, key)

export function validateAndScoreReview(input: unknown): ValidationResult {
  const errors: Record<string, string> = {}
  let a = 0
  let b = 0
  let c = 0
  const fail = (key: string, message: string) => { errors[key] = message }
  if (!ownRecord(input)) {
    fail('input', 'Expected review object.')
    return { valid: false, scores: { a, b, c, weightedHundredths: 0 }, errors }
  }
  const variant = input.variant
  const state = input.state
  if (variant !== 'ordinary' && variant !== 'employer') fail('variant', 'Expected ordinary or employer.')
  if (state !== 'draft' && state !== 'final') fail('state', 'Expected draft or final.')
  const final = state === 'final'
  const scores = ownRecord(input.scores) ? input.scores : {}
  if (!ownRecord(input.scores)) fail('scores', 'Expected score object.')

  const sections = [
    { key: 'a', rows: {
      technologyLevel: { kind: 'tier', max: 9, ranges: { low: [0, 3], mid: [4, 6], high: [7, 9] } },
      interdisciplinary: { kind: 'number', max: 9 }, innovation: { kind: 'innovation' },
      customization: { kind: 'number', max: 9 },
      developmentMethod: { kind: 'tier', max: 9, ranges: { reverse_engineering: [0, 3], improvement: [4, 6], internationally_new: [7, 9] } },
      environment: { kind: 'tier', max: 8, ranges: { weak: [0, 2], medium: [3, 5], appropriate: [6, 8] } },
    } },
    { key: 'b', rows: {
      developmentStage: { kind: 'tier', max: 9, ranges: { laboratory: [0, 3], pilot: [4, 6], industrial: [7, 9] } },
      addedValue: { kind: 'number', max: 9 },
      marketReach: { kind: 'tier', max: 15, ranges: { oil_gas_petrochemicals: [0, 5], national_other_industries: [6, 10], international: [11, 15] } },
      futureOilGasDemand: { kind: 'number', max: 9 }, importSubstitution: { kind: 'number', max: 9 },
    } },
    { key: 'c', rows: {
      technicalReportQuality: { kind: 'tier', max: 9, ranges: { weak: [0, 3], medium: [4, 6], appropriate: [7, 9] } },
      scientificAuthorityEndorsement: { kind: 'binary', max: 5 },
      nationalStandard: { kind: 'binary', max: 10 }, isoProductQuality: { kind: 'binary', max: 10 },
      salesContracts: { kind: 'number', max: 5 },
    } },
  ] as const
  for (const section of sections) {
    const sectionValues: RecordValue = ownRecord(scores[section.key]) ? scores[section.key] as RecordValue : {}
    if (has(scores, section.key) && !ownRecord(scores[section.key])) fail(`scores.${section.key}`, 'Expected section object.')
    for (const key of Object.keys(sectionValues)) {
      if (!has(section.rows, key)) fail(`scores.${section.key}.${key}`, 'Unknown score row.')
    }
    let total = 0
    for (const [key, rule] of Object.entries(section.rows)) {
      if (!has(sectionValues, key)) {
        if (final) fail(`scores.${section.key}.${key}`, 'Required score is missing.')
        continue
      }
      const value = sectionValues[key]
      const path = `scores.${section.key}.${key}`
      if (rule.kind === 'number') {
        if (!isIntegerBetween(value, 0, rule.max)) fail(path, `Expected integer from 0 to ${rule.max}.`)
        else total += value
      } else if (rule.kind === 'binary') {
        if (value !== 0 && value !== rule.max) fail(path, `Expected 0 or ${rule.max}.`)
        else total += value as number
      } else if (rule.kind === 'tier') {
        if (!ownRecord(value) || typeof value.tier !== 'string' || !has(rule.ranges, value.tier) || !isIntegerBetween(value.score, 0, rule.max)) {
          fail(path, 'Expected allowed tier and integer score.')
        } else {
          const range = rule.ranges[value.tier as keyof typeof rule.ranges]
          const score = value.score as number
          if (score < range[0] || score > range[1]) fail(`${path}.score`, 'Score does not match selected tier.')
          else total += score
        }
      } else {
        if (!ownRecord(value) || typeof value.articles !== 'boolean' || !Number.isSafeInteger(value.domesticPatentCount) || (value.domesticPatentCount as number) < 0 || typeof value.international !== 'boolean') {
          fail(path, 'Expected articles flag, nonnegative domestic patent count, and international flag.')
        } else {
          total += (value.articles ? 2 : 0) + Math.min(value.domesticPatentCount as number, 3) * 3 + (value.international ? 9 : 0)
        }
      }
    }
    if (section.key === 'a') a = total
    if (section.key === 'b') b = total
    if (section.key === 'c') c = total
  }
  const weightedHundredths = 45 * a + 40 * b + 15 * c
  if (has(input, 'calculatedScores')) {
    const supplied = input.calculatedScores
    if (!ownRecord(supplied) || supplied.a !== a || supplied.b !== b || supplied.c !== c || supplied.weightedHundredths !== weightedHundredths) {
      fail('calculatedScores.weightedHundredths', 'Client totals do not match server calculation.')
    }
  }

  if (has(input, 'answers') && !ownRecord(input.answers)) fail('answers', 'Expected answers object.')
  if (final && !has(input, 'answers')) fail('answers', 'Required answers object is missing.')
  if (variant === 'ordinary' || variant === 'employer') {
    const answers = ownRecord(input.answers) ? input.answers : {}
    if (variant === 'ordinary') {
      for (const key of ordinaryQuestions) {
        if (!has(answers, key)) {
          if (final) fail(`answers.${key}`, 'Answer yes or no.')
        } else if (answers[key] !== 'yes' && answers[key] !== 'no' && !(state === 'draft' && answers[key] === 'unanswered')) {
          fail(`answers.${key}`, 'Answer yes or no.')
        }
      }
    } else {
      const risk = ownRecord(answers.risk) ? answers.risk : {}
      if (has(answers, 'risk') && !ownRecord(answers.risk)) fail('answers.risk', 'Expected risk object.')
      for (const [group, items] of Object.entries(employerRisks)) {
        const groupValues = ownRecord(risk[group]) ? risk[group] : {}
        if (has(risk, group) && !ownRecord(risk[group])) fail(`answers.risk.${group}`, 'Expected risk group object.')
        for (const [item, kind] of Object.entries(items)) {
          const value = groupValues[item]
          const path = `answers.risk.${group}.${item}`
          if (!has(groupValues, item)) {
            if (final) fail(path, kind === 'yesno' ? 'Answer yes or no.' : 'Provide a meaningful response.')
          } else if (kind === 'yesno'
            ? value !== 'yes' && value !== 'no' && !(state === 'draft' && value === 'unanswered')
            : typeof value !== 'string' || !value.trim() || (final && (/^(unanswered|tbd)$/i.test(value.trim()) || /^[\p{P}\s]+$/u.test(value.trim())))) {
            fail(path, kind === 'yesno' ? 'Answer yes or no.' : 'Provide a meaningful response.')
          }
        }
      }
    }
    const recommendations = ['strongly_recommend', 'recommend', 'neutral', 'not_recommend', 'strongly_not_recommend']
    if (!has(answers, 'recommendation')) {
      if (final) fail('answers.recommendation', 'Select a recommendation.')
    } else if (typeof answers.recommendation !== 'string' || !recommendations.includes(answers.recommendation)) {
      fail('answers.recommendation', 'Select a recommendation.')
    }
    const topFive = ownRecord(answers.topFive) ? answers.topFive : {}
    if (has(answers, 'topFive') && !ownRecord(answers.topFive)) fail('answers.topFive', 'Expected top-five object.')
    if (!has(topFive, 'answer')) {
      if (final) fail('answers.topFive.answer', 'Answer yes or no.')
    } else if (topFive.answer !== 'yes' && topFive.answer !== 'no' && !(state === 'draft' && topFive.answer === 'unanswered')) {
      fail('answers.topFive.answer', 'Answer yes or no.')
    }
    if (!has(topFive, 'rationale')) {
      if (final) fail('answers.topFive.rationale', 'Provide a brief reason.')
    } else if (typeof topFive.rationale !== 'string' || (final && !topFive.rationale.trim())) {
      fail('answers.topFive.rationale', 'Provide a brief reason.')
    }
  }
  return { valid: Object.keys(errors).length === 0, scores: { a, b, c, weightedHundredths }, errors }
}
