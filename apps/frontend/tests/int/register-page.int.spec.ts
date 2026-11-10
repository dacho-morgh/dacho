// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterPage from '@/components/auth/register-page'
import { toPersianDigits } from '@/utilities/digits'
import { validNationalId } from '../helpers/nationalId'

const VALID_ID = validNationalId(1)

const { replace, useFormSpy } = vi.hoisted(() => ({ replace: vi.fn(), useFormSpy: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))
vi.mock('react-hook-form', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-hook-form')>()
  return {
    ...actual,
    useForm: (...args: Parameters<typeof actual.useForm>) => {
      useFormSpy(...args)
      return actual.useForm(...args)
    },
  }
})

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

/** Every company field except the name, national ID and activity domain. */
async function companyDetails() {
  fill('شماره ثبت', '۱۲۳۴۵')
  await pickOption('نوع شرکت', 'خاص', 'سهامی خاص')
  await pickOption('استان', 'بوش', 'بوشهر')
  await pickOption('شهر', 'برازج', 'برازجان')
  await pickFoundingDate()
  fill('کد اقتصادی', '12345678901')
}

async function company(nationalId = VALID_ID) {
  fill('نام شرکت', ' شرکت نمونه ')
  fill('شناسه ملی', nationalId)
  fill('حوزه فعالیت', ' انرژی ')
  await companyDetails()
  await advance()
}

