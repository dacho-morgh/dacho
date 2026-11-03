// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExhibitionForm } from '@/components/dashboard/exhibition-admin/exhibition-form'
import { OwnerEventForm } from '@/components/dashboard/owner-events-form'
import { OwnerEventsList } from '@/components/dashboard/owner-events-list'

const push = vi.fn()
let search = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/dashboard/events',
  useSearchParams: () => search,
}))
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  search = new URLSearchParams()
})

const people = [
  { id: 'chief', name: 'سردبیر فعال', operationalRole: 'chief-reviewer', isActive: true },
  { id: 'investment', name: 'سرمایه‌گذار فعال', operationalRole: 'investment-reviewer', isActive: true },
  { id: 'inactive', name: 'سردبیر غیرفعال', operationalRole: 'chief-reviewer', isActive: false },
  { id: 'employer', name: 'کارفرما', operationalRole: 'employer-reviewer', isActive: true },
]
const page1 = {
  id: '11',
  title: 'رویداد اول',
  description: 'شرح اول',
  location: 'بوشهر',
  startDate: '2026-12-01T08:00:00.000Z',
  endDate: '2026-12-02T16:00:00.000Z',
  status: 'upcoming',
}
const event1 = {
  id: 'e1',
  title: 'رویداد اول',
  description: 'شرح اول',
  registrationOpenAt: '2026-10-01T10:00:00.000Z',
  registrationCloseAt: '2026-10-02T10:00:00.000Z',
  responsibleChiefId: 'chief',
  responsibleInvestmentId: 'investment',
  publicEventId: '11',
  public: page1,
  revision: 2,
}
const exhibition1 = {
  id: '21',
  title: 'نمایشگاه نفت',
  description: '',
  location: 'عسلویه',
  startDate: '2027-01-10T06:00:00.000Z',
  endDate: '2027-01-12T14:00:00.000Z',
  status: 'upcoming',
  companyBoothLimit: 2,
  guideMapReference: null,
  revision: 1,
  boothCount: 4,
}

const lastWrite = (request: ReturnType<typeof vi.fn>, method: string) => {
  const call = request.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === method).at(-1)
  return call ? { url: call[0] as string, body: JSON.parse((call[1] as RequestInit).body as string) } : undefined
}

