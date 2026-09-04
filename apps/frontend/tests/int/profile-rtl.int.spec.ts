// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileView } from '@/components/dashboard/profile/profile-view'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

function expectHeadingBeforeAction(heading: HTMLElement) {
  const header = heading.parentElement

  expect(header).not.toBeNull()
  expect(header?.firstElementChild).toBe(heading)
  expect(header?.lastElementChild?.tagName).toBe('BUTTON')
}

describe('profile RTL layout', () => {
  afterEach(cleanup)

  beforeEach(() => {
    render(createElement(ProfileView))
  })

  it('places RTL content at the inline start and keeps actions at the inline end', () => {
    const root = screen.getByRole('heading', { level: 1, name: 'صفحه پروفایل' }).parentElement
    expect(root?.getAttribute('dir')).toBe('rtl')

    const avatar = screen.getByAltText('Company Profile Avatar').parentElement
    expect(avatar?.parentElement?.firstElementChild).toBe(avatar)

    expectHeadingBeforeAction(screen.getByRole('heading', { level: 2, name: 'اطلاعات پایه' }))
    expectHeadingBeforeAction(screen.getByRole('heading', { level: 2, name: 'آدرس ها' }))
    expectHeadingBeforeAction(screen.getByRole('heading', { level: 2, name: 'اشخاص' }))

    const addressActions = screen.getAllByTitle('ویرایش آدرس')[0]?.parentElement
    expect(addressActions?.parentElement?.lastElementChild).toBe(addressActions)

    for (const label of ['نام شرکت', 'وضعیت شرکت', 'شماره ثبت', 'شناسه ملی']) {
      expect(screen.getByText(label).parentElement?.className).toContain('items-start')
    }
  })

  it('uses logical direction utilities throughout the RTL profile', () => {
    const root = screen.getByRole('heading', { level: 1, name: 'صفحه پروفایل' }).parentElement
    const physicalDirectionPattern =
      /^(?:[a-z]+:)*(?:left-|right-|pl-|pr-|border-l(?:$|-)|border-r(?:$|-)|text-left$|text-right$)/
    const physicalTokens = [...(root?.querySelectorAll('[class]') ?? [])].flatMap((element) =>
      [...element.classList].filter((token) => physicalDirectionPattern.test(token)),
    )

    expect(physicalTokens).toEqual([])
  })

  it('isolates mixed-direction profile values', () => {
    for (const value of ['۱۵۷۸۱', '10100578556', '411111495187']) {
      for (const element of screen.getAllByText(value)) {
        expect(element.getAttribute('dir')).toBe('ltr')
      }
    }

    expect(screen.getByText('۱۳۵۱/۰۴/۱۲ (54 سال)').getAttribute('dir')).toBe('auto')

    for (const value of screen.getAllByText('1531638111')) {
      expect(value.getAttribute('dir')).toBe('ltr')
    }

    fireEvent.click(screen.getByRole('button', { name: 'اطلاعات حساب' }))

    for (const value of ['۰۹۱۲۳۴۵۶۷۸۹', 'sample@company.com']) {
      expect(screen.getByText(value).getAttribute('dir')).toBe('ltr')
    }
  })

  it('orders every modal heading before its close action in RTL', () => {
    fireEvent.click(screen.getAllByRole('button', { name: 'ویرایش' })[0])
    let heading = screen.getByRole('heading', { level: 3, name: 'ویرایش اطلاعات پایه' })
    expectHeadingBeforeAction(heading)
    fireEvent.click(heading.parentElement?.lastElementChild as HTMLElement)

    fireEvent.click(screen.getByRole('button', { name: 'آدرس جدید' }))
    heading = screen.getByRole('heading', { level: 3, name: 'اضافه کردن آدرس جدید' })
    expectHeadingBeforeAction(heading)
    fireEvent.click(heading.parentElement?.lastElementChild as HTMLElement)

    fireEvent.click(screen.getAllByTitle('ویرایش آدرس')[0])
    heading = screen.getByRole('heading', { level: 3, name: 'ویرایش آدرس' })
    expectHeadingBeforeAction(heading)
    fireEvent.click(heading.parentElement?.lastElementChild as HTMLElement)

    fireEvent.click(screen.getByRole('button', { name: 'اطلاعات حساب' }))
    fireEvent.click(screen.getByRole('button', { name: 'ویرایش' }))
    heading = screen.getByRole('heading', { level: 3, name: 'ویرایش اطلاعات تماس' })
    expectHeadingBeforeAction(heading)
    fireEvent.click(heading.parentElement?.lastElementChild as HTMLElement)

    fireEvent.click(screen.getByRole('button', { name: 'خروج از حساب کاربری' }))
    expectHeadingBeforeAction(
      screen.getByRole('heading', { level: 3, name: 'خروج از حساب کاربری' }),
    )
  })
})
