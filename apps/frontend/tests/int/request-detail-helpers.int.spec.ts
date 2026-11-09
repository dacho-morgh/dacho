import { describe, expect, it } from 'vitest'

import { personInitials } from '@/components/dashboard/request-detail/person-avatar'
import { answerEntries, answerText } from '@/components/dashboard/request-detail/request-fields'
import { formatEventDateRange } from '@/utilities/event-dates'

describe('formatEventDateRange', () => {
  it('writes a range inside one month as «۱۲–۱۵ بهمن ۱۴۰۵»', () => {
    expect(formatEventDateRange('2027-02-01T08:00:00.000Z', '2027-02-04T08:00:00.000Z')).toBe('۱۲–۱۵ بهمن ۱۴۰۵')
  })

  it('joins two full dates across months and shows a single date without an end', () => {
    expect(formatEventDateRange('2027-02-15T08:00:00.000Z', '2027-03-02T08:00:00.000Z')).toBe('۲۶ بهمن ۱۴۰۵ تا ۱۱ اسفند ۱۴۰۵')
    expect(formatEventDateRange('2027-02-01T08:00:00.000Z', null)).toBe('۱۲ بهمن ۱۴۰۵')
    expect(formatEventDateRange('2027-02-01T08:00:00.000Z', '2027-02-01T20:00:00.000Z')).toBe('۱۲ بهمن ۱۴۰۵')
  })

  it('is empty for an unknown or invalid start', () => {
    expect(formatEventDateRange(null, '2027-02-01T08:00:00.000Z')).toBe('')
    expect(formatEventDateRange('not a date')).toBe('')
  })
})

describe('personInitials', () => {
  it('takes the first letter of the first and last word', () => {
    expect(personInitials('امیر احمدی')).toBe('ا‌ا')
    expect(personInitials('علی رضا کریمی')).toBe('ع‌ک')
  })

  it('uses one letter for one word and nothing for no name', () => {
    expect(personInitials('داور')).toBe('د')
    expect(personInitials('  ')).toBe('')
    expect(personInitials(null)).toBe('')
  })
})

describe('answerEntries', () => {
  it('orders by the form, labels select options and keeps answers the form no longer has', () => {
    const entries = answerEntries(
      { b: 'oil', gone: 'x', a: 'متن', applicationTeam: [{ name: 'n' }] },
      [
        { name: 'a', label: 'الف', blockType: 'textarea' },
        { name: 'b', label: 'ب', blockType: 'select', options: [{ label: 'نفت', value: 'oil' }] },
        { name: 'unanswered', label: 'بی‌پاسخ', blockType: 'text' },
      ],
    )
    expect(entries.map((entry) => [entry.label, entry.value])).toEqual([
      ['الف', 'متن'],
      ['ب', 'نفت'],
      ['gone', 'x'],
    ])
    expect(entries[0]!.wide).toBe(true)
  })

  it('returns nothing for no answers and prints values, not objects', () => {
    expect(answerEntries(null, [])).toEqual([])
    expect(answerText(true)).toBe('بله')
    expect(answerText(['الف', 'ب'])).toBe('الف، ب')
    expect(answerText(undefined)).toBe('—')
  })
})
