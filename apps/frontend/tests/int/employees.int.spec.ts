// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmployeeList } from '@/components/dashboard/employee-list'
import { EmployeeForm } from '@/components/dashboard/employees/employee-form'

const navigation = vi.hoisted(() => ({ push: vi.fn(), search: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/employees',
  useSearchParams: () => navigation.search,
  useRouter: () => ({ push: navigation.push }),
}))
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  navigation.search = new URLSearchParams()
})

const staff = [
  {
    id: 1,
    name: 'مهندس آرش حسینی',
    operationalRole: 'reviewer',
    isActive: true,
    degree: 'کارشناسی ارشد مدیریت بازرگانی',
    activityField: 'فناوری اطلاعات',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 2,
    name: 'دکتر نازنین بهرامی',
    operationalRole: 'investment-reviewer',
    isActive: true,
    degree: 'کارشناسی ارشد فناوری اطلاعات',
    activityField: 'خدمات مالی',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  { id: 3, name: 'نماینده شرکت', operationalRole: 'representative', isActive: true },
]

function openMenu(name: string) {
  const trigger = screen.getByRole('button', { name: `عملیات ${name}` })
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  return screen.findByRole('menu')
}

describe('employee list', () => {
  it('shows staff in the Figma columns, hides representatives, searches and filters by role', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ docs: staff, hasNextPage: false })),
    )
    render(createElement(EmployeeList, { canManage: true }))
    const table = await screen.findByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['نام کارمند', 'نقش', 'زمینه فعالیت', 'مدرک دانشگاهی', 'عملیات'])
    expect(screen.getByText('کارشناسی ارشد مدیریت بازرگانی')).toBeTruthy()
    expect(screen.getByText('کمیته سرمایه‌گذاری')).toBeTruthy()
    expect(screen.queryByText('نماینده شرکت')).toBeNull()
    expect(screen.getByRole('link', { name: 'کارمند جدید' }).getAttribute('href')).toBe(
      '/dashboard/employees/new',
    )

    fireEvent.change(screen.getByLabelText('جستجوی کارمند'), { target: { value: 'خدمات' } })
    expect(screen.queryByText('مهندس آرش حسینی')).toBeNull()
    expect(screen.getByText('دکتر نازنین بهرامی')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('جستجوی کارمند'), { target: { value: 'ناموجود' } })
    expect(screen.getByText('کارمندی با این مشخصات پیدا نشد')).toBeTruthy()
  })

  it('shows the Figma empty state with an add action for the owner', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ docs: [], hasNextPage: false })),
    )
    render(createElement(EmployeeList, { canManage: true }))
    await screen.findByText('کارمندی در این صفحه موجود نیست')
    expect(screen.getByText('اولین کارمند را اضافه کنید')).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'کارمند جدید' })).toHaveLength(2)
  })

  it.each([401, 403, 500])('shows personnel load failure %s and safely retries', async (status) => {
    let failed = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (failed ? json({}, status) : json({ docs: [], hasNextPage: false }))),
    )
    render(createElement(EmployeeList, { canManage: true }))
    await screen.findByRole('alert')
    if (status === 401) expect(screen.getByRole('link', { name: 'ورود دوباره' })).toBeTruthy()
    else {
      failed = false
      fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
      await screen.findByText('کارمندی در این صفحه موجود نیست')
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
    expect(screen.queryByRole('link', { name: 'کارمند جدید' })).toBeNull()
    const menu = await openMenu('کارمند')
    expect(within(menu).getByRole('menuitem', { name: 'مشاهده' })).toBeTruthy()
    expect(within(menu).queryByRole('menuitem', { name: 'ویرایش' })).toBeNull()
    expect(within(menu).queryByRole('menuitem', { name: 'حذف کارمند' })).toBeNull()
  })

  it('deletes an employee by deactivating with the current snapshot after confirmation', async () => {
    const request = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? json({ doc: { ...staff[0], isActive: false, updatedAt: '2026-11-01T11:00:00.000Z' } })
        : json({ docs: staff, hasNextPage: false }),
    )
    vi.stubGlobal('fetch', request)
    render(createElement(EmployeeList, { canManage: true }))
    await screen.findByText('مهندس آرش حسینی')
    const menu = await openMenu('مهندس آرش حسینی')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'حذف کارمند' }))
    const dialog = await screen.findByRole('dialog', { name: 'حذف کارمند' })
    expect(request.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
    fireEvent.click(within(dialog).getByRole('button', { name: 'حذف کارمند' }))
    await screen.findByText('«مهندس آرش حسینی» از کارکنان فعال حذف شد.')
    const [url, init] = request.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(url).toBe('/api/users/personnel/1')
    expect(JSON.parse(init!.body as string)).toEqual({
      expectedUpdatedAt: staff[0].updatedAt,
      isActive: false,
    })
    expect(screen.getByText('غیرفعال')).toBeTruthy()
  })

  it('keeps the confirmation open and explains a stale deactivation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'PATCH'
          ? json({ error: 'stale_personnel' }, 409)
          : json({ docs: staff, hasNextPage: false }),
      ),
    )
    render(createElement(EmployeeList, { canManage: true }))
    await screen.findByText('مهندس آرش حسینی')
    const menu = await openMenu('مهندس آرش حسینی')
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'حذف کارمند' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'حذف کارمند' }))
    expect((await within(dialog).findByRole('alert')).textContent).toContain('اطلاعات تغییر کرده')
    expect(within(dialog).getByRole('button', { name: 'دریافت دوباره فهرست' })).toBeTruthy()
  })

  it('announces a save that returned from the employee form', async () => {
    navigation.search = new URLSearchParams('saved=created')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ docs: staff, hasNextPage: false })),
    )
    render(createElement(EmployeeList, { canManage: true }))
    // The saved result is a toast (FE43), rendered after mount.
    expect(await screen.findByText('کارمند جدید ثبت شد.')).toBeTruthy()
  })
})

