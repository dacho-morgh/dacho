// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterPage from '@/components/auth/register-page'
import { todayJalali } from '@/utilities/jalali'
import { validNationalId } from '../helpers/nationalId'

const VALID_ID = validNationalId(7)

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

async function advance() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'ادامه' }))
  })
}

async function company(extra: () => void = () => {}) {
  fill('نام شرکت', 'شرکت نمونه')
  fill('شناسه ملی', VALID_ID)
  fill('حوزه فعالیت', 'انرژی')
  extra()
  await advance()
}

async function representative() {
  fill('نام و نام خانوادگی', 'نماینده نمونه')
  fill('سمت', 'مدیرعامل')
  fill('شماره موبایل', '۰۹۱۲۱۲۳۴۵۶۷')
  fill('ایمیل', 'person@example.invalid')
  await advance()
}

const signedUp = (established: boolean) =>
  new Response(
    JSON.stringify({
      user: { id: 1, contentEditor: false },
      company: { id: 2 },
      session: { established, exp: 1_900_000_000 },
    }),
    { status: 201 },
  )

/** Routes the three requests the form makes after a signup by URL. */
function mockSignup(handlers: {
  signup?: () => Response
  capabilities?: () => Response
  access?: () => Response
}) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input)
    if (url === '/api/users/self-signup') return (handlers.signup ?? (() => signedUp(true)))()
    if (url === '/api/dashboard/capabilities') {
      return (handlers.capabilities ?? (() => Response.json({ destinations: ['/dashboard/owner'] })))()
    }
    if (url.startsWith('/api/dashboard/access')) {
      return (handlers.access ?? (() => Response.json({ allowed: true })))()
    }
    throw new Error(`Unexpected request ${url}`)
  })
}

async function finishAllSteps() {
  await company()
  await representative()
  fill('رمز عبور', 'password123')
  fill('تکرار رمز عبور', 'password123')
  fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
}

