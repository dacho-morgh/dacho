import { describe, expect, it } from 'vitest'

import {
  formatDate,
  LETTER_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  SERVICE_KEY_LABELS,
  serviceNameFor,
} from '@/utilities/dashboard-api'

// Slice 8 — frontend data layer. Unit-tests the pure mapping seams (Persian
// labels + Jalali date formatting + service-key denormalization) that translate
// backend DTOs into the dashboard's display values.

describe('REQUEST_STATUS_LABELS', () => {
  it('maps every request status to a Persian label', () => {
    expect(REQUEST_STATUS_LABELS.draft).toBe('پیش‌نویس')
    expect(REQUEST_STATUS_LABELS.in_review).toBe('درحال بررسی')
    expect(REQUEST_STATUS_LABELS.action_needed).toBe('نیاز به اقدام')
    expect(REQUEST_STATUS_LABELS.approved).toBe('تایید شده')
    expect(REQUEST_STATUS_LABELS.rejected).toBe('رد شده')
  })
})

describe('LETTER_TYPE_LABELS', () => {
  it('maps every letter type to a Persian label', () => {
    expect(LETTER_TYPE_LABELS.needs_fix).toBe('نیاز به اصلاح')
    expect(LETTER_TYPE_LABELS.approved).toBe('تایید درخواست')
    expect(LETTER_TYPE_LABELS.rejected).toBe('رد درخواست')
    expect(LETTER_TYPE_LABELS.official).toBe('نامه رسمی')
    expect(LETTER_TYPE_LABELS.notification).toBe('اطلاع رسانی')
  })
})

describe('SERVICE_KEY_LABELS / serviceNameFor', () => {
  it('denormalizes a known service key to its title', () => {
    expect(serviceNameFor('financing')).toBe('تأمین مالی و سرمایه‌گذاری')
    expect(SERVICE_KEY_LABELS.events).toBe('رویدادها و رقابت‌ها')
  })

  it('falls back to the raw key for an unknown value', () => {
    expect(serviceNameFor('something-else')).toBe('something-else')
  })
})

describe('formatDate', () => {
  it('formats an ISO timestamp to a Jalali date with Persian digits', () => {
    // 2026-09-01 ~ ۱۴۰۵/۰۶/۱۰ in the Persian calendar (deterministic per ICU).
    const out = formatDate('2026-09-01T00:00:00.000Z')
    // Persian digits (۰-۹), not ASCII — so match the Unicode digit range.
    expect(out).toMatch(/^[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}$/)
    expect(out).toContain('۱۴۰۵')
  })

  it('returns an empty string for a missing date', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('')).toBe('')
  })
})