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

async function pickOption(label: string, query: string, option: string) {
  const input = screen.getByRole('combobox', { name: label })
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: query } })
  fireEvent.click(await screen.findByRole('option', { name: option }))
}

async function pickFoundingDate() {
  fireEvent.click(screen.getByRole('button', { name: 'تاریخ تأسیس' }))
  fireEvent.click(await screen.findByRole('button', { name: 'انتخاب سال' }))
  fireEvent.click(screen.getByRole('button', { name: '۱۳۸۰' }))
  fireEvent.click(screen.getByRole('button', { name: 'انتخاب ماه' }))
  fireEvent.click(screen.getByRole('button', { name: 'مرداد' }))
  fireEvent.click(await screen.findByRole('button', { name: /۱۵-ام مرداد ۱۳۸۰/ }))
}

/** Fills every company field; `extra` runs last so a test can overwrite one of them. */
async function company(extra: () => void = () => {}) {
  fill('نام شرکت', 'شرکت نمونه')
  fill('شناسه ملی', VALID_ID)
  fill('حوزه فعالیت', 'انرژی')
  fill('شماره ثبت', '12345')
  await pickOption('نوع شرکت', 'تضام', 'تضامنی')
  await pickOption('استان', 'بوش', 'بوشهر')
  await pickOption('شهر', 'برازج', 'برازجان')
  await pickFoundingDate()
  fill('کد اقتصادی', '12345678901')
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
  signupFetch.mockImplementation(async (input) => {
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

/**
 * The register form calls two endpoints: the per-step duplicate check
 * (`availabilityFetch`, "nothing taken" unless a test says otherwise) and the
 * signup POST (`signupFetch`), which each test drives.
 */
let signupFetch = vi.fn<typeof fetch>()
let availabilityFetch = vi.fn<typeof fetch>()
function stubRegisterFetch() {
  signupFetch = vi.fn<typeof fetch>()
  availabilityFetch = vi.fn<typeof fetch>(async () => new Response('{}', { status: 200 }))
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>((input, init) =>
      String(input).includes('/signup-availability')
        ? availabilityFetch(input, init)
        : signupFetch(input, init),
    ),
  )
}

describe('registration form: layout, formats, location and date fields, auto sign-in (#278)', () => {
  const locationReplace = vi.fn()

  beforeEach(() => {
    replace.mockReset()
    locationReplace.mockReset()
    stubRegisterFetch()
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

    it('lays the company type dropdown out right to left like the province one', () => {
      render(createElement(RegisterPage))
      const type = screen.getByRole('combobox', { name: 'نوع شرکت' }) as HTMLInputElement
      expect(type.getAttribute('dir')).toBe('rtl')
      expect(type.closest('[data-slot="combobox-field"]')?.getAttribute('dir')).toBe('rtl')
      expect(type.placeholder).toBe('نوع شرکت را جستجو یا انتخاب کنید')
      fireEvent.focus(type)
      expect(screen.getByRole('option', { name: 'سهامی خاص' })).toBeTruthy()
      expect(screen.getByRole('option', { name: 'تعاونی' })).toBeTruthy()
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
      expect(signupFetch).not.toHaveBeenCalled()
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
      ['شماره ثبت', '12ab', 'شماره ثبت باید فقط شامل رقم باشد.', '۱۲۳۴'],
      ['شماره ثبت', '12', 'شماره ثبت باید بین ۳ تا ۶ رقم باشد.', '۱۲۳۴۵۶'],
      ['شماره ثبت', '1234567', 'شماره ثبت باید بین ۳ تا ۶ رقم باشد.', '123'],
      ['کد اقتصادی', '1۲x', 'کد اقتصادی باید فقط شامل رقم باشد.', '۱۲۳۴۵۶۷۸۹۰۱'],
      ['کد اقتصادی', '1234567890', 'کد اقتصادی باید ۱۱ رقم باشد.', '12345678901'],
      ['کد اقتصادی', '123456789012', 'کد اقتصادی باید ۱۱ رقم باشد.', '12345678901'],
    ])('rejects %s "%s" and accepts a corrected value', async (label, value, message, fixed) => {
      render(createElement(RegisterPage))
      await company(() => fill(label, value))
      expect(screen.getByText(message)).toBeTruthy()
      expect(screen.queryByLabelText('نام و نام خانوادگی')).toBeNull()
      fill(label, fixed)
      await advance()
      expect(screen.getByLabelText('نام و نام خانوادگی')).toBeTruthy()
    })
  })

  describe('province and city', () => {
    const optionNames = () =>
      within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)

    it('offers all 31 provinces and filters the cities by the chosen province', async () => {
      render(createElement(RegisterPage))
      const province = screen.getByRole('combobox', { name: 'استان' }) as HTMLInputElement
      const city = screen.getByRole('combobox', { name: 'شهر' }) as HTMLInputElement
      expect(city.disabled).toBe(true)
      expect(city.placeholder).toBe('ابتدا استان را انتخاب کنید')

      fireEvent.focus(province)
      expect(optionNames()).toHaveLength(31)
      fireEvent.change(province, { target: { value: 'آذربایجان' } })
      expect(optionNames()).toEqual(['آذربایجان شرقی', 'آذربایجان غربی'])
      fireEvent.change(province, { target: { value: 'بوشهر' } })
      fireEvent.click(screen.getByRole('option', { name: 'بوشهر' }))
      expect(province.value).toBe('بوشهر')
      expect(city.disabled).toBe(false)

      fireEvent.focus(city)
      expect(optionNames()).toContain('برازجان')
      expect(optionNames()).not.toContain('تبریز')
      fireEvent.change(city, { target: { value: 'برازج' } })
      expect(optionNames()).toEqual(['برازجان'])
      fireEvent.change(city, { target: { value: 'زززز' } })
      expect(screen.getByText('موردی پیدا نشد')).toBeTruthy()
    })

    it('matches Arabic letters and spaces, and only keeps a listed value', async () => {
      render(createElement(RegisterPage))
      await pickOption('استان', 'يزد', 'یزد')
      await pickOption('استان', 'هرمز', 'هرمزگان')
      await pickOption('شهر', 'بندر عباس', 'بندرعباس')
      const province = screen.getByRole('combobox', { name: 'استان' }) as HTMLInputElement
      // Free text is not a province: it is dropped, and so is the city under it.
      fireEvent.change(province, { target: { value: 'نامعتبر' } })
      expect((screen.getByRole('combobox', { name: 'شهر' }) as HTMLInputElement).value).toBe('')
      fireEvent.blur(province)
      expect(province.value).toBe('')
    })

    it('submits the chosen province and city', async () => {
      mockSignup({ signup: () => signedUp(false) })
      render(createElement(RegisterPage))
      await finishAllSteps()
      await waitFor(() => expect(signupFetch).toHaveBeenCalledOnce())
      const body = JSON.parse(String(signupFetch.mock.calls[0]![1]?.body))
      expect(body).toMatchObject({
        companyType: 'تضامنی',
        companyProvince: 'بوشهر',
        companyCity: 'برازجان',
        companyRegistrationNumber: '12345',
        companyEconomicCode: '12345678901',
      })
      expect(body).not.toHaveProperty('companyStatus')
    })
  })

  describe('Jalali founding date (shadcn calendar)', () => {
    const openPicker = () => fireEvent.click(screen.getByRole('button', { name: 'تاریخ تأسیس' }))

    it('picks a Jalali date from the calendar and submits it as YYYY/MM/DD', async () => {
      mockSignup({ signup: () => signedUp(false) })
      render(createElement(RegisterPage))
      const trigger = screen.getByRole('button', { name: 'تاریخ تأسیس' })
      expect(trigger.textContent).toBe('تاریخ تأسیس را انتخاب کنید')

      await pickFoundingDate()
      await waitFor(() => expect(trigger.textContent).toBe('۱۳۸۰/۰۵/۱۵'))
      expect(screen.queryByRole('dialog')).toBeNull()

      await finishAllSteps()
      await waitFor(() => expect(signupFetch).toHaveBeenCalledOnce())
      const body = JSON.parse(String(signupFetch.mock.calls[0]![1]?.body))
      expect(body.companyEstablishmentDate).toBe('1380/05/15')
    })

    it('never offers a year after the current Jalali year and disables later days', async () => {
      render(createElement(RegisterPage))
      openPicker()
      const today = todayJalali()
      const persian = (value: number) => String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!)
      // The year grid lists the newest year first and never a later one.
      fireEvent.click(await screen.findByRole('button', { name: 'انتخاب سال' }))
      const years = within(screen.getByRole('group', { name: 'سال‌ها' }))
        .getAllByRole('button')
        .map((button) => button.textContent)
      expect(years[0]).toBe(persian(today.year))
      expect(years.at(-1)).toBe(persian(1300))
      fireEvent.click(screen.getByRole('button', { name: persian(today.year) }))
      const days = within(screen.getByRole('dialog'))
        .getAllByRole('button')
        .filter((button) => /-ام /.test(button.getAttribute('aria-label') ?? ''))
      for (const day of days) {
        const number = Number(
          (day.textContent ?? '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))),
        )
        expect((day as HTMLButtonElement).disabled).toBe(number > today.day)
      }
      // The latest month is the current one: there is no next month to go to.
      const next = screen.getByRole('button', { name: 'ماه بعد' })
      expect(next.hasAttribute('disabled') || next.getAttribute('aria-disabled') === 'true').toBe(true)
    })

    it('sets today from the shortcut and clears it again', async () => {
      render(createElement(RegisterPage))
      const trigger = screen.getByRole('button', { name: 'تاریخ تأسیس' })
      openPicker()
      fireEvent.click(await screen.findByRole('button', { name: 'امروز' }))
      await waitFor(() => expect(trigger.textContent).not.toBe('تاریخ تأسیس را انتخاب کنید'))
      openPicker()
      fireEvent.click(await screen.findByRole('button', { name: 'پاک کردن' }))
      await waitFor(() => expect(trigger.textContent).toBe('تاریخ تأسیس را انتخاب کنید'))
    })
  })

  describe('signing in after signup', () => {
    it('enters the panel directly (the role landing page) when the session is established', async () => {
      mockSignup({})
      render(createElement(RegisterPage))
      await finishAllSteps()
      await waitFor(() => expect(locationReplace).toHaveBeenCalledWith('/dashboard/owner'))
      expect(replace).not.toHaveBeenCalled()
      expect(signupFetch.mock.calls.map(([url]) => String(url))).toEqual([
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
      expect(signupFetch.mock.calls.map(([url]) => String(url))).toContain(
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
      expect(signupFetch).toHaveBeenCalledTimes(1)
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