describe('registration form: layout, formats, location and date fields, auto sign-in (#278)', () => {
  const locationReplace = vi.fn()

  beforeEach(() => {
    replace.mockReset()
    locationReplace.mockReset()
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal('location', { replace: locationReplace, href: 'http://localhost/register' })
    // Radix popovers measure their anchor.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  describe('layout', () => {
    it('has no back control above the title on the first step', () => {
      render(createElement(RegisterPage))
      expect(screen.queryByRole('link', { name: 'بازگشت' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'بازگشت' })).toBeNull()
      expect(screen.getByRole('button', { name: 'ادامه' })).toBeTruthy()
    })

    it('draws the continue button as the 48px primary button of the design system', () => {
      render(createElement(RegisterPage))
      const next = screen.getByRole('button', { name: 'ادامه' })
      expect(next.getAttribute('data-slot')).toBe('button')
      expect(next.getAttribute('data-size')).toBe('48')
      expect(next.className).toContain('h-12')
      expect(next.className).toContain('min-w-32')
    })

    it('lays the company type dropdown out right to left', () => {
      render(createElement(RegisterPage))
      const type = screen.getByRole('combobox', { name: 'نوع شرکت (اختیاری)' })
      expect(type.getAttribute('dir')).toBe('rtl')
      expect(type.closest('[data-slot="select-field"]')?.getAttribute('dir')).toBe('rtl')
      // The placeholder is the empty first choice; the options are Persian.
      expect(within(type).getByRole('option', { name: 'نوع شرکت را انتخاب کنید' })).toBeTruthy()
      expect(within(type).getByRole('option', { name: 'سهامی خاص' })).toBeTruthy()
    })
  })

  describe('per-step validation and when errors appear', () => {
    it('does not advance past an invalid step and keeps later steps unvalidated', async () => {
      render(createElement(RegisterPage))
      await advance()
      expect(screen.getByText('نام شرکت را وارد کنید.')).toBeTruthy()
      expect(screen.getByText('شناسه ملی را وارد کنید.')).toBeTruthy()
      expect(screen.queryByLabelText('نام و نام خانوادگی')).toBeNull()
      expect(screen.queryByText('نام و نام خانوادگی را وارد کنید.')).toBeNull()
    })

    it('shows no error on entering the security step; one appears after touch or after a submit attempt', async () => {
      render(createElement(RegisterPage))
      await company()
      const continueButton = screen.getByRole('button', { name: 'ادامه' })
      await representative()
      // The continue button is replaced, not morphed into the submit button, so
      // the click that opened this step can never also submit it.
      expect(continueButton.isConnected).toBe(false)

      const password = screen.getByLabelText('رمز عبور')
      const confirmation = screen.getByLabelText('تکرار رمز عبور')
      expect(password.getAttribute('aria-invalid')).toBeNull()
      expect(confirmation.getAttribute('aria-invalid')).toBeNull()
      expect(screen.queryByText(/را وارد کنید\./)).toBeNull()

      // Touching one field reports that field only.
      fireEvent.blur(password)
      expect(await screen.findByText('رمز عبور را وارد کنید.')).toBeTruthy()
      expect(confirmation.getAttribute('aria-invalid')).toBeNull()

      // A submit attempt reports everything still wrong, and sends nothing.
      fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
      expect(await screen.findByText('تکرار رمز عبور را وارد کنید.')).toBeTruthy()
      expect(confirmation.getAttribute('aria-invalid')).toBe('true')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('flags a short password and a mismatched confirmation only after they are touched', async () => {
      render(createElement(RegisterPage))
      await company()
      await representative()
      fill('رمز عبور', 'short')
      fireEvent.blur(screen.getByLabelText('رمز عبور'))
      expect(await screen.findByText('رمز عبور باید حداقل ۸ کاراکتر باشد.')).toBeTruthy()
      fill('رمز عبور', 'password123')
      fill('تکرار رمز عبور', 'password124')
      fireEvent.blur(screen.getByLabelText('تکرار رمز عبور'))
      expect(await screen.findByText('رمز عبور و تکرار آن یکسان نیستند.')).toBeTruthy()
      // Changing the password re-checks the confirmation the person already typed.
      fill('رمز عبور', 'password124')
      await waitFor(() => expect(screen.queryByText('رمز عبور و تکرار آن یکسان نیستند.')).toBeNull())
    })
  })

  describe('field formats', () => {
    it('reports a bad mobile and email inline, blocks the step, and accepts Persian digits', async () => {
      render(createElement(RegisterPage))
      await company()
      fill('نام و نام خانوادگی', 'نماینده نمونه')
      fill('سمت', 'مدیرعامل')
      fill('شماره موبایل', '0912')
      fireEvent.blur(screen.getByLabelText('شماره موبایل'))
      expect(
        await screen.findByText('شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.'),
      ).toBeTruthy()
      fill('ایمیل', 'not-an-email')
      fireEvent.blur(screen.getByLabelText('ایمیل'))
      expect(
        await screen.findByText('ایمیل معتبر نیست؛ آن را به شکل name@example.com وارد کنید.'),
      ).toBeTruthy()

      await advance()
      expect(screen.queryByLabelText('رمز عبور')).toBeNull()
      await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('شماره موبایل')))

      fill('شماره موبایل', '۰۹۱۲۱۲۳۴۵۶۷')
      fill('ایمیل', 'person@example.invalid')
      await advance()
      expect(screen.getByLabelText('رمز عبور')).toBeTruthy()
    })

    it.each([
      ['شماره ثبت (اختیاری)', '12ab'],
      ['کد اقتصادی', '1۲x'],
    ])('requires %s to be digits when it is filled', async (label, value) => {
      render(createElement(RegisterPage))
      await company(() => fill(label, value))
      expect(screen.getByText('این فیلد باید فقط شامل رقم باشد.')).toBeTruthy()
      expect(screen.queryByLabelText('نام و نام خانوادگی')).toBeNull()
      fill(label, '۱۲۳۴')
      await advance()
      expect(screen.getByLabelText('نام و نام خانوادگی')).toBeTruthy()
    })
  })

  describe('province and city', () => {
    const optionNames = (select: HTMLElement) =>
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent)

    it('offers all 31 provinces and filters the cities by the chosen province', () => {
      render(createElement(RegisterPage))
      const province = screen.getByRole('combobox', { name: 'استان (اختیاری)' })
      const city = screen.getByRole('combobox', { name: 'شهر (اختیاری)' })
      expect(optionNames(province)).toHaveLength(31 + 1)
      expect((city as HTMLSelectElement).disabled).toBe(true)
      expect(optionNames(city)).toEqual(['ابتدا استان را انتخاب کنید'])

      fireEvent.change(province, { target: { value: 'بوشهر' } })
      expect((city as HTMLSelectElement).disabled).toBe(false)
      expect(optionNames(city)).toContain('برازجان')
      expect(optionNames(city)).not.toContain('تبریز')

      fireEvent.change(city, { target: { value: 'برازجان' } })
      expect((city as HTMLSelectElement).value).toBe('برازجان')
    })

    it('clears the city when the province changes and submits the pair', async () => {
      mockSignup({ signup: () => signedUp(false) })
      render(createElement(RegisterPage))
      const province = screen.getByRole('combobox', { name: 'استان (اختیاری)' })
      const city = screen.getByRole('combobox', { name: 'شهر (اختیاری)' })
      fireEvent.change(province, { target: { value: 'بوشهر' } })
      fireEvent.change(city, { target: { value: 'برازجان' } })
      fireEvent.change(province, { target: { value: 'تهران' } })
      expect((city as HTMLSelectElement).value).toBe('')
      expect(optionNames(city)).toContain('ری')
      expect(optionNames(city)).not.toContain('برازجان')
      fireEvent.change(city, { target: { value: 'ری' } })

      await company(() => {
        expect((city as HTMLSelectElement).value).toBe('ری')
      })
      await representative()
      fill('رمز عبور', 'password123')
      fill('تکرار رمز عبور', 'password123')
      fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
      await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
      const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]?.body))
      expect(body).toMatchObject({ companyProvince: 'تهران', companyCity: 'ری' })
    })
  })

  describe('Jalali founding date', () => {
    const openPicker = () => fireEvent.click(screen.getByLabelText('تاریخ تأسیس'))

    it('picks a Jalali date from the calendar and submits it as YYYY/MM/DD', async () => {
      mockSignup({ signup: () => signedUp(false) })
      render(createElement(RegisterPage))
      const trigger = screen.getByLabelText('تاریخ تأسیس')
      expect(trigger.textContent).toBe('تاریخ تأسیس را انتخاب کنید')

      openPicker()
      fireEvent.change(await screen.findByLabelText('سال'), { target: { value: '1380' } })
      fireEvent.change(screen.getByLabelText('ماه'), { target: { value: '5' } })
      fireEvent.click(screen.getByRole('button', { name: /۱۵ مرداد ۱۳۸۰$/ }))

      await waitFor(() => expect(trigger.textContent).toBe('۱۳۸۰/۰۵/۱۵'))
      expect(screen.queryByLabelText('سال')).toBeNull()

      await company()
      await representative()
      fill('رمز عبور', 'password123')
      fill('تکرار رمز عبور', 'password123')
      fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
      await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
      const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]?.body))
      expect(body.companyEstablishmentDate).toBe('1380/05/15')
    })

    it('never offers a year after the current Jalali year and disables later days', async () => {
      render(createElement(RegisterPage))
      openPicker()
      const years = within(await screen.findByLabelText('سال'))
        .getAllByRole('option')
        .map((option) => option.textContent)
      const today = todayJalali()
      expect(years[0]).toBe(String(today.year).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!))
      const days = screen.getAllByRole('button').filter((button) => button.dataset.variant === 'day')
      for (const day of days) {
        const number = Number(
          (day.textContent ?? '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))),
        )
        expect((day as HTMLButtonElement).disabled).toBe(number > today.day)
      }
      expect(days.some((day) => day.dataset.today === 'true')).toBe(true)
      // The latest month is the current one: there is no next month to go to.
      expect((screen.getByRole('button', { name: 'ماه بعد' }) as HTMLButtonElement).disabled).toBe(true)
      expect((screen.getByRole('button', { name: 'ماه قبل' }) as HTMLButtonElement).disabled).toBe(false)
    })

    it('moves between days with the arrow keys (right to left) and closes with Escape', async () => {
      render(createElement(RegisterPage))
      openPicker()
      await screen.findByLabelText('سال')
      const todayButton = await waitFor(() => {
        const focused = document.activeElement as HTMLElement
        expect(focused.dataset.variant).toBe('day')
        return focused
      })
      expect(todayButton.dataset.today).toBe('true')
      const todayLabel = todayButton.getAttribute('aria-label')
      fireEvent.keyDown(todayButton, { key: 'ArrowRight' })
      await waitFor(() => {
        const focused = document.activeElement as HTMLElement
        expect(focused.dataset.variant).toBe('day')
        expect(focused.getAttribute('aria-label')).not.toBe(todayLabel)
      })
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByLabelText('سال')).toBeNull())
      expect(document.activeElement).toBe(screen.getByLabelText('تاریخ تأسیس'))
    })
  })

  describe('Jalali date picker keyboard', () => {
    const dayButton = (label: RegExp) => screen.getByRole('button', { name: label })
    const pick = async (year: string, month: string) => {
      fireEvent.click(screen.getByLabelText('تاریخ تأسیس'))
      fireEvent.change(await screen.findByLabelText('سال'), { target: { value: year } })
      fireEvent.change(screen.getByLabelText('ماه'), { target: { value: month } })
    }
    /** Presses a key on the focused day and waits for focus to land on the expected day. */
    const press = async (key: string, expected: RegExp) => {
      fireEvent.keyDown(document.activeElement as HTMLElement, { key })
      await waitFor(() => {
        const active = document.activeElement as HTMLElement
        expect(active.dataset.variant).toBe('day')
        expect(active.getAttribute('aria-label')).toMatch(expected)
      })
    }

    it('moves focus with every navigation key, across month and year boundaries', async () => {
      render(createElement(RegisterPage))
      await pick('1380', '5')
      // 15 Mordad 1380 is a Monday (the 3rd column from the right).
      dayButton(/ ۱۵ مرداد ۱۳۸۰$/).focus()
      await press('ArrowRight', /^یکشنبه ۱۴ مرداد ۱۳۸۰$/)
      await press('ArrowLeft', /^دوشنبه ۱۵ مرداد ۱۳۸۰$/)
      await press('ArrowDown', /^دوشنبه ۲۲ مرداد ۱۳۸۰$/)
      await press('ArrowUp', /^دوشنبه ۱۵ مرداد ۱۳۸۰$/)
      await press('Home', /^شنبه ۱۳ مرداد ۱۳۸۰$/)
      await press('End', /^جمعه ۱۹ مرداد ۱۳۸۰$/)
      // Past the end of the week row, the next day is the Saturday of the next row.
      await press('ArrowLeft', /^شنبه ۲۰ مرداد ۱۳۸۰$/)
      await press('PageDown', /^.* ۲۰ شهریور ۱۳۸۰$/)
      await press('PageUp', /^.* ۲۰ مرداد ۱۳۸۰$/)
      expect((screen.getByLabelText('ماه') as HTMLSelectElement).value).toBe('5')

      // The first of a month steps back into the previous month.
      dayButton(/ ۱ مرداد ۱۳۸۰$/).focus()
      await press('ArrowRight', /^.* ۳۱ تیر ۱۳۸۰$/)
      expect((screen.getByLabelText('ماه') as HTMLSelectElement).value).toBe('4')
      // ... and the first of the year into the last day of the previous year.
      fireEvent.change(screen.getByLabelText('ماه'), { target: { value: '1' } })
      dayButton(/ ۱ فروردین ۱۳۸۰$/).focus()
      await press('ArrowRight', /^.* ۳۰ اسفند ۱۳۷۹$/)
      expect((screen.getByLabelText('سال') as HTMLSelectElement).value).toBe('1379')
    })

    it('starts a move from the day that really has focus, not from a stale tab stop', async () => {
      render(createElement(RegisterPage))
      await pick('1380', '5')
      // The roving tab stop is still on the previously viewed day; focus another one.
      dayButton(/ ۲۰ مرداد ۱۳۸۰$/).focus()
      await press('ArrowRight', /^.* ۱۹ مرداد ۱۳۸۰$/)
    })

    it('does not move past the latest selectable day', async () => {
      render(createElement(RegisterPage))
      fireEvent.click(screen.getByLabelText('تاریخ تأسیس'))
      await screen.findByLabelText('سال')
      const today = await waitFor(() => {
        const active = document.activeElement as HTMLElement
        expect(active.dataset.today).toBe('true')
        return active
      })
      fireEvent.keyDown(today, { key: 'ArrowLeft' })
      fireEvent.keyDown(today, { key: 'ArrowDown' })
      fireEvent.keyDown(today, { key: 'PageDown' })
      expect((document.activeElement as HTMLElement).dataset.today).toBe('true')
      expect((screen.getByLabelText('سال') as HTMLSelectElement).value).toBe(
        String(todayJalali().year),
      )
    })
  })

  describe('signing in after signup', () => {
    it('enters the panel directly (the role landing page) when the session is established', async () => {
      mockSignup({})
      render(createElement(RegisterPage))
      await finishAllSteps()
      await waitFor(() => expect(locationReplace).toHaveBeenCalledWith('/dashboard/owner'))
      expect(replace).not.toHaveBeenCalled()
      expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
        '/api/users/self-signup',
        '/api/dashboard/capabilities',
      ])
    })

    it('honours an explicit return URL after checking access, like the login form', async () => {
      mockSignup({})
      render(createElement(RegisterPage, { returnUrl: '/dashboard/requests?status=draft' }))
      await finishAllSteps()
      await waitFor(() =>
        expect(locationReplace).toHaveBeenCalledWith('/dashboard/requests?status=draft'),
      )
      expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toContain(
        '/api/dashboard/access?path=%2Fdashboard%2Frequests',
      )
    })

    it('sends a denied return URL to the dashboard instead', async () => {
      mockSignup({ access: () => Response.json({ allowed: false }) })
      render(createElement(RegisterPage, { returnUrl: '/dashboard/admin' }))
      await finishAllSteps()
      await waitFor(() => expect(locationReplace).toHaveBeenCalledWith('/dashboard?access=denied'))
    })

    it('falls back to the login page when the server created the account but did not sign in', async () => {
      mockSignup({ signup: () => signedUp(false) })
      render(createElement(RegisterPage, { returnUrl: '/dashboard/requests' }))
      await finishAllSteps()
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith(
          '/login?registered=1&returnUrl=%2Fdashboard%2Frequests',
        ),
      )
      expect(locationReplace).not.toHaveBeenCalled()
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    })

    it('falls back to the login page when the panel cannot be resolved after signing in', async () => {
      mockSignup({ capabilities: () => new Response('{}', { status: 403 }) })
      render(createElement(RegisterPage))
      await finishAllSteps()
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith('/login?registered=1&returnUrl=%2Fdashboard'),
      )
      expect(locationReplace).not.toHaveBeenCalled()
    })
  })
})
