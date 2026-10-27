import { describe, expect, it } from 'vitest'

import { validateAndScoreReview } from '../src/reviews/scoring.js'

const quantitative = {
  a: {
    technologyLevel: { tier: 'high', score: 9 },
    interdisciplinary: 9,
    innovation: { articles: true, domesticPatentCount: 3, international: true },
    customization: 9,
    developmentMethod: { tier: 'internationally_new', score: 9 },
    environment: { tier: 'appropriate', score: 8 },
  },
  b: {
    developmentStage: { tier: 'industrial', score: 9 },
    addedValue: 9,
    marketReach: { tier: 'international', score: 15 },
    futureOilGasDemand: 9,
    importSubstitution: 9,
  },
  c: {
    technicalReportQuality: { tier: 'appropriate', score: 9 },
    scientificAuthorityEndorsement: 5,
    nationalStandard: 10,
    isoProductQuality: 10,
    salesContracts: 5,
  },
}

const ordinaryAnswers = {
  technicalApproachClear: 'no',
  objectivesAchievableOnTime: 'yes',
  scientificPrinciplesSound: 'yes',
  operationsDetailedRealistic: 'yes',
  resourcesListed: 'yes',
  scheduleExecutable: 'yes',
  budgetBreakdown: 'yes',
  costsJustified: 'yes',
  costBenefitAnalysis: 'yes',
  environmentalImpactsIdentified: 'yes',
  environmentalMitigation: 'yes',
  riskAssessmentDone: 'yes',
  risksMitigated: 'yes',
  recommendation: 'recommend',
  topFive: { answer: 'no', rationale: 'Insufficient evidence.' },
}