function fillEmployee() {
  for (const [label, value] of [
    ['نام و نام خانوادگی', 'کارفرمای نمونه'],
    ['شماره تلفن همراه', '09120000123'],
    ['رمز عبور', 'synthetic-password'],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
  fireEvent.change(screen.getByLabelText('نقش در سیستم'), {
    target: { value: 'employer-reviewer' },
  })
}

describe('employee form', () => {
  it('locks a pending save, keeps values after a field rejection, normalizes digits and retries', async () => {
    let finish!: (value: Response) => void
    let writes = 0
    const request = vi.fn(async (_url: string, _init?: RequestInit) => {
      writes++
      return writes === 1
        ? new Promise<Response>((resolve) => {
            finish = resolve
          })
        : json({ doc: { id: 31, operationalRole: 'employer-reviewer', isActive: true } }, 201)
    })
    vi.stubGlobal('fetch', request)
    render(createElement(EmployeeForm, { mode: 'create' }))
    fillEmployee()
    fireEvent.change(screen.getByLabelText('شماره تلفن همراه'), {
      target: { value: '۰۹۱۲۰۰۰۰۱۲۳' },
    })
    fireEvent.change(screen.getByLabelText('سن'), { target: { value: '۳۲' } })
    const form = screen.getByRole('form', { name: 'اطلاعات کارمند' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(writes).toBe(1))
    expect(
      (screen.getByRole('button', { name: 'در حال ثبت...' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    finish(json({ errors: [{ data: { errors: [{ path: 'phone' }] } }] }, 400))
    await screen.findByText('این مقدار معتبر یا یکتا نیست.')
    expect((screen.getByLabelText('نام و نام خانوادگی') as HTMLInputElement).value).toBe(
      'کارفرمای نمونه',
    )
    fireEvent.click(screen.getByRole('button', { name: 'ثبت اطلاعات' }))
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith('/dashboard/employees?saved=created'),
    )
    expect(writes).toBe(2)
    const [url, init] = request.mock.calls[1]
    expect(url).toBe('/api/users')
    expect(init?.credentials).toBe('same-origin')
    expect(JSON.parse(init!.body as string)).toEqual({
      name: 'کارفرمای نمونه',
      phone: '09120000123',
      username: '09120000123',
      password: 'synthetic-password',
      operationalRole: 'employer-reviewer',
      isActive: true,
      age: 32,
    })
  })

  it('requires the Figma account basics before any request', async () => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    render(createElement(EmployeeForm, { mode: 'create' }))
    fireEvent.click(screen.getByRole('button', { name: 'ثبت اطلاعات' }))
    await screen.findByText('نام و نام خانوادگی را وارد کنید.')
    expect(screen.getByText('شماره تلفن همراه را وارد کنید.')).toBeTruthy()
    expect(screen.getByText('نقش در سیستم را انتخاب کنید.')).toBeTruthy()
    expect(screen.getByText('رمز عبور حداقل ۳ نویسه است.')).toBeTruthy()
    expect(request).not.toHaveBeenCalled()
  })

  it('uploads resumes privately, saves profile fields and discards uploads when the save fails', async () => {
    let failSave = true
    const request = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === '/api/personnel-files') return json({ doc: { id: 7 } }, 201)
      if (url.startsWith('/api/personnel-files/')) return json({ id: 7 })
      return failSave
        ? json({ errors: [{ message: 'failed' }] }, 500)
        : json({ doc: { id: 31, operationalRole: 'reviewer', isActive: true } }, 201)
    })
    vi.stubGlobal('fetch', request)
    render(createElement(EmployeeForm, { mode: 'create' }))
    fillEmployee()
    fireEvent.change(screen.getByLabelText('نقش در سیستم'), { target: { value: 'reviewer' } })
    fireEvent.change(screen.getByLabelText('جنسیت'), { target: { value: 'female' } })
    fireEvent.change(screen.getByLabelText('مدرک دانشگاهی'), { target: { value: 'دکتری' } })
    fireEvent.change(screen.getByLabelText('زمینه فعالیت'), { target: { value: 'انرژی' } })
    fireEvent.change(screen.getByLabelText('فایل رزومه'), {
      target: {
        files: [
          new File(['%PDF'], 'resume.pdf', { type: 'application/pdf' }),
          new File(['x'], 'photo.png', { type: 'image/png' }),
        ],
      },
    })
    expect(screen.getByText('resume.pdf')).toBeTruthy()
    expect(screen.getByText('فقط فایل‌های PDF و Word پذیرفته می‌شوند.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'آدرس جدید' }))
    fireEvent.change(screen.getByLabelText('آدرس ۱'), { target: { value: 'بوشهر، خیابان ساحلی' } })

    fireEvent.click(screen.getByRole('button', { name: 'ثبت اطلاعات' }))
    await screen.findByText('ذخیره یا دریافت اطلاعات انجام نشد. دوباره تلاش کنید.')
    await waitFor(() =>
      expect(
        request.mock.calls.some(
          ([url, init]) => url === '/api/personnel-files/7' && init?.method === 'DELETE',
        ),
      ).toBe(true),
    )
    const upload = request.mock.calls.find(([url]) => url === '/api/personnel-files')!
    expect((upload[1]!.body as FormData).get('file')).toBeInstanceOf(File)

    failSave = false
    fireEvent.click(screen.getByRole('button', { name: 'ثبت اطلاعات' }))
    await waitFor(() => expect(navigation.push).toHaveBeenCalled())
    const save = request.mock.calls.filter(([url]) => url === '/api/users').at(-1)!
    expect(JSON.parse(save[1]!.body as string)).toMatchObject({
      operationalRole: 'reviewer',
      gender: 'female',
      degree: 'دکتری',
      activityField: 'انرژی',
      resume: [7],
      personnelAddresses: [{ address: 'بوشهر، خیابان ساحلی' }],
    })
  })

  it('reloads a changed employee only on explicit review and never overwrites stale edits', async () => {
    const original = {
      id: 31,
      name: 'نسخه قدیم',
      phone: '09120000123',
      email: null,
      operationalRole: 'reviewer',
      isActive: true,
      degree: 'کارشناسی',
      resume: [{ id: 4, filename: 'old.pdf', url: '/api/personnel-files/file/old.pdf' }],
      personnelAddresses: [],
      updatedAt: '2026-10-27T10:00:00.000Z',
    }
    let latest = original
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH')
        return JSON.parse(init.body as string).expectedUpdatedAt === latest.updatedAt
          ? json({ doc: { ...latest, operationalRole: 'chief-reviewer' } })
          : json({ error: 'stale_personnel' }, 409)
      return json(latest)
    })
    vi.stubGlobal('fetch', request)
    render(createElement(EmployeeForm, { mode: 'edit', id: '31' }))
    await waitFor(() =>
      expect((screen.getByLabelText('نام و نام خانوادگی') as HTMLInputElement).value).toBe(
        'نسخه قدیم',
      ),
    )
    expect(screen.getByRole('link', { name: 'old.pdf' })).toBeTruthy()
    latest = { ...original, name: 'نسخه جدید', updatedAt: '2026-10-27T11:00:00.000Z' }
    fireEvent.change(screen.getByLabelText('نقش در سیستم'), { target: { value: 'chief-reviewer' } })
    fireEvent.click(screen.getByRole('button', { name: 'ثبت اطلاعات' }))
    expect((await screen.findByRole('alert')).textContent).toContain('اطلاعات تغییر کرده')
    expect((screen.getByLabelText('نام و نام خانوادگی') as HTMLInputElement).value).toBe(
      'نسخه قدیم',
    )
    fireEvent.click(screen.getByRole('button', { name: 'بررسی نسخه جدید' }))
    await waitFor(() =>
      expect((screen.getByLabelText('نام و نام خانوادگی') as HTMLInputElement).value).toBe(
        'نسخه جدید',
      ),
    )
    fireEvent.change(screen.getByLabelText('نقش در سیستم'), { target: { value: 'chief-reviewer' } })
    fireEvent.click(screen.getByRole('button', { name: 'ثبت اطلاعات' }))
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith('/dashboard/employees?saved=updated'),
    )
    const writes = request.mock.calls.filter(([, init]) => init?.method === 'PATCH')
    expect(writes.map(([url]) => url)).toEqual([
      '/api/users/personnel/31',
      '/api/users/personnel/31',
    ])
    const body = JSON.parse(writes[1][1]!.body as string)
    expect(body).toMatchObject({
      expectedUpdatedAt: latest.updatedAt,
      operationalRole: 'chief-reviewer',
      email: null,
      resume: [4],
    })
    expect(body).not.toHaveProperty('username')
    expect(body).not.toHaveProperty('password')
    expect(body).not.toHaveProperty('isActive')
  })

  it('shows a read-only employee with edit only for the owner', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          ...staff[0],
          phone: '09120000123',
          gender: 'male',
          age: 40,
          personnelAddresses: [],
        }),
      ),
    )
    const view = render(createElement(EmployeeForm, { mode: 'view', id: '1', canManage: true }))
    await screen.findByRole('heading', { name: 'مهندس آرش حسینی' })
    expect((screen.getByLabelText('جنسیت') as HTMLInputElement).value).toBe('مرد')
    expect((screen.getByLabelText('سن') as HTMLInputElement).readOnly).toBe(true)
    expect(screen.getByRole('link', { name: 'ویرایش' }).getAttribute('href')).toBe(
      '/dashboard/employees/1/edit',
    )
    view.unmount()
    render(createElement(EmployeeForm, { mode: 'view', id: '1' }))
    await screen.findByRole('heading', { name: 'مهندس آرش حسینی' })
    expect(screen.queryByRole('link', { name: 'ویرایش' })).toBeNull()
    expect(screen.queryByLabelText('فایل رزومه')).toBeNull()
  })
})
