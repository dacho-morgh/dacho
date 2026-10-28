// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmployeeList } from '@/components/dashboard/employee-list'
import { OwnerEvents } from '@/components/dashboard/owner-events'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/employees',
  useSearchParams: () => new URLSearchParams(),
}))
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

function fillPerson() {
  for (const [label, value] of [
    ['نام و نام خانوادگی', 'کارفرمای نمونه'],
    ['شماره همراه', '09120000123'],
    ['رمز عبور', 'synthetic-password'],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
  fireEvent.change(screen.getByLabelText('نقش عملیاتی'), { target: { value: 'employer-reviewer' } })
}

const people = [
  { id: 'chief', name: 'سردبیر فعال', operationalRole: 'chief-reviewer', isActive: true },
  {
    id: 'investment',
    name: 'سرمایه‌گذار فعال',
    operationalRole: 'investment-reviewer',
    isActive: true,
  },
  { id: 'inactive', name: 'سردبیر غیرفعال', operationalRole: 'chief-reviewer', isActive: false },
  { id: 'employer', name: 'کارفرما', operationalRole: 'employer-reviewer', isActive: true },
]
const event1 = {
  id: 'e1',
  title: 'رویداد اول',
  description: 'شرح اول',
  registrationOpenAt: '2026-10-01T10:00:00.000Z',
  registrationCloseAt: '2026-10-02T10:00:00.000Z',
  responsibleChiefId: 'chief',
  responsibleInvestmentId: 'investment',
  revision: 2,
}

describe('owner events', () => {
  it('saves a valid UTC registration window across the local DST gap', async () => {
    vi.stubEnv('TZ', 'America/New_York')
    expect(new Date('2027-03-14T01:30:00').getTimezoneOffset()).toBe(300)
    const dstEvent = {
      ...event1,
      registrationOpenAt: '2027-03-14T02:30:00.000Z',
      registrationCloseAt: '2027-03-14T03:00:00.000Z',
    }
    const request = vi.fn(async (url: string, init?: RequestInit) =>
      url.startsWith('/api/users?')
        ? json({ docs: people })
        : init?.method === 'PATCH'
          ? json({ event: dstEvent })
          : json({ items: [dstEvent] }),
    )
    vi.stubGlobal('fetch', request)
    render(createElement(OwnerEvents))
    fireEvent.click(await screen.findByRole('button', { name: 'ویرایش رویداد اول' }))
    fireEvent.change(screen.getByLabelText('دلیل تغییر'), { target: { value: 'اصلاح عنوان' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    await screen.findByText('رویداد ذخیره شد.')
    expect(
      JSON.parse(
        request.mock.calls.find(([, init]) => init?.method === 'PATCH')![1]!.body as string,
      ),
    ).toMatchObject({
      registrationOpenAt: dstEvent.registrationOpenAt,
      registrationCloseAt: dstEvent.registrationCloseAt,
    })
  })

  it('preserves registration seconds when only title changes', async () => {
    const precise = {
      ...event1,
      registrationOpenAt: '2026-10-01T10:00:59.000Z',
      registrationCloseAt: '2026-10-02T10:00:48.000Z',
    }
    const request = vi.fn(async (url: string, init?: RequestInit) =>
      url.startsWith('/api/users?')
        ? json({ docs: people })
        : init?.method === 'PATCH'
          ? json({ event: precise })
          : json({ items: [precise] }),
    )
    vi.stubGlobal('fetch', request)
    render(createElement(OwnerEvents))
    fireEvent.click(await screen.findByRole('button', { name: 'ویرایش رویداد اول' }))
    fireEvent.change(screen.getByLabelText('عنوان رویداد'), { target: { value: 'عنوان جدید' } })
    fireEvent.change(screen.getByLabelText('دلیل تغییر'), { target: { value: 'اصلاح عنوان' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    await screen.findByText('رویداد ذخیره شد.')
    expect(
      JSON.parse(
        request.mock.calls.find(([, init]) => init?.method === 'PATCH')![1]!.body as string,
      ),
    ).toMatchObject({
      registrationOpenAt: precise.registrationOpenAt,
      registrationCloseAt: precise.registrationCloseAt,
    })
  })

  it('documents authorized public CMS entry without equating public and operational identities', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('/api/users?') ? json({ docs: people }) : json({ items: [] }),
      ),
    )
    render(createElement(OwnerEvents))
    expect(
      (await screen.findByRole('link', { name: 'مدیریت محتوای عمومی در CMS' })).getAttribute(
        'href',
      ),
    ).toBe('/admin/collections/events')
    expect(screen.getByText(/شناسه‌های این دو بخش یکسان نیستند/)).toBeTruthy()
  })
  it.each([401, 403, 500])(
    'shows event load failure %s without management controls, retries when allowed',
    async (status) => {
      let failed = true
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          failed
            ? json({}, status)
            : url.startsWith('/api/users?')
              ? json({ docs: [] })
              : json({ items: [] }),
        ),
      )
      render(createElement(OwnerEvents))
      await screen.findByRole('alert')
      expect(screen.queryByRole('button', { name: 'رویداد جدید' })).toBeNull()
      if (status === 401)
        expect(screen.getByRole('link', { name: 'ورود دوباره' }).getAttribute('href')).toBe(
          '/login?returnUrl=%2Fdashboard%2Fevents',
        )
      else {
        failed = false
        fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
        await screen.findByText('هنوز رویدادی ثبت نشده است.')
        fireEvent.click(screen.getByRole('button', { name: 'رویداد جدید' }))
        expect(screen.getAllByText(/شخص واجد شرایط وجود ندارد/)).toHaveLength(2)
      }
    },
  )

  it('requires date order and reason, preserves E1 on stale revision, explicitly reloads before PATCH retry without changing E2', async () => {
    const latest = { ...event1, title: 'نسخه جدید اول', revision: 3 }
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/users?')) return json({ docs: people, hasNextPage: false })
      if (init?.method === 'PATCH')
        return JSON.parse(init.body as string).revision === 2
          ? json({ error: 'stale_event', revision: 3 }, 409)
          : json({ event: latest })
      if (url.endsWith('/e1')) return json({ event: latest })
      return json({ items: [event1, { ...event1, id: 'e2', title: 'رویداد دوم' }] })
    })
    vi.stubGlobal('fetch', request)
    render(createElement(OwnerEvents))
    fireEvent.click(await screen.findByRole('button', { name: 'ویرایش رویداد اول' }))
    fireEvent.change(screen.getByLabelText('پایان ثبت‌نام (UTC)'), {
      target: { value: '2026-09-01T10:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    await screen.findByText('پایان ثبت‌نام باید پس از شروع باشد.')
    expect(screen.getByText('دلیل تغییر را وارد کنید.')).toBeTruthy()
    expect(request.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
    fireEvent.change(screen.getByLabelText('پایان ثبت‌نام (UTC)'), {
      target: { value: '2026-10-02T10:00' },
    })
    fireEvent.change(screen.getByLabelText('دلیل تغییر'), { target: { value: 'اصلاح عنوان' } })
    fireEvent.change(screen.getByLabelText('عنوان رویداد'), { target: { value: 'پیش‌نویس من' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    await screen.findByText(/اطلاعات تغییر کرده/)
    expect(screen.getByText('نسخه فعلی سرور: 3')).toBeTruthy()
    expect((screen.getByLabelText('عنوان رویداد') as HTMLInputElement).value).toBe('پیش‌نویس من')
    expect(
      (screen.getByRole('button', { name: 'ذخیره رویداد' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'بررسی نسخه جدید' }))
    await waitFor(() =>
      expect((screen.getByLabelText('عنوان رویداد') as HTMLInputElement).value).toBe(
        'نسخه جدید اول',
      ),
    )
    fireEvent.change(screen.getByLabelText('دلیل تغییر'), {
      target: { value: 'بازبینی نسخه جدید' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    await screen.findByText('رویداد ذخیره شد.')
    const writes = request.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    expect(writes.map(([url]) => url)).toEqual([
      '/api/dashboard/admin/events/e1',
      '/api/dashboard/admin/events/e1',
    ])
    expect(JSON.parse(writes[1][1]!.body as string)).toMatchObject({
      revision: 3,
      reason: 'بازبینی نسخه جدید',
    })
  })
  it('creates event using only eligible single-person selectors and registration timestamps', async () => {
    const request = vi.fn(async (url: string, init?: RequestInit) =>
      url.startsWith('/api/users?')
        ? json({ docs: people, hasNextPage: false })
        : init?.method === 'POST'
          ? json({ event: { ...event1, title: 'رویداد دوم' } }, 201)
          : json({ items: [event1] }),
    )
    vi.stubGlobal('fetch', request)
    render(createElement(OwnerEvents))
    fireEvent.click(await screen.findByRole('button', { name: 'رویداد جدید' }))
    fireEvent.change(screen.getByLabelText('عنوان رویداد'), { target: { value: 'رویداد دوم' } })
    fireEvent.change(screen.getByLabelText('شروع ثبت‌نام (UTC)'), {
      target: { value: '2026-11-01T10:00' },
    })
    fireEvent.change(screen.getByLabelText('پایان ثبت‌نام (UTC)'), {
      target: { value: '2026-11-02T10:00' },
    })
    fireEvent.change(screen.getByLabelText('سردبیر مسئول'), { target: { value: 'chief' } })
    fireEvent.change(screen.getByLabelText('مسئول سرمایه‌گذاری'), {
      target: { value: 'investment' },
    })
    expect(screen.queryByRole('option', { name: /سردبیر غیرفعال/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /^کارفرما/ })).toBeNull()
    expect((screen.getByLabelText('سردبیر مسئول') as HTMLSelectElement).multiple).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    await screen.findByText('رویداد ذخیره شد.')
    const [url, init] = request.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(url).toBe('/api/dashboard/admin/events')
    expect(JSON.parse(init!.body as string)).toEqual({
      title: 'رویداد دوم',
      description: '',
      registrationOpenAt: '2026-11-01T10:00:00.000Z',
      registrationCloseAt: '2026-11-02T10:00:00.000Z',
      responsibleChiefId: 'chief',
      responsibleInvestmentId: 'investment',
    })
  })
})

describe('owner personnel', () => {
  it('locks pending save, preserves values after server field rejection, normalizes phone and retries', async () => {
    let finish!: (value: Response) => void
    let writes = 0
    const request = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return json({ docs: [] })
      writes++
      return writes === 1
        ? new Promise<Response>((resolve) => {
            finish = resolve
          })
        : json({ doc: { id: 31, operationalRole: 'employer-reviewer', isActive: true } }, 201)
    })
    vi.stubGlobal('fetch', request)
    render(createElement(EmployeeList, { canManage: true }))
    const add = await screen.findByRole('button', { name: 'کارمند جدید' })
    await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(add)
    fillPerson()
    fireEvent.change(screen.getByLabelText('شماره همراه'), { target: { value: '۰۹۱۲۰۰۰۰۱۲۳' } })
    const form = screen.getByRole('form', { name: 'اطلاعات کارمند' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(writes).toBe(1))
    expect(
      (screen.getByRole('button', { name: 'بازگشت به فهرست' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    finish(json({ errors: [{ data: { errors: [{ path: 'phone' }] } }] }, 400))
    await screen.findByText('این مقدار معتبر یا یکتا نیست.')
    expect((screen.getByLabelText('نام و نام خانوادگی') as HTMLInputElement).value).toBe(
      'کارفرمای نمونه',
    )
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))
    await screen.findByText('اطلاعات ذخیره شد.')
    expect(writes).toBe(2)
    expect(
      JSON.parse(request.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body as string)
        .phone,
    ).toBe('09120000123')
  })
  it.each([401, 403, 500])('shows personnel load failure %s and safely retries', async (status) => {
    let failed = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (failed ? json({}, status) : json({ docs: [], hasNextPage: false }))),
    )
    render(createElement(EmployeeList, { canManage: true }))
    await screen.findByRole('alert')
    expect(
      (screen.getByRole('button', { name: 'کارمند جدید' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    if (status === 401) expect(screen.getByRole('link', { name: 'ورود دوباره' })).toBeTruthy()
    else {
      failed = false
      fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
      await screen.findByText('هنوز کارمندی ثبت نشده است.')
    }
  })
  it('keeps read-only personnel free of management controls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          items: [{ id: '31', name: 'کارمند', operationalRole: 'reviewer', isActive: true }],
        }),
      ),
    )
    render(createElement(EmployeeList))
    await screen.findByText('کارمند')
    expect(screen.queryByRole('button', { name: 'کارمند جدید' })).toBeNull()
    expect(screen.queryByRole('button', { name: /ویرایش/ })).toBeNull()
  })

  it('reloads a changed personnel snapshot only on explicit review, never overwrites stale edits', async () => {
    const original = {
      id: '31',
      name: 'نسخه قدیم',
      phone: '09120000123',
      email: '',
      operationalRole: 'reviewer',
      isActive: true,
      updatedAt: '2026-10-27T10:00:00Z',
    }
    let latest = original
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH')
        return JSON.parse(init.body as string).expectedUpdatedAt === latest.updatedAt
          ? json({ doc: { ...latest, isActive: false } })
          : json({ error: 'stale_personnel' }, 409)
      return url.startsWith('/api/users/31')
        ? json(latest)
        : json({ docs: [latest], hasNextPage: false })
    })
    vi.stubGlobal('fetch', request)
    render(createElement(EmployeeList, { canManage: true }))
    fireEvent.click(await screen.findByRole('button', { name: 'ویرایش نسخه قدیم' }))
    latest = { ...original, name: 'نسخه جدید', updatedAt: '2026-10-27T11:00:00Z' }
    fireEvent.click(screen.getByLabelText('حساب فعال'))
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))
    expect((await screen.findByRole('alert')).textContent).toContain('اطلاعات تغییر کرده')
    expect(request.mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(1)
    expect(request.mock.calls.some(([url]) => url.startsWith('/api/users/31'))).toBe(false)
    expect((screen.getByLabelText('نام و نام خانوادگی') as HTMLInputElement).value).toBe(
      'نسخه قدیم',
    )
    fireEvent.click(screen.getByRole('button', { name: 'بررسی نسخه جدید' }))
    await waitFor(() =>
      expect((screen.getByLabelText('نام و نام خانوادگی') as HTMLInputElement).value).toBe(
        'نسخه جدید',
      ),
    )
    fireEvent.click(screen.getByLabelText('حساب فعال'))
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))
    await screen.findByText('اطلاعات ذخیره شد.')
    const writes = request.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    expect(writes.map(([url]) => url)).toEqual([
      '/api/users/personnel/31',
      '/api/users/personnel/31',
    ])
    expect(JSON.parse(writes[0][1]!.body as string)).toMatchObject({
      expectedUpdatedAt: original.updatedAt,
    })
    expect(JSON.parse(writes[1][1]!.body as string)).toMatchObject({
      isActive: false,
      operationalRole: 'reviewer',
      expectedUpdatedAt: latest.updatedAt,
    })
    expect(JSON.parse(writes[1][1]!.body as string)).not.toHaveProperty('username')
  })
  it('creates a person with one scalar operational role using same-origin session, not an organization', async () => {
    const request = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json(
            {
              doc: {
                id: 31,
                name: 'کارفرمای نمونه',
                phone: '09120000123',
                operationalRole: 'employer-reviewer',
                isActive: true,
                updatedAt: '2026-10-27T10:00:00Z',
              },
            },
            201,
          )
        : json({ docs: [], hasNextPage: false }),
    )
    vi.stubGlobal('fetch', request)
    render(createElement(EmployeeList, { canManage: true }))
    const add = await screen.findByRole('button', { name: 'کارمند جدید' })
    await waitFor(() => expect((add as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(add)
    fillPerson()
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره' }))
    await screen.findByText('اطلاعات ذخیره شد.')
    const [url, init] = request.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(url).toBe('/api/users')
    expect(init?.credentials).toBe('same-origin')
    expect(JSON.parse(init!.body as string)).toEqual({
      name: 'کارفرمای نمونه',
      phone: '09120000123',
      username: '09120000123',
      password: 'synthetic-password',
      operationalRole: 'employer-reviewer',
      isActive: true,
    })
    expect(screen.queryByLabelText('سازمان کارفرما')).toBeNull()
  })
})