describe('validateAndScoreReview', () => {
  it('calculates full rubric exactly in integer hundredths for ordinary variant', () => {
    expect(validateAndScoreReview({
      variant: 'ordinary',
      state: 'final',
      scores: quantitative,
      answers: ordinaryAnswers,
      calculatedScores: { a: 64, b: 51, c: 39, weightedHundredths: 5505 },
    })).toEqual({
      valid: true,
      scores: { a: 64, b: 51, c: 39, weightedHundredths: 5505 },
      errors: {},
    })
  })

  it('accepts incomplete drafts and does not mistake no for missing', () => {
    expect(validateAndScoreReview({
      variant: 'ordinary', state: 'draft', scores: { a: { interdisciplinary: 0 } },
      answers: { technicalApproachClear: 'no' },
    })).toEqual({
      valid: true,
      scores: { a: 0, b: 0, c: 0, weightedHundredths: 0 },
      errors: {},
    })
  })

  it('caps domestic patent points at nine and rejects unknown quantitative rows', () => {
    const result = validateAndScoreReview({
      variant: 'ordinary', state: 'draft', scores: {
        a: { innovation: { articles: true, domesticPatentCount: 8, international: true }, unapproved: 1 },
      },
    })
    expect(result.scores.a).toBe(20)
    expect(result.valid).toBe(false)
    expect(result.errors['scores.a.unapproved']).toBeTruthy()
  })

  it('rejects invalid tiers, quantitative bounds, and A3 component overflow', () => {
    const result = validateAndScoreReview({
      variant: 'ordinary', state: 'draft', scores: {
        a: {
          technologyLevel: { tier: 'high', score: 6 },
          interdisciplinary: 10,
          innovation: { articles: true, domesticPatentCount: -1, international: true },
        },
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toMatchObject({
      'scores.a.technologyLevel.score': expect.any(String),
      'scores.a.interdisciplinary': expect.any(String),
      'scores.a.innovation': expect.any(String),
    })
  })

  it('validates supplied qualitative draft answers while allowing absent fields', () => {
    expect(validateAndScoreReview({ variant: 'ordinary', state: 'draft', scores: {} }).valid).toBe(true)
    for (const answers of [null, { technicalApproachClear: 'unanswered' }, { recommendation: { toString: null } }, { topFive: 'no' }, { topFive: { answer: 'yes', rationale: 3 } }]) {
      expect(validateAndScoreReview({ variant: 'ordinary', state: 'draft', answers }).valid).toBe(false)
    }
  })

  it('validates supplied employer risk groups and fields in drafts', () => {
    for (const answers of [
      { risk: null },
      { risk: { financial: 'malformed' } },
      { risk: { financial: { budgetSufficiency: 'unanswered' } } },
      { risk: { financial: { costDrivers: 2 } } },
    ]) expect(validateAndScoreReview({ variant: 'employer', state: 'draft', answers }).valid).toBe(false)
    expect(validateAndScoreReview({ variant: 'employer', state: 'draft', scores: {}, answers: { risk: { financial: { costDrivers: 'materials' } } } }).valid).toBe(true)
  })

  it('requires final quantitative rows and enforces binary score bounds', () => {
    expect(validateAndScoreReview({
      variant: 'ordinary', state: 'final', scores: { ...quantitative, c: { ...quantitative.c, nationalStandard: undefined } },
      answers: ordinaryAnswers,
    }).errors['scores.c.nationalStandard']).toBeTruthy()
    expect(validateAndScoreReview({ variant: 'ordinary', state: 'draft', scores: { c: { nationalStandard: 5, scientificAuthorityEndorsement: 1 } } }).errors).toMatchObject({
      'scores.c.nationalStandard': expect.any(String),
      'scores.c.scientificAuthorityEndorsement': expect.any(String),
    })
  })

  it('rejects missing final qualitative responses and permits completed no answers', () => {
    const result = validateAndScoreReview({
      variant: 'ordinary', state: 'final', scores: quantitative,
      answers: { ...ordinaryAnswers, technicalApproachClear: 'no', risksMitigated: undefined },
    })
    expect(result.valid).toBe(false)
    expect(result.errors['answers.risksMitigated']).toBeTruthy()
  })

  it('rejects client-supplied totals that disagree with server calculation', () => {
    const result = validateAndScoreReview({
      variant: 'ordinary', state: 'draft', scores: quantitative,
      calculatedScores: { a: 64, b: 51, c: 39, weightedHundredths: 1 },
    })
    expect(result.errors['calculatedScores.weightedHundredths']).toBeTruthy()
  })

  it('accepts complete employer risk checklist and closing fields', () => {
    const answers = {
      risk: {
        assessment: { done: 'no' },
        financial: { budgetSufficiency: 'yes', costDrivers: 'Materials', minMaxCosts: '1 to 2.' },
        technical: { newTechnology: 'no', teamSkills: 'yes', materialsEquipmentTimely: 'yes', productionIssues: 'None expected.' },
        schedule: { schedule: 'Six months.', supplyDelays: 'no', otherTimingFactors: 'Weather.' },
        legal: { permits: 'yes', localNationalCompliance: 'yes', futureIssues: 'no' },
        human: { teamSizeSkills: 'yes', tensionsConflicts: 'no', training: 'yes' },
        environment: { negativeImpacts: 'no', mitigation: 'yes' },
        stakeholders: { keyStakeholders: 'Customers and suppliers.', support: 'yes', conflicts: 'no' },
        external: { economicPoliticalSocial: 'no', unpredictable: 'None identified.' },
      },
      recommendation: 'neutral', topFive: { answer: 'no', rationale: 'Not selected.' },
    }
    expect(validateAndScoreReview({ variant: 'employer', state: 'final', scores: quantitative, answers }).valid).toBe(true)
  })

  it('rejects placeholder employer final open responses but permits them in drafts', () => {
    const answers = {
      risk: {
        assessment: { done: 'no' },
        financial: { budgetSufficiency: 'yes', costDrivers: 'Materials', minMaxCosts: '1 to 2.' },
        technical: { newTechnology: 'no', teamSkills: 'yes', materialsEquipmentTimely: 'yes', productionIssues: 'None expected.' },
        schedule: { schedule: 'Six months.', supplyDelays: 'no', otherTimingFactors: 'Weather.' },
        legal: { permits: 'yes', localNationalCompliance: 'yes', futureIssues: 'no' },
        human: { teamSizeSkills: 'yes', tensionsConflicts: 'no', training: 'yes' },
        environment: { negativeImpacts: 'no', mitigation: 'yes' },
        stakeholders: { keyStakeholders: 'Customers and suppliers.', support: 'yes', conflicts: 'no' },
        external: { economicPoliticalSocial: 'no', unpredictable: 'None identified.' },
      },
      recommendation: 'neutral', topFive: { answer: 'no', rationale: 'Not selected.' },
    }
    for (const [key, placeholder] of [
      ['costDrivers', '  UNANSWERED  '], ['minMaxCosts', ' tBd '], ['productionIssues', '...'],
      ['schedule', '!!!'], ['otherTimingFactors', '???'], ['keyStakeholders', '---'], ['unpredictable', '…'],
      ['schedule', '. . .'], ['otherTimingFactors', '؟ ؟ ؟'],
    ] as const) {
      const modified = structuredClone(answers)
      const textFields = [modified.risk.financial, modified.risk.technical, modified.risk.schedule, modified.risk.stakeholders, modified.risk.external]
      const field = textFields.find(group => key in group)!
      Object.assign(field, { [key]: placeholder })
      const group = Object.entries(modified.risk).find(([, values]) => key in values)![0]
      expect(validateAndScoreReview({ variant: 'employer', state: 'final', scores: quantitative, answers: modified }).errors[`answers.risk.${group}.${key}`]).toBeTruthy()
      expect(validateAndScoreReview({ variant: 'employer', state: 'draft', scores: quantitative, answers: modified }).valid).toBe(true)
    }
  })

  it('validates required employer risk checklist answers on finalization', () => {
    const result = validateAndScoreReview({
      variant: 'employer', state: 'final', scores: quantitative,
      answers: {
        risk: { assessment: { done: 'no' }, financial: { costDrivers: '   ' } },
        recommendation: 'neutral', topFive: { answer: 'no', rationale: 'Not selected.' },
      },
    })
    expect(result.valid).toBe(false)
    expect(result.errors['answers.risk.financial.budgetSufficiency']).toBeTruthy()
    expect(result.errors['answers.risk.financial.costDrivers']).toBeTruthy()
  })

  it('rejects unknown variants and malformed boundary values without throwing', () => {
    expect(validateAndScoreReview(null).valid).toBe(false)
    expect(validateAndScoreReview({ variant: 'other', state: 'draft' }).valid).toBe(false)
  })
})