describe('owner events and exhibitions list (FE40)', () => {
  const listFetch = (overrides: Record<string, () => Response> = {}) =>
    vi.fn(async (url: string) => {
      for (const [prefix, respond] of Object.entries(overrides)) if (url.startsWith(prefix)) return respond()
      if (url.startsWith('/api/users?')) return json({ docs: people, hasNextPage: false })
      if (url === '/api/dashboard/admin/events')
        return json({
          items: [event1],
          unlinkedPublicEvents: [{ ...page1, id: '12', title: 'رویداد منتشرشده در CMS' }],
        })
      if (url === '/api/dashboard/admin/exhibitions') return json({ items: [exhibition1] })
      return json({}, 404)
    })

  it('lists events and exhibitions together, each opening its own tools', async () => {
    vi.stubGlobal('fetch', listFetch())
    render(createElement(OwnerEventsList))
    const eventRow = (await screen.findByRole('link', { name: 'رویداد اول' })).closest('tr')!
    expect(within(eventRow).getByText('رویداد')).toBeTruthy()
    expect(within(eventRow).getByText('ثبت‌نام بسته')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'رویداد اول' }).getAttribute('href')).toBe('/dashboard/events/e1/edit')

    const exhibitionRow = screen.getByRole('link', { name: 'نمایشگاه نفت' }).closest('tr')!
    expect(within(exhibitionRow).getByText('نمایشگاه')).toBeTruthy()
    expect(within(exhibitionRow).getByText('۴ غرفه')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'نمایشگاه نفت' }).getAttribute('href')).toBe('/dashboard/exhibitions/21/edit')

    // A public event made in the CMS is offered to be completed, not edited in the CMS.
    expect(screen.getByRole('link', { name: 'رویداد منتشرشده در CMS' }).getAttribute('href')).toBe(
      '/dashboard/events/new?type=event&publicEventId=12',
    )
    expect(document.querySelector('a[href^="/admin/"]')).toBeNull()
  })

  it('opens on the type in the URL, so the old exhibitions address lands on exhibitions', async () => {
    search = new URLSearchParams('type=exhibition')
    vi.stubGlobal('fetch', listFetch())
    render(createElement(OwnerEventsList))
    await screen.findByRole('link', { name: 'نمایشگاه نفت' })
    expect(screen.queryByRole('link', { name: 'رویداد اول' })).toBeNull()
  })

  it('creates from one button that asks for the type first', async () => {
    vi.stubGlobal('fetch', listFetch())
    render(createElement(OwnerEventsList))
    await screen.findByRole('link', { name: 'رویداد اول' })
    fireEvent.click(screen.getByRole('button', { name: 'رویداد یا نمایشگاه جدید' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('radio', { name: 'نمایشگاه' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'ادامه' }))
    expect(push).toHaveBeenCalledWith('/dashboard/events/new?type=exhibition')
  })

  it('shows the empty state with a create action', async () => {
    vi.stubGlobal('fetch', listFetch({
      '/api/dashboard/admin/events': () => json({ items: [], unlinkedPublicEvents: [] }),
      '/api/dashboard/admin/exhibitions': () => json({ items: [] }),
    }))
    render(createElement(OwnerEventsList))
    expect(await screen.findByText('رویداد یا نمایشگاهی در این صفحه موجود نیست')).toBeTruthy()
  })

  it.each([401, 403, 503])('shows load failure %s without rows, and retries', async (status) => {
    let failed = true
    const ok = listFetch()
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (failed && url.startsWith('/api/dashboard') ? json({}, status) : ok(url))))
    render(createElement(OwnerEventsList))
    await screen.findByRole('alert')
    expect(screen.queryByRole('table')).toBeNull()
    if (status === 401) {
      expect(screen.getByRole('link', { name: 'ورود دوباره' }).getAttribute('href')).toBe('/login?returnUrl=%2Fdashboard%2Fevents')
      return
    }
    failed = false
    fireEvent.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    await screen.findByRole('link', { name: 'رویداد اول' })
  })
})

