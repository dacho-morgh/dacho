// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApplicantLettersView, type ApplicantLetterItem } from '@/components/dashboard/applicant-letters-view'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
afterEach(cleanup)

const items: ApplicantLetterItem[] = [
  { id: 'letter-1', title: 'نامه رسمی', type: 'official', typeLabel: 'نامه رسمی', senderName: 'کارخانه نوآوری', senderRole: 'دبیرخانه', sentDate: '۱۴۰۵/۰۱/۰۶' },
  { id: 'letter-2', title: 'اطلاعیه', type: 'notification', typeLabel: 'اطلاع رسانی', senderName: 'کارخانه نوآوری', senderRole: 'دبیرخانه', sentDate: '۱۴۰۵/۰۱/۰۶' },
]

describe('ApplicantLettersView', () => {
  it('renders the Figma table with وضعیت column and the support CTA', () => {
    render(createElement(ApplicantLettersView, { initialLetters: items }))
    expect(screen.getByRole('link', { name: 'پیام به پشتیبانی' }).getAttribute('href')).toBe('/dashboard/letters/new?mode=support')
    expect(screen.getByText('وضعیت')).toBeTruthy()
    expect(screen.getByText('تاریخ ارسال')).toBeTruthy()
    expect(screen.getAllByText('نامه رسمی').length).toBeGreaterThan(0)  // title + tag share the label
    expect(screen.getAllByText('کارخانه نوآوری').length).toBeGreaterThan(0)
    expect(screen.getAllByText('۱۴۰۵/۰۱/۰۶').length).toBeGreaterThan(0)
  })

  it('colors status tags per Figma (rejected=red, approved=success, official=brand, fix=warning, notification=grey)', () => {
    render(createElement(ApplicantLettersView, { initialLetters: [
      { ...items[0], type: 'rejected', typeLabel: 'رد درخواست' },
      { ...items[0], id: 'a2', type: 'approved', typeLabel: 'تایید درخواست' },
      { ...items[0], id: 'a3', type: 'needs_fix', typeLabel: 'نیاز به اصلاح' },
      { ...items[0], id: 'a4', type: 'official', typeLabel: 'نامه رسمی' },
      { ...items[0], id: 'a5', type: 'notification', typeLabel: 'اطلاع رسانی' },
    ] }))
    expect(document.querySelector('.bg-error-50.text-error-600')).toBeTruthy()
    expect(document.querySelector('.bg-success-50.text-success-600')).toBeTruthy()
    expect(document.querySelector('.bg-warning-50')).toBeTruthy()
    expect(document.querySelector('.bg-brand-50.text-brand-600')).toBeTruthy()
    expect(document.querySelector('.bg-neutral-100')).toBeTruthy()
  })

  it('shows the skeleton loading frame', () => {
    const { container } = render(createElement(ApplicantLettersView, { initialLetters: [], state: 'loading' }))
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(20)
  })

  it('shows the Figma empty state', () => {
    render(createElement(ApplicantLettersView, { initialLetters: [], state: 'empty' }))
    expect(screen.getByText('صندوق نامه‌های شما خالیست')).toBeTruthy()
  })

  it('filters by search', () => {
    render(createElement(ApplicantLettersView, { initialLetters: items }))
    const search = screen.getByPlaceholderText('درخواست خود را جست و جو کنید')
    fireEvent.change(search, { target: { value: 'اطلاعیه' } })
    expect(screen.queryAllByText('نامه رسمی')).toHaveLength(0)
    expect(screen.getAllByText('اطلاعیه')).toHaveLength(2)
  })

  it('keeps support tickets in their own tab and links them to detail', () => {
    render(createElement(ApplicantLettersView, { initialLetters: [
      { ...items[0], source: 'letter' },
      { ...items[1], id: 'support:ticket-1', title: 'تیکت من', source: 'ticket', senderName: 'پشتیبانی', senderRole: 'گیرنده' },
    ] }))

    expect(screen.getAllByRole('link', { name: 'نامه رسمی' }).map((link) => link.getAttribute('href')))
      .toEqual(['/dashboard/letters/letter-1', '/dashboard/letters/letter-1'])
    expect(screen.queryAllByRole('link', { name: 'تیکت من' })).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'نامه‌های ارسالی' }))
    expect(screen.queryAllByRole('link', { name: 'نامه رسمی' })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: 'تیکت من' })).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'تیکت‌های پشتیبانی' }))
    expect(screen.getAllByRole('link', { name: 'تیکت من' }).map((link) => link.getAttribute('href')))
      .toEqual(['/dashboard/letters/support%3Aticket-1', '/dashboard/letters/support%3Aticket-1'])
    expect(screen.getAllByText('گیرنده').length).toBeGreaterThan(0)
  })
})
