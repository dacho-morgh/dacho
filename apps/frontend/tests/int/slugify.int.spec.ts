import { describe, expect, it } from 'vitest'

import { slugify, slugifyValue } from '@dacho/cms-core/utilities'

// Payload's built-in slugify strips every non-ASCII word character, which turns
// a Persian title into a string of bare dashes (and makes two same-length
// titles collide on the unique slug index). News/Posts pass this slugifier to
// `slugField()` instead.
describe('slugifyValue', () => {
  it('keeps Persian letters instead of reducing them to dashes', () => {
    expect(slugifyValue('انتقال واحد اعتبارات صندوق')).toBe('انتقال-واحد-اعتبارات-صندوق')
  })

  it('drops zero-width non-joiners so slugs stay URL-safe', () => {
    expect(slugifyValue('شرکت‌های دانش‌بنیان')).toBe('شرکتهای-دانشبنیان')
  })

  it('still lowercases and dashes Latin titles', () => {
    expect(slugifyValue('  My First Post!  ')).toBe('my-first-post')
  })

  it('collapses repeated separators and trims edge dashes', () => {
    expect(slugifyValue('a --  b - ')).toBe('a-b')
  })

  it('keeps digits from either numeral system', () => {
    expect(slugifyValue('گزارش ۱۴۰۵ q2')).toBe('گزارش-۱۴۰۵-q2')
  })

  it('returns an empty string for empty input', () => {
    expect(slugifyValue('')).toBe('')
    expect(slugifyValue(null)).toBe('')
  })
})

describe('slugify hook adapter', () => {
  it('slugifies the value Payload hands the slugField hook', () => {
    expect(slugify({ valueToSlugify: 'خبر تازه' })).toBe('خبر-تازه')
  })

  it('returns undefined when there is nothing to slugify', () => {
    expect(slugify({ valueToSlugify: undefined })).toBeUndefined()
  })
})
