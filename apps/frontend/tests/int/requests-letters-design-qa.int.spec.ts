// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MailDetailView, type MailData } from '@/components/dashboard/mail-detail-view'
import { RequestsFilters } from '@/components/dashboard/requests'
import { RequestStatusBadge } from '@/components/dashboard/requests/request-status-badge'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/dashboard/requests',
}))

afterEach(cleanup)

function openFilter() {
  fireEvent.click(screen.getByRole('button', { name: /فیلتر/ }))
  return screen.getByRole('dialog')
}

describe('requests filter by audience (design QA #280)', () => {
  it('offers a company only its three stages', () => {
    render(createElement(RequestsFilters, { audience: 'company', filters: {}, events: [] }))
    const panel = openFilter()
    const options = within(panel).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['همه', 'احراز هویت', 'در حال داوری', 'تمام‌شده (نتیجهٔ نهایی)', 'همه رویدادها'])
    // None of the internal stages or statuses reaches the company.
    for (const internal of ['بررسی اولیه', 'سرمایه‌گذاری', 'نیازمند اقدام', 'پیش‌نویس']) {
      expect(within(panel).queryByText(new RegExp(internal))).toBeNull()
    }
  })

  it('shows the size of each company stage', () => {
    render(createElement(RequestsFilters, {
      audience: 'company',
      filters: { phase: 'reviewing' },
      events: [],
      stageCounts: { all: 4, verification: 1, reviewing: 2, finished: 1 },
    }))
    const panel = openFilter()
    expect(within(panel).getByRole('option', { name: 'در حال داوری (۲)' })).toBeTruthy()
  })

  it('keeps the real status and review stages for staff', () => {
    render(createElement(RequestsFilters, { filters: {}, events: [] }))
    const labels = within(openFilter()).getAllByRole('option').map((option) => option.textContent)
    expect(labels).toEqual(expect.arrayContaining(['نیازمند اقدام', 'پیش‌نویس', 'بررسی اولیه', 'داوری', 'سرمایه‌گذاری']))
    expect(labels).not.toContain('احراز هویت')
  })
})

describe('company stage badge', () => {
  it('shows the stage label it is given', () => {
    render(createElement(RequestStatusBadge, { stage: 'finished', label: 'تمام‌شده (نتیجهٔ نهایی)' }))
    expect(screen.getByText('تمام‌شده (نتیجهٔ نهایی)')).toBeTruthy()
  })
})

describe('replied letters of the letter view (Figma 31318:15820)', () => {
  const mail = (extra: Partial<MailData>): MailData => ({
    id: 'letter-3',
    title: 'نامه سوم',
    category: 'نامه رسمی',
    senderName: 'شرکت نمونه',
    senderRole: 'نماینده شرکت',
    datePersian: '۱۴۰۵/۰۸/۰۳',
    dayOfWeek: 'دوشنبه',
    timeStr: '۱۴:۵۰',
    body: 'متن نامه سوم',
    ...extra,
  })
  const older = (id: string, body: string): MailData => mail({ id, title: `عنوان ${id}`, body, senderName: `فرستنده ${id}` })

  it('puts earlier letters above the open one as one-line excerpts that open each letter', () => {
    render(createElement(MailDetailView, {
      mail: mail({ thread: [older('letter-1', 'متن اول'), older('letter-2', 'متن دوم')] }),
      showActions: true,
    }))
    const history = screen.getByRole('region', { name: 'تاریخچه مکاتبات پرونده' })
    const links = within(history).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/dashboard/letters/letter-1', '/dashboard/letters/letter-2'])
    expect(links[0]!.className).toContain('truncate')
    // The history comes first; the open letter's own heading follows it.
    const heading = screen.getByRole('heading', { level: 2, name: 'نامه سوم' })
    expect(history.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Each earlier letter ends with a divider, like the open one's header.
    expect(within(history).getAllByRole('separator')).toHaveLength(2)
  })

  it('shows no history section for a letter without earlier letters', () => {
    render(createElement(MailDetailView, { mail: mail({}) }))
    expect(screen.queryByRole('region', { name: 'تاریخچه مکاتبات پرونده' })).toBeNull()
  })

  it('uses a logical end padding for the mobile menu space of the breadcrumb', () => {
    render(createElement(MailDetailView, { mail: mail({}) }))
    const nav = screen.getByRole('navigation', { name: 'مسیر نامه' })
    expect(nav.className).toContain('pe-12')
    expect(nav.className).not.toMatch(/(^|\s)(pl|pr)-/)
  })
})