describe('owner event form (FE41)', () => {
  const formFetch = (handlers: { patch?: (body: Record<string, unknown>) => Response; post?: Response; single?: () => Response } = {}) =>
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/api/users?')) return json({ docs: people, hasNextPage: false })
      if (init?.method === 'PATCH') return handlers.patch?.(JSON.parse(init.body as string)) ?? json({ event: event1 })
      if (init?.method === 'POST') return handlers.post ?? json({ event: event1 }, 201)
      if (url === '/api/dashboard/admin/events/e1') return handlers.single?.() ?? json({ event: event1 })
      if (url === '/api/dashboard/admin/events')
        return json({ items: [], unlinkedPublicEvents: [{ ...page1, id: '12', title: 'منتشرشده' }] })
      return json({}, 404)
    })

  it('saves a valid UTC registration window across the local DST gap', async () => {
    vi.stubEnv('TZ', 'America/New_York')
    expect(new Date('2027-03-14T01:30:00').getTimezoneOffset()).toBe(300)
    const dst = { ...event1, registrationOpenAt: '2027-03-14T02:30:00.000Z', registrationCloseAt: '2027-03-14T03:00:00.000Z' }
    const request = formFetch({ single: () => json({ event: dst }) })
    vi.stubGlobal('fetch', request)
    render(createElement(OwnerEventForm, { mode: 'edit', id: 'e1' }))
    fireEvent.change(await screen.findByLabelText('دلیل تغییر'), { target: { value: 'اصلاح' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/events?saved=event-updated'))
    expect(lastWrite(request, 'PATCH')!.body).toMatchObject({
      registrationOpenAt: dst.registrationOpenAt,
      registrationCloseAt: dst.registrationCloseAt,
    })
  })

  it('edits the public page with the event and keeps unchanged times to the second', async () => {
    const precise = { ...event1, registrationOpenAt: '2026-10-01T10:00:59.000Z', public: { ...page1, startDate: '2026-12-01T08:00:31.000Z' } }
    const request = formFetch({ single: () => json({ event: precise }) })
    vi.stubGlobal('fetch', request)
    render(createElement(OwnerEventForm, { mode: 'edit', id: 'e1' }))
    fireEvent.change(await screen.findByLabelText('محل برگزاری'), { target: { value: 'عسلویه' } })
    fireEvent.change(screen.getByLabelText('دلیل تغییر'), { target: { value: 'تغییر محل' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(lastWrite(request, 'PATCH')).toEqual({
      url: '/api/dashboard/admin/events/e1',
      body: expect.objectContaining({
        title: 'رویداد اول',
        location: 'عسلویه',
        status: 'upcoming',
        startDate: '2026-12-01T08:00:31.000Z',
        registrationOpenAt: '2026-10-01T10:00:59.000Z',
        revision: 2,
        reason: 'تغییر محل',
      }),
    })
  })

  it('checks date order and reason, then on a stale revision keeps the draft until reloaded', async () => {
    const latest = { ...event1, title: 'نسخه جدید اول', revision: 3 }
    let reloaded = false
    const request = formFetch({
      patch: (body) => (body.revision === 2 ? json({ error: 'stale_event', revision: 3 }, 409) : json({ event: latest })),
      single: () => json({ event: reloaded ? latest : event1 }),
    })
    vi.stubGlobal('fetch', request)
    render(createElement(OwnerEventForm, { mode: 'edit', id: 'e1' }))
    fireEvent.change(await screen.findByLabelText('پایان ثبت‌نام (UTC)'), { target: { value: '2026-09-01T10:00' } })
    fireEvent.change(screen.getByLabelText('پایان برگزاری (UTC)'), { target: { value: '2026-11-01T10:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    expect(await screen.findByText('پایان ثبت‌نام باید پس از شروع باشد.')).toBeTruthy()
    expect(screen.getByText('پایان برگزاری باید پس از شروع باشد.')).toBeTruthy()
    expect(screen.getByText('دلیل تغییر را وارد کنید.')).toBeTruthy()
    expect(lastWrite(request, 'PATCH')).toBeUndefined()

    fireEvent.change(screen.getByLabelText('پایان ثبت‌نام (UTC)'), { target: { value: '2026-10-02T10:00' } })
    fireEvent.change(screen.getByLabelText('پایان برگزاری (UTC)'), { target: { value: '2026-12-02T16:00' } })
    fireEvent.change(screen.getByLabelText('دلیل تغییر'), { target: { value: 'اصلاح عنوان' } })
    fireEvent.change(screen.getByLabelText('عنوان رویداد'), { target: { value: 'پیش‌نویس من' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    expect(await screen.findByText(/نسخه فعلی سرور: 3/)).toBeTruthy()
    expect((screen.getByLabelText('عنوان رویداد') as HTMLInputElement).value).toBe('پیش‌نویس من')
    expect((screen.getByRole('button', { name: 'ذخیره رویداد' }) as HTMLButtonElement).disabled).toBe(true)

    reloaded = true
    fireEvent.click(screen.getByRole('button', { name: 'بررسی نسخه جدید' }))
    await waitFor(() => expect((screen.getByLabelText('عنوان رویداد') as HTMLInputElement).value).toBe('نسخه جدید اول'))
    fireEvent.change(screen.getByLabelText('دلیل تغییر'), { target: { value: 'بازبینی نسخه جدید' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/events?saved=event-updated'))
    expect(lastWrite(request, 'PATCH')!.body).toMatchObject({ revision: 3, reason: 'بازبینی نسخه جدید' })
  })

  it('creates an event and its public page from one form with eligible people only', async () => {
    const request = formFetch()
    vi.stubGlobal('fetch', request)
    render(createElement(OwnerEventForm, { mode: 'create' }))
    fireEvent.change(await screen.findByLabelText('عنوان رویداد'), { target: { value: 'رویداد دوم' } })
    fireEvent.change(screen.getByLabelText('محل برگزاری'), { target: { value: 'بوشهر' } })
    fireEvent.change(screen.getByLabelText('شروع برگزاری (UTC)'), { target: { value: '2026-12-01T08:00' } })
    fireEvent.change(screen.getByLabelText('پایان برگزاری (UTC)'), { target: { value: '2026-12-02T16:00' } })
    fireEvent.change(screen.getByLabelText('شروع ثبت‌نام (UTC)'), { target: { value: '2026-11-01T10:00' } })
    fireEvent.change(screen.getByLabelText('پایان ثبت‌نام (UTC)'), { target: { value: '2026-11-02T10:00' } })
    fireEvent.change(screen.getByLabelText('سردبیر مسئول'), { target: { value: 'chief' } })
    fireEvent.change(screen.getByLabelText('مسئول سرمایه‌گذاری'), { target: { value: 'investment' } })
    expect(screen.queryByRole('option', { name: /سردبیر غیرفعال/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /^کارفرما/ })).toBeNull()
    expect(screen.queryByLabelText('دلیل تغییر')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'ثبت رویداد' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/events?saved=event-created'))
    expect(lastWrite(request, 'POST')).toEqual({
      url: '/api/dashboard/admin/events',
      body: {
        title: 'رویداد دوم',
        description: '',
        location: 'بوشهر',
        startDate: '2026-12-01T08:00:00.000Z',
        endDate: '2026-12-02T16:00:00.000Z',
        status: 'upcoming',
        registrationOpenAt: '2026-11-01T10:00:00.000Z',
        registrationCloseAt: '2026-11-02T10:00:00.000Z',
        responsibleChiefId: 'chief',
        responsibleInvestmentId: 'investment',
      },
    })
  })

  it('completes a public event made in the CMS instead of making a second page', async () => {
    const request = formFetch()
    vi.stubGlobal('fetch', request)
    render(createElement(OwnerEventForm, { mode: 'create', adoptPublicEventId: '12' }))
    expect(((await screen.findByLabelText('عنوان رویداد')) as HTMLInputElement).value).toBe('منتشرشده')
    expect(screen.getByText(/همان صفحه به‌روز و به رویداد متصل می‌شود/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('شروع ثبت‌نام (UTC)'), { target: { value: '2026-11-01T10:00' } })
    fireEvent.change(screen.getByLabelText('پایان ثبت‌نام (UTC)'), { target: { value: '2026-11-02T10:00' } })
    fireEvent.change(screen.getByLabelText('سردبیر مسئول'), { target: { value: 'chief' } })
    fireEvent.change(screen.getByLabelText('مسئول سرمایه‌گذاری'), { target: { value: 'investment' } })
    fireEvent.click(screen.getByRole('button', { name: 'ثبت رویداد' }))
    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(lastWrite(request, 'POST')!.body).toMatchObject({ publicEventId: '12', location: 'بوشهر' })
  })

  it('tells the owner that an event made before S5 gets its public page on save', async () => {
    vi.stubGlobal('fetch', formFetch({ single: () => json({ event: { ...event1, publicEventId: null, public: null } }) }))
    render(createElement(OwnerEventForm, { mode: 'edit', id: 'e1' }))
    expect(await screen.findByText(/هنوز صفحه عمومی ندارد/)).toBeTruthy()
    expect((screen.getByLabelText('محل برگزاری') as HTMLInputElement).value).toBe('')
  })

  it('reports a failed public page write and places server field errors', async () => {
    const request = formFetch({
      patch: (body) =>
        body.location === 'خطا'
          ? json({ error: 'invalid_public_content', fields: ['location'] }, 400)
          : json({ error: 'public_record_failed' }, 502),
    })
    vi.stubGlobal('fetch', request)
    render(createElement(OwnerEventForm, { mode: 'edit', id: 'e1' }))
    fireEvent.change(await screen.findByLabelText('دلیل تغییر'), { target: { value: 'اصلاح' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    expect(await screen.findByText(/صفحه عمومی ذخیره نشد و هیچ تغییری ثبت نشد/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('محل برگزاری'), { target: { value: 'خطا' } })
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره رویداد' }))
    expect(await screen.findByText('سرور این مقدار را نپذیرفت؛ بررسی کنید.')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('owner exhibition form (FE41, T60)', () => {
  it('creates an exhibition with its public page and booth limit', async () => {
    const request = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? json({ exhibition: exhibition1 }, 201) : json({}, 404),
    )
    vi.stubGlobal('fetch', request)
    render(createElement(ExhibitionForm, { mode: 'create' }))
    fireEvent.change(screen.getByLabelText('عنوان نمایشگاه'), { target: { value: 'نمایشگاه نفت' } })
    fireEvent.change(screen.getByLabelText('محل برگزاری'), { target: { value: 'عسلویه' } })
    fireEvent.change(screen.getByLabelText('شروع برگزاری (UTC)'), { target: { value: '2027-01-10T06:00' } })
    fireEvent.change(screen.getByLabelText('پایان برگزاری (UTC)'), { target: { value: '2027-01-09T06:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'ثبت نمایشگاه' }))
    expect(await screen.findByText('پایان برگزاری باید پس از شروع باشد.')).toBeTruthy()
    expect(screen.getByText('سقف غرفه هر شرکت را با عدد صحیح مثبت وارد کنید.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('پایان برگزاری (UTC)'), { target: { value: '2027-01-12T14:00' } })
    fireEvent.change(screen.getByLabelText('سقف غرفه برای هر شرکت'), { target: { value: '۲' } })
    fireEvent.click(screen.getByRole('button', { name: 'ثبت نمایشگاه' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/events?type=exhibition&saved=exhibition-created'))
    expect(lastWrite(request, 'POST')).toEqual({
      url: '/api/dashboard/admin/exhibitions',
      body: {
        title: 'نمایشگاه نفت',
        description: '',
        location: 'عسلویه',
        startDate: '2027-01-10T06:00:00.000Z',
        endDate: '2027-01-12T14:00:00.000Z',
        status: 'upcoming',
        companyBoothLimit: 2,
        guideMapReference: null,
      },
    })
  })

  it('edits with the loaded revision and offers a reload on 409', async () => {
    const latest = { ...exhibition1, title: 'نمایشگاه تازه', revision: 2 }
    let reloaded = false
    const request = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? JSON.parse(init.body as string).revision === 1
          ? json({ error: 'stale_exhibition', revision: 2 }, 409)
          : json({ exhibition: latest })
        : json({ exhibition: reloaded ? latest : exhibition1 }),
    )
    vi.stubGlobal('fetch', request)
    render(createElement(ExhibitionForm, { mode: 'edit', id: '21' }))
    expect(await screen.findByRole('link', { name: 'غرفه‌ها و کاتالوگ' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره نمایشگاه' }))
    expect(await screen.findByText(/نسخه فعلی سرور: 2/)).toBeTruthy()
    reloaded = true
    fireEvent.click(screen.getByRole('button', { name: 'بررسی نسخه جدید' }))
    await waitFor(() => expect((screen.getByLabelText('عنوان نمایشگاه') as HTMLInputElement).value).toBe('نمایشگاه تازه'))
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره نمایشگاه' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/events?type=exhibition&saved=exhibition-updated'))
    expect(lastWrite(request, 'PATCH')).toEqual({
      url: '/api/dashboard/admin/exhibitions/21',
      body: expect.objectContaining({ revision: 2, companyBoothLimit: 2 }),
    })
  })
})
