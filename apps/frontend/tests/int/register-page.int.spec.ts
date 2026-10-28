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
              ? 'خطای سامانه'
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
})
