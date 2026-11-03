// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OwnerEventSubtopics } from '@/components/dashboard/owner-events'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard/events',
  useSearchParams: () => new URLSearchParams(),
}))

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

const people = [
  { id: 'chief-1', name: 'سردبیر مسئول', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'inv-1', name: 'مسئول سرمایه‌گذاری', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'emp-1', name: 'مهندس رضایی', phone: '09121112233', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'emp-2', name: 'دکتر محمدی', phone: '09123334455', operationalRole: 'employer-reviewer', isActive: true },
  { id: 'emp-inactive', name: 'کارفرمای غیرفعال', phone: '09129998877', operationalRole: 'employer-reviewer', isActive: false },
  { id: 'rep-1', name: 'نماینده شرکت', operationalRole: 'representative', isActive: true },
]

const event1 = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'نمایشگاه نفت و گاز',
  description: 'شرح رویداد نفت و گاز',
  registrationOpenAt: '2026-10-01T10:00:00.000Z',
  registrationCloseAt: '2026-10-30T10:00:00.000Z',
  responsibleChiefId: 'chief-1',
  responsibleInvestmentId: 'inv-1',
  revision: 1,
}

const cat1 = {
  id: '11111111-1111-1111-1111-111111111111',
  eventId: event1.id,
  title: 'برق و ابزار دقیق',
}

const sub1 = {
  id: '22222222-2222-2222-2222-222222222222',
  eventId: event1.id,
  categoryId: cat1.id,
  categoryTitle: cat1.title,
  title: 'طراحی سیستم‌های پایش آنلاین',
  employerId: 'emp-1',
  currentRfpVersionId: '33333333-3333-3333-3333-333333333333',
}

const rfpVersion1 = {
  id: '33333333-3333-3333-3333-333333333333',
  subtopicId: sub1.id,
  createdBy: 'user-admin',
  createdAt: '2026-10-15T08:00:00.000Z',
  reason: 'انتشار نسخه اولیه مستندات فنی',
  files: [
    {
      id: '44444444-4444-4444-4444-444444444444',
      filename: 'rfp-specifications-v1.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 204800,
    },
  ],
}

