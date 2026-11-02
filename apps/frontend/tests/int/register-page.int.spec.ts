// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RegisterPage from '@/components/auth/register-page'

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

async function company(nationalId = '12345678901') {
  fill('نام شرکت', ' شرکت نمونه ')
  fill('شناسه ملی', nationalId)
  fill('حوزه فعالیت', ' انرژی ')
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

describe('signup frontend contract (mocked HTTP, not release evidence)', () => {
  beforeEach(() => {
    replace.mockReset()
    useFormSpy.mockClear()
    vi.stubGlobal('fetch', vi.fn())
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
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not skip representative validation when continue is clicked twice during resolver work', async () => {
    render(createElement(RegisterPage))
    fill('نام شرکت', 'شرکت نمونه')
    fill('شناسه ملی', '123')
    fill('حوزه فعالیت', 'انرژی')
    const next = screen.getByRole('button', { name: 'ادامه' })
    await act(async () => {
      fireEvent.click(next)
      fireEvent.click(next)
    })
    expect(screen.getByLabelText('نام و نام خانوادگی')).toBeTruthy()
    expect(screen.queryByLabelText('رمز عبور')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requires activity domain on company step without making completion fields eligibility gates', async () => {
    render(createElement(RegisterPage))
    fill('نام شرکت', 'شرکت نمونه')
    fill('شناسه ملی', '12345678901')
    await advance()
    expect(screen.getByText('حوزه فعالیت را وارد کنید.')).toBeTruthy()
    const activity = screen.getByLabelText('حوزه فعالیت')
    await waitFor(() => expect(document.activeElement).toBe(activity))
    fill('حوزه فعالیت', 'انرژی')
    await advance()
    expect(screen.getByLabelText('نام و نام خانوادگی')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['۰۰١۲', '123', '12345678901234567890'])(
    'submits normalized digit-only ID %s without a length gate or privilege fields',
    async (id) => {
      vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 201 }))
      render(createElement(RegisterPage, { returnUrl: '/dashboard/requests?status=draft' }))
      await company(id)
      await representative()
      fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
      await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
      const [url, options] = vi.mocked(fetch).mock.calls[0]
      expect(url).toBe('/api/users/self-signup')
      expect(options?.method).toBe('POST')
      const body = JSON.parse(String(options?.body))
      expect(body).toMatchObject({
        companyName: 'شرکت نمونه',
        companyNationalId: id === '۰۰١۲' ? '0012' : id,
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

  it.each(['', '۱۲x', '12 34', '12.34'])(
    'rejects empty or nondigit national ID %s and focuses its linked error',
    async (id) => {
      render(createElement(RegisterPage))
      await company(id)
      const input = screen.getByLabelText('شناسه ملی')
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(
        screen.getByText(id ? 'شناسه ملی باید فقط شامل رقم باشد.' : 'شناسه ملی را وارد کنید.').id,
      ).toBe(input.getAttribute('aria-describedby'))
      await waitFor(() => expect(document.activeElement).toBe(input))
      expect(fetch).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['companyNationalId', 'شناسه ملی', 'شناسه ملی باید فقط شامل رقم باشد.', 'Invalid national ID.'],
    [
      'phone',
      'شماره موبایل',
      'شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.',
      'Invalid mobile number.',
    ],
    ['activityDomain', 'حوزه فعالیت', 'مقدار واردشده معتبر نیست.', 'Internal validation details.'],
  ])(
    'localizes invalid_field for %s and returns focus without discarding answers',
    async (field, label, message, serverMessage) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            errors: [{ code: 'invalid_field', field, message: serverMessage }],
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
    vi.mocked(fetch).mockResolvedValue(
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

  it('labels and focuses an optional company type when the server rejects its supplied value', async () => {
    vi.mocked(fetch).mockResolvedValue(
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
    const type = screen.getByRole('combobox', { name: 'نوع شرکت (اختیاری)' })
    await waitFor(() => expect(document.activeElement).toBe(type))
    expect(type.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(type.getAttribute('aria-describedby') || '')?.textContent).toBe(
      'مقدار واردشده معتبر نیست.',
    )
  })

  it.each(['network', 'server', 'duplicate', 'unknown'])(
    'recovers from %s without navigation or discarded passwords',
    async (failure) => {
      if (failure === 'network') vi.mocked(fetch).mockRejectedValue(new TypeError('offline'))
      else
        vi.mocked(fetch).mockResolvedValue(
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
    vi.mocked(fetch).mockImplementation(
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
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    finish(new Response('not JSON', { status: 502 }))
    await screen.findByRole('alert')
    await waitFor(() => expect(submit.disabled).toBe(false))
    expect((screen.getByLabelText('رمز عبور') as HTMLInputElement).value).toBe('password123')
  })

  it('freezes the submitted answers while pending and unlocks them for a retry', async () => {
    let finish!: (response: Response) => void
    vi.mocked(fetch).mockImplementation(
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
    vi.mocked(fetch).mockResolvedValue(
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
    vi.mocked(fetch).mockResolvedValue(
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
    vi.mocked(fetch)
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
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('link', { name: 'ورود به حساب' })).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it('times out a hung request as an unknown outcome and unlocks retry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      vi.mocked(fetch).mockImplementation(
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
      await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
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
    vi.mocked(fetch).mockImplementation((_url, init) => {
      signal = init?.signal ?? undefined
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    const { unmount } = render(createElement(RegisterPage))
    await company()
    await representative()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت شرکت' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => {
      finish(new Response('{}', { status: 201 }))
    })
    expect(replace).not.toHaveBeenCalled()
  })
})
