import { nationalIdProblem as serverNationalIdProblem } from '@dacho/cms-core/auth/self-signup'
import { describe, expect, it } from 'vitest'
import {
  citiesOfProvince,
  IRAN_PROVINCES,
  isCityOfProvince,
  isKnownProvince,
} from '@/data/iran-locations'
import { toEnglishDigits, toPersianDigits } from '@/utilities/digits'
import {
  emailProblem,
  mobileProblem,
  nationalIdProblem,
  SIGNUP_REASON_MESSAGES,
} from '@/utilities/signup-validation'
import { validNationalId } from '../helpers/nationalId'

describe('client signup rules mirror the server (#278)', () => {
  it('agrees with the server national ID rule on valid and perturbed IDs', () => {
    let state = 12345
    const next = () => (state = (state * 1103515245 + 12345) % 2 ** 31)
    const samples: string[] = ['', '0', '12', '00000000000', '12345678901', '1234567890123']
    for (let index = 0; index < 400; index++) {
      const valid = validNationalId(next())
      samples.push(
        valid,
        `${valid.slice(0, 10)}${(Number(valid[10]) + 1 + (next() % 9)) % 10}`,
        valid.slice(0, 5 + (next() % 5)),
        `${valid}${next() % 10}`,
        valid.replace(/\d/, 'x'),
      )
    }
    for (const sample of samples) {
      // The server sees digits already normalized to ASCII.
      expect({ sample, reason: nationalIdProblem(toPersianDigits(sample)) }).toEqual({
        sample,
        reason: serverNationalIdProblem(toEnglishDigits(sample.trim())),
      })
    }
    expect(nationalIdProblem(validNationalId(99))).toBeUndefined()
  })

  it('has a Persian message for every reason', () => {
    for (const message of Object.values(SIGNUP_REASON_MESSAGES)) {
      expect(message).toMatch(/[؀-ۿ]/)
    }
  })

  it('checks the Iranian mobile and email shapes', () => {
    expect(mobileProblem('۰۹۱۲۱۲۳۴۵۶۷')).toBeUndefined()
    expect(mobileProblem('09121234567')).toBeUndefined()
    for (const bad of ['', '9121234567', '0912123456', '091212345678', '0812 1234567', '+989121234567']) {
      expect(mobileProblem(bad)).toBe('mobile_format')
    }
    expect(emailProblem('person@example.com')).toBeUndefined()
    expect(emailProblem(' Person.Name+tag@sub.example.ir ')).toBeUndefined()
    for (const bad of ['', 'a', 'a@b', 'a@b.c', '@example.com', 'a b@example.com', 'a..b@example.com']) {
      expect(emailProblem(bad)).toBe('email_format')
    }
  })
})

describe('Iran provinces and cities dataset', () => {
  it('has the 31 provinces, each with unique, non-empty city names', () => {
    expect(IRAN_PROVINCES).toHaveLength(31)
    expect(new Set(IRAN_PROVINCES.map((province) => province.name)).size).toBe(31)
    for (const province of IRAN_PROVINCES) {
      expect(province.cities.length).toBeGreaterThanOrEqual(5)
      expect(new Set(province.cities).size).toBe(province.cities.length)
      for (const name of [province.name, ...province.cities]) {
        expect(name).toBe(name.trim())
        // Normalized Persian letters, never Arabic yeh/kaf.
        expect(name).not.toMatch(/[يك]/)
      }
    }
  })

  it('looks provinces and their cities up exactly', () => {
    expect(isKnownProvince('بوشهر')).toBe(true)
    expect(isKnownProvince('نامشخص')).toBe(false)
    expect(citiesOfProvince('نامشخص')).toEqual([])
    expect(citiesOfProvince('تهران')).toContain('تهران')
    expect(isCityOfProvince('بوشهر', 'برازجان')).toBe(true)
    expect(isCityOfProvince('تهران', 'برازجان')).toBe(false)
    // Every province's capital is among the well-known ones.
    const capitals = Object.fromEntries(IRAN_PROVINCES.map((p) => [p.name, p.cities[0]]))
    expect(capitals['فارس']).toBe('شیراز')
    expect(capitals['خوزستان']).toBe('اهواز')
    expect(capitals['اصفهان']).toBe('اصفهان')
  })
})