describe('owner category and subtopic administration', () => {
  it('navigates to category/subtopic management and creates a category under the event', async () => {
    let categoriesList = [cat1]
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/users?')) return json({ docs: people, hasNextPage: false })
      if (url === `/api/dashboard/admin/events/${event1.id}`) return json({ event: event1 })
      if (url === `/api/dashboard/admin/events/${event1.id}/categories` && init?.method === 'POST') {
        const body = JSON.parse(init.body as string)
        if (body.title === 'تکراری') {
          return json({ error: 'invalid_category' }, 400)
        }
        const created = { id: 'cat-new-id', eventId: event1.id, title: body.title }
        categoriesList = [...categoriesList, created]
        return json({ category: created }, 201)
      }
      if (url === `/api/dashboard/admin/events/${event1.id}/categories`) {
        return json({ items: categoriesList })
      }
      if (url === `/api/dashboard/admin/events/${event1.id}/subtopics`) {
        return json({ items: [sub1] })
      }
      return json({}, 404)
    })
    vi.stubGlobal('fetch', request)

    render(createElement(OwnerEventSubtopics, { eventId: event1.id }))

    // Verify view header and existing category
    await screen.findByText(`عناوین، زیرعنوان‌ها و RFP رویداد: ${event1.title}`)
    expect(await screen.findByText('برق و ابزار دقیق')).toBeTruthy()
    expect(screen.getByText('طراحی سیستم‌های پایش آنلاین')).toBeTruthy()

    // Open add category form
    fireEvent.click(screen.getByRole('button', { name: 'دسته جدید' }))
    const catInput = screen.getByLabelText('عنوان دسته فناوری')

    // Test validation and server error mapping without losing typed value
    fireEvent.change(catInput, { target: { value: 'تکراری' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره دسته' }))
    await screen.findByText('عنوان دسته نامعتبر است یا سرور آن را نپذیرفت.')
    expect((screen.getByLabelText('عنوان دسته فناوری') as HTMLInputElement).value).toBe('تکراری')

    // Submit valid title
    fireEvent.change(catInput, { target: { value: 'مکانیک و تجهیزات دوار' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره دسته' }))
    await screen.findByText('دسته با موفقیت ایجاد شد.')
    await screen.findByText('مکانیک و تجهیزات دوار')
  })

  it('creates subtopic with eligible employer person', async () => {
    let subtopicsList: Array<{
      id: string
      eventId: string
      categoryId: string
      categoryTitle?: string
      title: string
      employerId: string
      currentRfpVersionId: string | null
    }> = [sub1]
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/users?')) return json({ docs: people, hasNextPage: false })
      if (url === `/api/dashboard/admin/events/${event1.id}`) return json({ event: event1 })
      if (url === `/api/dashboard/admin/events/${event1.id}/categories`) return json({ items: [cat1] })
      if (url === `/api/dashboard/admin/events/${event1.id}/subtopics` && init?.method === 'POST') {
        const body = JSON.parse(init.body as string)
        if (body.employerId === 'emp-invalid') {
          return json({ error: 'ineligible_employer' }, 400)
        }
        if (body.categoryId === 'cat-wrong-event') {
          return json({ error: 'invalid_category_event' }, 400)
        }
        const created = {
          id: 'sub-new-id',
          eventId: event1.id,
          categoryId: body.categoryId,
          categoryTitle: cat1.title,
          title: body.title,
          employerId: body.employerId,
          currentRfpVersionId: null,
        }
        subtopicsList = [...subtopicsList, created]
        return json({ subtopic: created }, 201)
      }
      if (url === `/api/dashboard/admin/events/${event1.id}/subtopics`) {
        return json({ items: subtopicsList })
      }
      return json({}, 404)
    })
    vi.stubGlobal('fetch', request)

    render(createElement(OwnerEventSubtopics, { eventId: event1.id }))
    await screen.findByText(`عناوین، زیرعنوان‌ها و RFP رویداد: ${event1.title}`)

    // Click new subtopic
    fireEvent.click(screen.getByRole('button', { name: 'زیرعنوان جدید' }))

    // Verify category select only contains categories for this event
    const categorySelect = screen.getByLabelText('دسته فناوری') as HTMLSelectElement
    expect(categorySelect.options).toHaveLength(2) // "انتخاب دسته" + "برق و ابزار دقیق"

    // Verify employer select only lists active employer-reviewer persons
    const employerSelect = screen.getByLabelText('کارفرمای مسئول') as HTMLSelectElement
    expect(employerSelect.multiple).toBe(false)
    expect(screen.queryByRole('option', { name: /سردبیر مسئول/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /نماینده شرکت/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /کارفرمای غیرفعال/ })).toBeNull()
    expect(screen.getByRole('option', { name: /مهندس رضایی/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /دکتر محمدی/ })).toBeTruthy()

    // Fill valid form
    fireEvent.change(categorySelect, { target: { value: cat1.id } })
    fireEvent.change(screen.getByLabelText('عنوان زیرعنوان'), { target: { value: 'ساخت سنسورهای حرارتی' } })
    fireEvent.change(employerSelect, { target: { value: 'emp-2' } })

    fireEvent.click(screen.getByRole('button', { name: 'ذخیره زیرعنوان' }))
    await screen.findByText('زیرعنوان با موفقیت ایجاد شد.')
    await screen.findByText('ساخت سنسورهای حرارتی')
    expect(screen.getByText(/دکتر محمدی/)).toBeTruthy()
  })

  it('shows warning when no active employer reviewer exists', async () => {
    const noEmployerPeople = people.filter((p) => p.operationalRole !== 'employer-reviewer')
    const request = vi.fn(async (url: string) => {
      if (url.startsWith('/api/users?')) return json({ docs: noEmployerPeople, hasNextPage: false })
      if (url === `/api/dashboard/admin/events/${event1.id}`) return json({ event: event1 })
      if (url === `/api/dashboard/admin/events/${event1.id}/categories`) return json({ items: [cat1] })
      if (url === `/api/dashboard/admin/events/${event1.id}/subtopics`) return json({ items: [] })
      return json({}, 404)
    })
    vi.stubGlobal('fetch', request)

    render(createElement(OwnerEventSubtopics, { eventId: event1.id }))
    await screen.findByText('برق و ابزار دقیق')
    fireEvent.click(await screen.findByRole('button', { name: 'زیرعنوان جدید' }))
    expect(
      await screen.findByText('شخص کارفرمای واجد شرایط وجود ندارد؛ ابتدا در بخش پرسنل حساب فعال با نقش کارفرما بسازید.'),
    ).toBeTruthy()
  })
})

describe('owner RFP administration', () => {
  it('displays active RFP version, files and download links', async () => {
    const request = vi.fn(async (url: string) => {
      if (url.startsWith('/api/users?')) return json({ docs: people, hasNextPage: false })
      if (url === `/api/dashboard/admin/events/${event1.id}`) return json({ event: event1 })
      if (url === `/api/dashboard/admin/events/${event1.id}/categories`) return json({ items: [cat1] })
      if (url === `/api/dashboard/admin/events/${event1.id}/subtopics`) return json({ items: [sub1] })
      if (url === `/api/dashboard/events/${event1.id}/subtopics/${sub1.id}/rfp`) {
        return json({ version: rfpVersion1 })
      }
      return json({}, 404)
    })
    vi.stubGlobal('fetch', request)

    render(createElement(OwnerEventSubtopics, { eventId: event1.id }))

    // Click manage RFP on sub1
    fireEvent.click(await screen.findByRole('button', { name: `مدیریت فایل RFP ${sub1.title}` }))

    // Verify active RFP details and download link
    await screen.findByText(/انتشار نسخه اولیه مستندات فنی/)
    expect(screen.getByText('rfp-specifications-v1.pdf')).toBeTruthy()
    const downloadLink = screen.getByRole('link', { name: /دانلود/ })
    expect(downloadLink.getAttribute('href')).toBe(
      `/api/dashboard/events/${event1.id}/subtopics/${sub1.id}/rfp/${rfpVersion1.id}/files/${rfpVersion1.files[0]!.id}`,
    )

    // Verify warning banner regarding backend versioning rules
    expect(
      screen.getByText(/تغییرات و نسخه‌های جدید RFP طبق قوانین نگارش سرور اعمال می‌شوند و پرونده‌های ارسال‌شده قبلی شرکت‌ها را بازنویسی نمی‌کنند/),
    ).toBeTruthy()
  })

  it('uploads new RFP version with files and reason, handles 409 stale_rfp conflict without losing inputs', async () => {
    let currentVersion = rfpVersion1
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/users?')) return json({ docs: people, hasNextPage: false })
      if (url === `/api/dashboard/admin/events/${event1.id}`) return json({ event: event1 })
      if (url === `/api/dashboard/admin/events/${event1.id}/categories`) return json({ items: [cat1] })
      if (url === `/api/dashboard/admin/events/${event1.id}/subtopics`) {
        return json({ items: [{ ...sub1, currentRfpVersionId: currentVersion.id }] })
      }
      if (url === `/api/dashboard/events/${event1.id}/subtopics/${sub1.id}/rfp`) {
        return json({ version: currentVersion })
      }
      if (url === `/api/dashboard/admin/events/${event1.id}/subtopics/${sub1.id}/rfp` && init?.method === 'POST') {
        const formData = init.body as FormData
        const expected = formData.get('expectedVersionId')
        if (expected !== currentVersion.id) {
          return json({ error: 'stale_rfp' }, 409)
        }
        const updated = {
          id: 'version-v2-id',
          subtopicId: sub1.id,
          createdBy: 'user-admin',
          createdAt: '2026-10-20T10:00:00.000Z',
          reason: formData.get('reason') as string,
          files: [
            {
              id: 'file-v2-id',
              filename: 'rfp-updated-v2.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 300000,
            },
          ],
        }
        currentVersion = updated
        return json({ version: updated }, 201)
      }
      return json({}, 404)
    })
    vi.stubGlobal('fetch', request)

    render(createElement(OwnerEventSubtopics, { eventId: event1.id }))
    fireEvent.click(await screen.findByRole('button', { name: `مدیریت فایل RFP ${sub1.title}` }))

    await screen.findByText(/انتشار نسخه اولیه مستندات فنی/)

    // Fill new version form
    const reasonInput = screen.getByLabelText('توضیحات و دلیل نسخه جدید')
    fireEvent.change(reasonInput, { target: { value: 'اصلاح بندهای فنی و شاخص‌های کیفی' } })

    const fakeFile = new File(['%PDF-fake-content'], 'rfp-updated-v2.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByLabelText('انتخاب فایل‌های RFP')
    fireEvent.change(fileInput, { target: { files: [fakeFile] } })

    // Simulate another admin bumping the version concurrently
    currentVersion = {
      ...rfpVersion1,
      id: 'version-concurrent-bump',
      reason: 'ویرایش همزمان توسط ادمین دیگر',
    }

    // Submit form -> should encounter 409 stale_rfp
    fireEvent.click(screen.getByRole('button', { name: 'بارگذاری نسخه جدید RFP' }))
    await screen.findByText(/نسخه RFP توسط شخص دیگری تغییر یافته است/)

    // Verify input is preserved
    expect((screen.getByLabelText('توضیحات و دلیل نسخه جدید') as HTMLInputElement).value).toBe(
      'اصلاح بندهای فنی و شاخص‌های کیفی',
    )

    // Click refresh latest version
    fireEvent.click(screen.getByRole('button', { name: 'بررسی نسخه جدید سرور' }))
    await screen.findByText(/ویرایش همزمان توسط ادمین دیگر/)

    // Re-submit with updated expectedVersionId
    fireEvent.change(fileInput, { target: { files: [fakeFile] } })
    fireEvent.click(screen.getByRole('button', { name: 'بارگذاری نسخه جدید RFP' }))

    await screen.findByText('نسخه جدید RFP با موفقیت بارگذاری شد.')
    await screen.findByText('rfp-updated-v2.pdf')
  })
})

describe('owner administration failure and isolation behavior', () => {
  const sub2 = { ...sub1, id: '55555555-5555-5555-5555-555555555555', title: 'زیرعنوان دوم', currentRfpVersionId: null }

  function stubBackend(overrides: (url: string, init?: RequestInit) => Response | undefined) {
    const request = vi.fn(async (url: string, init?: RequestInit) => {
      const overridden = overrides(url, init)
      if (overridden) return overridden
      if (url.startsWith('/api/users?')) return json({ docs: people, hasNextPage: false })
      if (url === `/api/dashboard/admin/events/${event1.id}`) return json({ event: event1 })
      if (url === `/api/dashboard/admin/events/${event1.id}/categories`) return json({ items: [cat1] })
      if (url === `/api/dashboard/admin/events/${event1.id}/subtopics`) return json({ items: [sub1, sub2] })
      if (url === `/api/dashboard/events/${event1.id}/subtopics/${sub1.id}/rfp`) return json({ version: rfpVersion1 })
      return json({ error: 'not_found' }, 404)
    })
    vi.stubGlobal('fetch', request)
    return request
  }

  async function openManager() {
    render(createElement(OwnerEventSubtopics, { eventId: event1.id }))
  }

  const pdf = (name = 'rfp.pdf', size = 10) => {
    const file = new File(['x'], name, { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: size })
    return file
  }

  async function fillUpload(files: File[]) {
    await screen.findByText(/انتشار نسخه اولیه مستندات فنی/)
    fireEvent.change(screen.getByLabelText('توضیحات و دلیل نسخه جدید'), { target: { value: 'دلیل' } })
    fireEvent.change(screen.getByLabelText('انتخاب فایل‌های RFP'), { target: { files } })
    fireEvent.click(screen.getByRole('button', { name: 'بارگذاری نسخه جدید RFP' }))
  }

  it('does not carry RFP form state across subtopics', async () => {
    stubBackend(() => undefined)
    await openManager()
    fireEvent.click(await screen.findByRole('button', { name: `مدیریت فایل RFP ${sub1.title}` }))
    await screen.findByText(/انتشار نسخه اولیه مستندات فنی/)
    fireEvent.change(screen.getByLabelText('توضیحات و دلیل نسخه جدید'), { target: { value: 'دلیل زیرعنوان اول' } })

    fireEvent.click(screen.getByRole('button', { name: `مدیریت فایل RFP ${sub2.title}` }))
    await screen.findByText('هنوز نسخه‌ای از فایل RFP برای این زیرعنوان ثبت نشده است.')
    expect((screen.getByLabelText('توضیحات و دلیل نسخه جدید') as HTMLInputElement).value).toBe('')
  })

  it('clears the file input after a successful upload', async () => {
    stubBackend((url, init) =>
      url === `/api/dashboard/admin/events/${event1.id}/subtopics/${sub1.id}/rfp` && init?.method === 'POST'
        ? json({ version: { ...rfpVersion1, id: 'version-v2-id' } }, 201)
        : undefined,
    )
    await openManager()
    fireEvent.click(await screen.findByRole('button', { name: `مدیریت فایل RFP ${sub1.title}` }))
    await screen.findByText(/انتشار نسخه اولیه مستندات فنی/)
    const input = screen.getByLabelText('انتخاب فایل‌های RFP')
    await fillUpload([pdf()])
    await screen.findByText('نسخه جدید RFP با موفقیت بارگذاری شد.')
    expect(screen.getByLabelText('انتخاب فایل‌های RFP')).not.toBe(input)
  })

  it('does not show the empty state or allow new subtopics when loading fails', async () => {
    stubBackend((url) =>
      url === `/api/dashboard/admin/events/${event1.id}/categories` ? json({ error: 'boom' }, 500) : undefined,
    )
    await openManager()
    await screen.findByRole('button', { name: 'تلاش دوباره' })
    expect(screen.queryByText('هنوز دسته‌ای برای این رویداد تعریف نشده است.')).toBeNull()
    expect((screen.getByRole('button', { name: 'زیرعنوان جدید' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('blocks upload when the current version could not be loaded', async () => {
    stubBackend((url) =>
      url === `/api/dashboard/events/${event1.id}/subtopics/${sub1.id}/rfp` ? json({ error: 'boom' }, 500) : undefined,
    )
    await openManager()
    fireEvent.click(await screen.findByRole('button', { name: `مدیریت فایل RFP ${sub1.title}` }))
    await screen.findByRole('button', { name: 'تلاش دوباره' })
    expect((screen.getByRole('button', { name: 'بارگذاری نسخه جدید RFP' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the backend file rejection and keeps the reason', async () => {
    stubBackend((url, init) =>
      url === `/api/dashboard/admin/events/${event1.id}/subtopics/${sub1.id}/rfp` && init?.method === 'POST'
        ? json({ error: 'invalid_file_content' }, 400)
        : undefined,
    )
    await openManager()
    fireEvent.click(await screen.findByRole('button', { name: `مدیریت فایل RFP ${sub1.title}` }))
    await fillUpload([pdf()])
    await screen.findByText('محتوای فایل با فرمت آن مطابقت ندارد.')
    expect((screen.getByLabelText('توضیحات و دلیل نسخه جدید') as HTMLInputElement).value).toBe('دلیل')
  })

  it('offers sign-in again when an upload hits an expired session', async () => {
    stubBackend((url, init) =>
      url === `/api/dashboard/admin/events/${event1.id}/subtopics/${sub1.id}/rfp` && init?.method === 'POST'
        ? json({ error: 'unauthorized' }, 401)
        : undefined,
    )
    await openManager()
    fireEvent.click(await screen.findByRole('button', { name: `مدیریت فایل RFP ${sub1.title}` }))
    await fillUpload([pdf()])
    await screen.findByRole('link', { name: 'ورود دوباره' })
  })

  it('rejects an upload larger than the proxy can forward without calling the server', async () => {
    const request = stubBackend(() => undefined)
    await openManager()
    fireEvent.click(await screen.findByRole('button', { name: `مدیریت فایل RFP ${sub1.title}` }))
    await fillUpload([pdf('a.pdf', 6_000_000), pdf('b.pdf', 6_000_000)])
    await screen.findByText('مجموع حجم فایل‌های یک نسخه نباید از ۱۰ مگابایت بیشتر باشد.')
    expect(request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('does not blame the category title for a permission failure', async () => {
    stubBackend((url, init) =>
      url === `/api/dashboard/admin/events/${event1.id}/categories` && init?.method === 'POST'
        ? json({ error: 'forbidden' }, 403)
        : undefined,
    )
    await openManager()
    await screen.findByText(cat1.title)
    fireEvent.click(screen.getByRole('button', { name: 'دسته جدید' }))
    fireEvent.change(screen.getByLabelText('عنوان دسته فناوری'), { target: { value: 'دسته تازه' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره دسته' }))
    await screen.findByText('اجازه مدیریت این بخش را ندارید.')
    expect(screen.queryByText('عنوان دسته نامعتبر است یا سرور آن را نپذیرفت.')).toBeNull()
  })

  it('maps employer and category rejections to their fields without losing edits', async () => {
    let error = 'ineligible_employer'
    stubBackend((url, init) =>
      url === `/api/dashboard/admin/events/${event1.id}/subtopics` && init?.method === 'POST'
        ? json({ error }, 400)
        : undefined,
    )
    await openManager()
    await screen.findByText(cat1.title)
    fireEvent.click(screen.getByRole('button', { name: 'زیرعنوان جدید' }))
    fireEvent.change(screen.getByLabelText('عنوان زیرعنوان'), { target: { value: 'عنوان حفظ‌شده' } })
    fireEvent.change(screen.getByLabelText('کارفرمای مسئول'), { target: { value: 'emp-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره زیرعنوان' }))
    await screen.findByText('کارفرمای انتخاب‌شده نامعتبر یا دارای شرکت است.')
    expect((screen.getByLabelText('عنوان زیرعنوان') as HTMLInputElement).value).toBe('عنوان حفظ‌شده')

    error = 'invalid_category_event'
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره زیرعنوان' }))
    await screen.findByText('دسته انتخاب‌شده متعلق به این رویداد نیست.')
    expect((screen.getByLabelText('عنوان زیرعنوان') as HTMLInputElement).value).toBe('عنوان حفظ‌شده')
  })
})