async function representative() {
  fill('نام و نام خانوادگی', ' نماینده نمونه ')
  fill('سمت', ' مدیرعامل ')
  fill('شماره موبایل', '۰۹۱۲۱۲۳۴۵۶۷')
  fill('ایمیل', ' Person@Example.Invalid ')
  await advance()
  fill('رمز عبور', 'password123')
  fill('تکرار رمز عبور', 'password123')
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

describe('signup frontend contract (mocked HTTP, not release evidence)', () => {
  beforeEach(() => {
    replace.mockReset()
    useFormSpy.mockClear()
    stubRegisterFetch()
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('delegates validation to the React Hook Form resolver without validating future steps on continue', async () => {
    render(createElement(RegisterPage))
    expect(useFormSpy).toHaveBeenCalled()
    const options = useFormSpy.mock.calls[0][0]
    expect(options.resolver).toBeTypeOf('function')
    const result = await options.resolver(options.defaultValues, {}, { names: ['activityDomain'] })
    expect(result.errors.activityDomain.message).toBe('حوزه فعالیت را وارد کنید.')
    await company()
    expect(await screen.findByLabelText('نام و نام خانوادگی')).toBeTruthy()
    expect(screen.queryByText('رمز عبور را وارد کنید.')).toBeNull()
    expect(signupFetch).not.toHaveBeenCalled()
  })

  it('does not skip representative validation when continue is clicked twice during resolver work', async () => {
    render(createElement(RegisterPage))
    fill('نام شرکت', 'شرکت نمونه')
    fill('شناسه ملی', VALID_ID)
    fill('حوزه فعالیت', 'انرژی')
    await companyDetails()
    const next = screen.getByRole('button', { name: 'ادامه' })
    await act(async () => {
      fireEvent.click(next)
      fireEvent.click(next)
    })
    expect(screen.getByLabelText('نام و نام خانوادگی')).toBeTruthy()
    expect(screen.queryByLabelText('رمز عبور')).toBeNull()
    expect(signupFetch).not.toHaveBeenCalled()
  })

  it('requires activity domain on company step without making completion fields eligibility gates', async () => {
    render(createElement(RegisterPage))
    fill('نام شرکت', 'شرکت نمونه')
    fill('شناسه ملی', VALID_ID)
    await advance()
    expect(screen.getByText('حوزه فعالیت را وارد کنید.')).toBeTruthy()
    const activity = screen.getByLabelText('حوزه فعالیت')
    await waitFor(() => expect(document.activeElement).toBe(activity))
    fill('حوزه فعالیت', 'انرژی')
    await companyDetails()
    await advance()
    expect(screen.getByLabelText('نام و نام خانوادگی')).toBeTruthy()
    expect(signupFetch).not.toHaveBeenCalled()
  })

  it('requires every company field: a 3-6 digit registration number and an 11-digit economic code', async () => {
    render(createElement(RegisterPage))
    await advance()
    for (const message of [
      'نام شرکت را وارد کنید.',
      'شناسه ملی را وارد کنید.',
      'حوزه فعالیت را وارد کنید.',
      'شماره ثبت را وارد کنید.',
      'نوع شرکت را انتخاب کنید.',
      'استان را انتخاب کنید.',
      'شهر را انتخاب کنید.',
      'تاریخ تأسیس را انتخاب کنید.',
      'کد اقتصادی را وارد کنید.',
    ]) {
      expect(screen.getByText(message)).toBeTruthy()
    }
    // Nothing is optional, so nothing says so, and no field is starred.
    expect(screen.queryByText(/اختیاری/)).toBeNull()
    expect(screen.queryByLabelText('وضعیت شرکت')).toBeNull()
    expect(document.querySelector('[data-slot="required-marker"]')).toBeNull()

    for (const [value, message] of [
      ['12ab', 'شماره ثبت باید فقط شامل رقم باشد.'],
      ['12', 'شماره ثبت باید بین ۳ تا ۶ رقم باشد.'],
      ['1234567', 'شماره ثبت باید بین ۳ تا ۶ رقم باشد.'],
    ] as const) {
      fill('شماره ثبت', value)
      await advance()
      expect(screen.getByText(message)).toBeTruthy()
    }
    fill('کد اقتصادی', '12345')
    await advance()
    expect(screen.getByText('کد اقتصادی باید ۱۱ رقم باشد.')).toBeTruthy()
    expect(screen.queryByLabelText('نام و نام خانوادگی')).toBeNull()

    for (const value of ['123', '۱۲۳۴۵۶']) {
      fill('شماره ثبت', value)
      await advance()
      expect(screen.queryByText(/شماره ثبت باید/)).toBeNull()
    }
  })

  it('offers the legal forms of the Commercial Code and filters them as the person types', async () => {
    render(createElement(RegisterPage))
    const type = screen.getByRole('combobox', { name: 'نوع شرکت' }) as HTMLInputElement
    fireEvent.focus(type)
    const listed = () =>
      within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)
    expect(listed()).toEqual([
      'سهامی عام',
      'سهامی خاص',
      'مسئولیت محدود',
      'تضامنی',
      'مختلط غیرسهامی',
      'مختلط سهامی',
      'نسبی',
      'تعاونی',
    ])
    fireEvent.change(type, { target: { value: 'مختلط' } })
    expect(listed()).toEqual(['مختلط غیرسهامی', 'مختلط سهامی'])
    fireEvent.change(type, { target: { value: 'سهام' } })
    expect(listed()).toEqual(['سهامی عام', 'سهامی خاص', 'مختلط غیرسهامی', 'مختلط سهامی'])
    fireEvent.click(screen.getByRole('option', { name: 'مختلط سهامی' }))
    expect(type.value).toBe('مختلط سهامی')
    // Free text is not a legal form: it is dropped.
    fireEvent.change(type, { target: { value: 'نامعتبر' } })
    fireEvent.blur(type)
    expect(type.value).toBe('')
  })

  it('narrows the province list as the person types and only stores a listed province', async () => {
    render(createElement(RegisterPage))
    const province = screen.getByRole('combobox', { name: 'استان' }) as HTMLInputElement
    const city = screen.getByRole('combobox', { name: 'شهر' }) as HTMLInputElement
    expect(city.disabled).toBe(true)

    fireEvent.focus(province)
    fireEvent.change(province, { target: { value: 'بوش' } })
    expect(await screen.findByRole('option', { name: 'بوشهر' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'تبریز' })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'بوشهر' }))
    expect(province.value).toBe('بوشهر')
    expect(city.disabled).toBe(false)

    fireEvent.focus(city)
    fireEvent.change(city, { target: { value: 'برازج' } })
    fireEvent.click(await screen.findByRole('option', { name: 'برازجان' }))
    await waitFor(() => expect(city.value).toBe('برازجان'))

    // Free text that is not a province is dropped, along with the city under it.
    fireEvent.change(province, { target: { value: 'نامعتبر' } })
    expect(city.value).toBe('')
    fireEvent.blur(province)
    expect(province.value).toBe('')
  })

  it.each([VALID_ID, toPersianDigits(VALID_ID), VALID_ID.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!)])(
    'submits the normalized national ID %s without privilege fields (no session: falls back to login)',
    async (id) => {
      signupFetch.mockResolvedValue(new Response('{}', { status: 201 }))
      render(createElement(RegisterPage, { returnUrl: '/dashboard/requests?status=draft' }))
      await company(id)
      await representative()
      fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
      await waitFor(() => expect(signupFetch).toHaveBeenCalledOnce())
      const [url, options] = signupFetch.mock.calls[0]
      expect(url).toBe('/api/users/self-signup')
      expect(options?.method).toBe('POST')
      const body = JSON.parse(String(options?.body))
      expect(body).toMatchObject({
        companyName: 'شرکت نمونه',
        companyNationalId: VALID_ID,
        activityDomain: 'انرژی',
        name: 'نماینده نمونه',
        position: 'مدیرعامل',
        phone: '09121234567',
        email: 'person@example.invalid',
        password: 'password123',
      })
      for (const field of ['role', 'roles', 'operationalRole', 'cmsRole', 'passwordConfirmation']) {
        expect(body).not.toHaveProperty(field)
      }
      await waitFor(() =>
        expect(replace).toHaveBeenCalledWith(
          '/login?registered=1&returnUrl=%2Fdashboard%2Frequests%3Fstatus%3Ddraft',
        ),
      )
    },
  )

  it.each([
    ['', 'شناسه ملی را وارد کنید.'],
    ['۱۲x', 'شناسه ملی باید فقط شامل رقم باشد.'],
    ['12 34', 'شناسه ملی باید فقط شامل رقم باشد.'],
    ['12.34', 'شناسه ملی باید فقط شامل رقم باشد.'],
    ['۰۰١۲', 'شناسه ملی باید ۱۱ رقم باشد.'],
    ['123', 'شناسه ملی باید ۱۱ رقم باشد.'],
    ['12345678901234567890', 'شناسه ملی باید ۱۱ رقم باشد.'],
    ['12345678901', 'شناسه ملی معتبر نیست؛ ارقام را دوباره بررسی کنید.'],
    ['00000000000', 'شناسه ملی معتبر نیست؛ ارقام را دوباره بررسی کنید.'],
    [
      // One digit off a valid ID breaks the check digit.
      `${VALID_ID.slice(0, 10)}${(Number(VALID_ID[10]) + 1) % 10}`,
      'شناسه ملی معتبر نیست؛ ارقام را دوباره بررسی کنید.',
    ],
  ])(
    'rejects national ID %s with a Persian reason and focuses its linked error',
    async (id, message) => {
      render(createElement(RegisterPage))
      await company(id)
      const input = screen.getByLabelText('شناسه ملی')
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(screen.getByText(message).id).toBe(input.getAttribute('aria-describedby'))
      await waitFor(() => expect(document.activeElement).toBe(input))
      expect(screen.queryByLabelText('نام و نام خانوادگی')).toBeNull()
      expect(signupFetch).not.toHaveBeenCalled()
    },
  )

  it.each([
    [
      'companyNationalId',
      'شناسه ملی',
      'digits_only',
      'شناسه ملی باید فقط شامل رقم باشد.',
      'Invalid national ID: only digits are allowed.',
    ],
    [
      'companyNationalId',
      'شناسه ملی',
      'length',
      'شناسه ملی باید ۱۱ رقم باشد.',
      'Invalid national ID: a company national ID has exactly 11 digits.',
    ],
    [
      'companyNationalId',
      'شناسه ملی',
      'checksum',
      'شناسه ملی معتبر نیست؛ ارقام را دوباره بررسی کنید.',
      'Invalid national ID: the check digit does not match.',
    ],
    [
      'phone',
      'شماره موبایل',
      'mobile_format',
      'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
      'Invalid mobile number.',
    ],
    [
      'email',
      'ایمیل',
      'email_format',
      'ایمیل معتبر نیست؛ آن را به شکل name@example.com وارد کنید.',
      'Invalid email address.',
    ],
    [
      'companyType',
      'نوع شرکت',
      'company_type',
      'نوع شرکت را از فهرست انتخاب کنید.',
      'Invalid company type: choose one of the listed legal forms.',
    ],
    [
      'companyRegistrationNumber',
      'شماره ثبت',
      'registration_number_length',
      'شماره ثبت باید بین ۳ تا ۶ رقم باشد.',
      'Invalid registration number: expected 3 to 6 digits.',
    ],
    [
      'companyEconomicCode',
      'کد اقتصادی',
      'economic_code_length',
      'کد اقتصادی باید ۱۱ رقم باشد.',
      'Invalid economic code: expected exactly 11 digits.',
    ],
    [
      'activityDomain',
      'حوزه فعالیت',
      undefined,
      'مقدار واردشده معتبر نیست.',
      'Internal validation details.',
    ],
  ])(
    'localizes invalid_field for %s (%s) by its reason and returns focus without discarding answers',
    async (field, label, reason, message, serverMessage) => {
      signupFetch.mockResolvedValue(
        new Response(
          JSON.stringify({
            errors: [{ code: 'invalid_field', field, reason, message: serverMessage }],
          }),
          { status: 400 },
        ),
      )
      render(createElement(RegisterPage))
      await company()
      await representative()
      fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
      expect(await screen.findByText(message)).toBeTruthy()
      const input = screen.getByLabelText(label)
      await waitFor(() => expect(document.activeElement).toBe(input))
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(screen.queryByText(serverMessage)).toBeNull()
      expect((input as HTMLInputElement).value).not.toBe('')
    },
  )

  it('keeps signup_rejected generic in Persian, focuses notice and retains all three steps for retry', async () => {
    signupFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              code: 'signup_rejected',
              message: 'Registration could not be completed with the supplied details.',
            },
          ],
        }),
        { status: 400 },
      ),
    )
    render(createElement(RegisterPage))
    await company()
    await representative()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
    const notice = await screen.findByRole('alert')
    expect(notice.textContent).toBe(
      'اطلاعات ارسالی پذیرفته نشد. موارد واردشده را بررسی و دوباره تلاش کنید.',
    )
    await waitFor(() => expect(document.activeElement).toBe(notice))
    expect(screen.queryByText(/قبلاً ثبت شده/)).toBeNull()
    expect((screen.getByLabelText('رمز عبور') as HTMLInputElement).value).toBe('password123')
    fireEvent.click(screen.getByRole('button', { name: 'بازگشت' }))
    expect((screen.getByLabelText('شماره موبایل') as HTMLInputElement).value).toBe('۰۹۱۲۱۲۳۴۵۶۷')
    fireEvent.click(screen.getByRole('button', { name: 'بازگشت' }))
    expect((screen.getByLabelText('حوزه فعالیت') as HTMLInputElement).value).toBe(' انرژی ')
    expect(replace).not.toHaveBeenCalled()
  })

  it('stops on the representative step when the mobile is already registered and keeps the error until it changes', async () => {
    availabilityFetch.mockImplementation(async (_input, init) => {
      const query = JSON.parse(String(init?.body)) as Record<string, string>
      return query.phone === '09121234567'
        ? new Response(
            JSON.stringify({
              errors: [{ code: 'phone_taken', field: 'phone', message: 'Taken.' }],
            }),
            { status: 409 },
          )
        : new Response('{}', { status: 200 })
    })
    render(createElement(RegisterPage))
    await company()
    expect(JSON.parse(String(availabilityFetch.mock.calls[0]?.[1]?.body))).toEqual({
      companyNationalId: VALID_ID,
    })

    fill('نام و نام خانوادگی', 'نماینده نمونه')
    fill('سمت', 'مدیرعامل')
    fill('شماره موبایل', '۰۹۱۲۱۲۳۴۵۶۷')
    fill('ایمیل', ' Person@Example.Invalid ')
    await advance()

    expect(JSON.parse(String(availabilityFetch.mock.calls[1]?.[1]?.body))).toEqual({
      phone: '09121234567',
      email: 'person@example.invalid',
    })
    const phone = screen.getByLabelText('شماره موبایل')
    await screen.findByText('این شماره موبایل قبلاً ثبت شده است.')
    expect(screen.queryByLabelText('رمز عبور')).toBeNull()
    expect(screen.queryByText('این ایمیل قبلاً ثبت شده است.')).toBeNull()
    expect(screen.getByRole('link', { name: 'ورود به حساب' })).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(phone))

    // Leaving the field re-runs validation; the duplicate is still reported.
    await act(async () => {
      fireEvent.blur(phone)
    })
    expect(screen.getByText('این شماره موبایل قبلاً ثبت شده است.')).toBeTruthy()

    fill('شماره موبایل', '09127654321')
    await advance()
    expect(await screen.findByLabelText('رمز عبور')).toBeTruthy()
    expect(signupFetch).not.toHaveBeenCalled()
  })

  it('stops on the company step when the national ID is already registered', async () => {
    availabilityFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            { code: 'duplicate_national_id', field: 'companyNationalId', message: 'Taken.' },
          ],
        }),
        { status: 409 },
      ),
    )
    render(createElement(RegisterPage))
    await company()

    expect(await screen.findByText(/این شناسه ملی قبلاً ثبت شده است/)).toBeTruthy()
    expect(screen.queryByLabelText('نام و نام خانوادگی')).toBeNull()
    expect(screen.getByLabelText('شناسه ملی').getAttribute('aria-invalid')).toBe('true')
  })

  it('does not block the step when the duplicate check itself fails', async () => {
    availabilityFetch.mockRejectedValue(new TypeError('offline'))
    render(createElement(RegisterPage))
    await company()
    expect(await screen.findByLabelText('نام و نام خانوادگی')).toBeTruthy()
  })

  it('puts a duplicate mobile or email reported at submit on its field and step', async () => {
    signupFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ code: 'email_taken', field: 'email', message: 'Taken.' }],
        }),
        { status: 409 },
      ),
    )
    render(createElement(RegisterPage))
    await company()
    await representative()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))

    expect(await screen.findByText('این ایمیل قبلاً ثبت شده است.')).toBeTruthy()
    expect(screen.getByLabelText('ایمیل')).toBeTruthy()
    expect(screen.queryByLabelText('رمز عبور')).toBeNull()
  })

  it('labels and focuses an optional company type when the server rejects its supplied value', async () => {
    signupFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              code: 'invalid_field',
              field: 'companyType',
              message: 'Invalid legal form.',
            },
          ],
        }),
        { status: 400 },
      ),
    )
    render(createElement(RegisterPage))
    await company()
    await representative()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
    expect(await screen.findByText('مقدار واردشده معتبر نیست.')).toBeTruthy()
    const type = screen.getByRole('combobox', { name: 'نوع شرکت' })
    await waitFor(() => expect(document.activeElement).toBe(type))
    expect(type.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(type.getAttribute('aria-describedby') || '')?.textContent).toBe(
      'مقدار واردشده معتبر نیست.',
    )
  })

  it.each(['network', 'server', 'duplicate', 'unknown'])(
    'recovers from %s without navigation or discarded passwords',
    async (failure) => {
      if (failure === 'network') signupFetch.mockRejectedValue(new TypeError('offline'))
      else
        signupFetch.mockResolvedValue(
          new Response(
            JSON.stringify({
              errors: [
                failure === 'duplicate'
                  ? {
                      code: 'duplicate_national_id',
                      field: 'companyNationalId',
                      message: 'This company is already registered.',
                    }
                  : { code: 'unknown', message: 'Private English failure details.' },
              ],
            }),
            { status: failure === 'server' ? 503 : failure === 'duplicate' ? 409 : 400 },
          ),
        )
      render(createElement(RegisterPage))
      await company()
      await representative()
      fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
      const alert = await screen.findByRole('alert')
      if (failure === 'duplicate') {
        await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('شناسه ملی')))
        expect(screen.getByText(/هر شرکت تنها یک نماینده دارد/)).toBeTruthy()
        // The known-taken national ID keeps the company step from continuing.
        await advance()
        expect(screen.queryByLabelText('نام و نام خانوادگی')).toBeNull()
        fill('شناسه ملی', validNationalId(2))
        await advance()
        await advance()
      } else {
        expect(alert.textContent).toContain(
          failure === 'network'
            ? 'ارتباط با سامانه'
            : failure === 'server'
              ? 'ممکن است ثبت‌نام انجام شده باشد'
              : 'پذیرفته نشد',
        )
        await waitFor(() => expect(document.activeElement).toBe(alert))
      }
      expect((screen.getByLabelText('رمز عبور') as HTMLInputElement).value).toBe('password123')
      expect(screen.queryByText('Private English failure details.')).toBeNull()
      expect(replace).not.toHaveBeenCalled()
    },
  )

  it('locks submit and back while pending, then allows retry after a malformed failure body', async () => {
    let finish!: (response: Response) => void
    signupFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    render(createElement(RegisterPage))
    await company()
    await representative()
    const submit = screen.getByRole('button', { name: 'ثبت شرکت' }) as HTMLButtonElement
    fireEvent.click(submit)
    expect(submit.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'بازگشت' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    fireEvent.submit(screen.getByRole('form'))
    await waitFor(() => expect(signupFetch).toHaveBeenCalledOnce())
    finish(new Response('not JSON', { status: 502 }))
    await screen.findByRole('alert')
    await waitFor(() => expect(submit.disabled).toBe(false))
    expect((screen.getByLabelText('رمز عبور') as HTMLInputElement).value).toBe('password123')
  })

  it('freezes the submitted answers while pending and unlocks them for a retry', async () => {
    let finish!: (response: Response) => void
    signupFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    render(createElement(RegisterPage))
    await company()
    await representative()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
    const password = screen.getByLabelText('رمز عبور') as HTMLInputElement
    // The field set disables its controls, which `:disabled` reports.
    await waitFor(() => expect(password.matches(':disabled')).toBe(true))
    expect(screen.getByLabelText('تکرار رمز عبور').matches(':disabled')).toBe(true)
    expect(screen.getByRole('form').getAttribute('aria-busy')).toBe('true')
    // The login link stays usable while the submission is pending.
    expect(screen.getByRole('link', { name: 'وارد شوید' }).getAttribute('href')).toBe(
      '/login?returnUrl=%2Fdashboard',
    )
    finish(
      new Response(
        JSON.stringify({ errors: [{ code: 'signup_rejected', message: 'Rejected.' }] }),
        { status: 400 },
      ),
    )
    await screen.findByRole('alert')
    await waitFor(() => expect(password.matches(':disabled')).toBe(false))
    expect(password.value).toBe('password123')
    expect(screen.getByRole('form').getAttribute('aria-busy')).toBeNull()
  })

  it('reports a rolled-back server failure as not created, without a recovery prompt', async () => {
    signupFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [{ code: 'signup_failed', message: 'Registration failed. Please try again.' }],
        }),
        { status: 500 },
      ),
    )
    render(createElement(RegisterPage))
    await company()
    await representative()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(
      'ثبت‌نام به دلیل خطای سامانه انجام نشد. اطلاعات شما حفظ شده است؛ لطفاً دوباره تلاش کنید.',
    )
    expect(document.getElementById('register-recovery')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })

  it('offers sign-in recovery for a duplicate national ID without claiming a second company', async () => {
    signupFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              code: 'duplicate_national_id',
              field: 'companyNationalId',
              message: 'This company is already registered.',
            },
          ],
        }),
        { status: 409 },
      ),
    )
    render(createElement(RegisterPage, { returnUrl: '/dashboard/requests' }))
    await company()
    await representative()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(
      'این شرکت قبلاً در سامانه ثبت شده است و شرکت دیگری با این شناسه ملی ایجاد نشد.',
    )
    const recovery = document.getElementById('register-recovery')
    expect(recovery?.textContent).toContain('به‌جای ثبت دوباره وارد شوید')
    expect(screen.getByRole('link', { name: 'ورود به حساب' }).getAttribute('href')).toBe(
      '/login?returnUrl=%2Fdashboard%2Frequests',
    )
    expect(replace).not.toHaveBeenCalled()
  })

  it('treats a dropped connection as an unknown outcome and explains a later duplicate as the same signup', async () => {
    signupFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [
              {
                code: 'duplicate_national_id',
                field: 'companyNationalId',
                message: 'This company is already registered.',
              },
            ],
          }),
          { status: 409 },
        ),
      )
    render(createElement(RegisterPage))
    await company()
    await representative()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
    const first = await screen.findByRole('alert')
    expect(first.textContent).toBe(
      'ارتباط با سامانه قطع شد و نتیجه ثبت‌نام مشخص نیست. اطلاعات شما حفظ شده است.',
    )
    expect(first.textContent).not.toContain('انجام نشد')
    expect(document.getElementById('register-recovery')?.textContent).toContain(
      'پیش از ارسال دوباره، با شماره موبایل یا ایمیل خود وارد شوید',
    )

    const submit = screen.getByRole('button', { name: 'ثبت شرکت' }) as HTMLButtonElement
    await waitFor(() => expect(submit.disabled).toBe(false))
    fireEvent.click(submit)
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'این شرکت در سامانه ثبت شده است؛ ممکن است ارسال قبلی شما انجام شده باشد. شرکت دیگری ایجاد نشد.',
      ),
    )
    expect(signupFetch).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('link', { name: 'ورود به حساب' })).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it('times out a hung request as an unknown outcome and unlocks retry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      signupFetch.mockImplementation(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
          }),
      )
      render(createElement(RegisterPage))
      await company()
      await representative()
      const submit = screen.getByRole('button', { name: 'ثبت شرکت' }) as HTMLButtonElement
      fireEvent.click(submit)
      await waitFor(() => expect(signupFetch).toHaveBeenCalledOnce())
      expect(submit.disabled).toBe(true)
      await act(async () => {
        vi.advanceTimersByTime(30_000)
      })
      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain('نتیجه ثبت‌نام مشخص نیست')
      await waitFor(() => expect(submit.disabled).toBe(false))
      expect(replace).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('aborts a pending submission on unmount and ignores its late response', async () => {
    let signal: AbortSignal | undefined
    let finish!: (response: Response) => void
    signupFetch.mockImplementation((_url, init) => {
      signal = init?.signal ?? undefined
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    const { unmount } = render(createElement(RegisterPage))
    await company()
    await representative()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
    await waitFor(() => expect(signupFetch).toHaveBeenCalledOnce())
    unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => {
      finish(new Response('{}', { status: 201 }))
    })
    expect(replace).not.toHaveBeenCalled()
  })
})
