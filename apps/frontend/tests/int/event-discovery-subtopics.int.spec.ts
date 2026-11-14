// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENT_TAG_VARIANT, EventsView, type EventItem } from '@/components/dashboard/events-view'
import * as dashboardApi from '@/utilities/dashboard-api'
import { chooseOption } from './combobox-helpers'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

const mockEvent: EventItem = {
  id: 'events-uuid-1',
  rawId: '00000000-0000-0000-0000-000000000001',
  serviceKey: 'events',
  title: 'نمایشگاه بین‌المللی انرژی و نوآوری پارس',
  description: 'بزرگ‌ترین گردهمایی صنعتی و فناورانه حوزه انرژی در عسلویه با حضور شرکت‌های دانش‌بنیان.',
  badgeText: 'در حال برگزاری',
  badgeType: 'active',
  dates: '۱۲ تا ۱۵ بهمن ۱۴۰۵',
  location: 'عسلویه، مرکز همایش‌های بین‌المللی',
  hasActionButton: true,
  actionButtonText: 'ثبت درخواست',
}

const mockCategories: dashboardApi.EventCategoryDto[] = [
  {
    id: 'cat-1',
    eventId: '00000000-0000-0000-0000-000000000001',
    title: 'تجهیزات ثابت و دوار',
    createdAt: '2026-10-27T00:00:00Z',
    updatedAt: '2026-10-27T00:00:00Z',
  },
  {
    id: 'cat-2',
    eventId: '00000000-0000-0000-0000-000000000001',
    title: 'دیجیتالیزاسیون و هوش مصنوعی',
    createdAt: '2026-10-27T00:00:00Z',
    updatedAt: '2026-10-27T00:00:00Z',
  },
]

const mockSubtopics: dashboardApi.EventSubtopicDto[] = [
  {
    id: 'sub-1',
    eventId: '00000000-0000-0000-0000-000000000001',
    categoryId: 'cat-1',
    categoryTitle: 'تجهیزات ثابت و دوار',
    title: 'ساخت دستگاه پلیمرزدایی از تاورها',
    employerId: 'employer-user-42',
    currentRfpVersionId: 'rfp-ver-1',
  },
  {
    id: 'sub-2',
    eventId: '00000000-0000-0000-0000-000000000001',
    categoryId: 'cat-1',
    categoryTitle: 'تجهیزات ثابت و دوار',
    title: 'طراحی و ساخت پمپ مگنتی مقاوم به خوردگی',
    employerId: 'employer-user-42',
    currentRfpVersionId: null,
  },
  {
    id: 'sub-3',
    eventId: '00000000-0000-0000-0000-000000000001',
    categoryId: 'cat-2',
    categoryTitle: 'دیجیتالیزاسیون و هوش مصنوعی',
    title: 'سامانه مانیتورینگ هوشمند ارتعاشات توربین',
    employerId: 'employer-user-99',
    currentRfpVersionId: 'rfp-ver-2',
  },
]

const mockRfpVersion: dashboardApi.RfpVersionDto = {
  id: 'rfp-ver-1',
  subtopicId: 'sub-1',
  createdBy: 'owner-user-1',
  createdAt: '2026-10-28T00:00:00Z',
  reason: 'انتشار نسخه اولیه مشخصات فنی و شرایط داوری',
  files: [
    {
      id: 'file-1',
      filename: 'RFP-Polymer-Tower-Specs.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2621440, // 2.5 MB
      policyVersion: '1.0',
    },
  ],
}

describe('dashboard-api event discovery helpers', () => {
  it('formats file sizes in Persian units accurately', () => {
    expect(dashboardApi.formatFileSize(0)).toBe('۰ بایت')
    expect(dashboardApi.formatFileSize(500)).toContain('بایت')
    expect(dashboardApi.formatFileSize(2048)).toContain('کیلوبایت')
    expect(dashboardApi.formatFileSize(2621440)).toContain('مگابایت')
  })

  it('generates correct RFP download URLs with parameter encoding', () => {
    const url = dashboardApi.getRfpDownloadUrl(
      'event-1',
      'sub-1',
      'ver-1',
      'file-1',
    )
    expect(url).toBe('/api/dashboard/events/event-1/subtopics/sub-1/rfp/ver-1/files/file-1')
  })
})

describe('EventsView FE11 - Event discovery, subtopic selection and RFP reading', () => {
  beforeEach(() => {
    mockPush.mockReset()
    vi.spyOn(dashboardApi, 'getEventCategories').mockResolvedValue({ items: mockCategories })
    vi.spyOn(dashboardApi, 'getEventSubtopics').mockResolvedValue({ items: mockSubtopics })
    vi.spyOn(dashboardApi, 'getSubtopicRfp').mockResolvedValue({ version: mockRfpVersion })
    // FE06 gates registration on the server's company verification; these cases cover an approved company.
    vi.spyOn(dashboardApi, 'fetchCompanyVerification').mockResolvedValue({
      status: 'approved',
      revision: 1,
      submittedAt: null,
      decidedAt: null,
      reason: null,
      canRequestVerification: false,
    })
    vi.spyOn(dashboardApi, 'fetchProfileDossier').mockResolvedValue({
      dossier: {} as dashboardApi.CompanyDossierDto,
      documents: [],
      missing: { required: [], optional: [], canRequestVerification: true },
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the initial events list and navigates to event discovery on selection', async () => {
    render(createElement(EventsView, { initialEventsList: [mockEvent] }))

    expect(screen.getByText('نمایشگاه بین‌المللی انرژی و نوآوری پارس')).toBeDefined()
    expect(screen.getByText('۱۲ تا ۱۵ بهمن ۱۴۰۵')).toBeDefined()

    // Clicking "ثبت درخواست" opens the event discovery detail view (Figma 49:7968)
    const actionBtn = screen.getByRole('button', { name: /ثبت درخواست/i })
    fireEvent.click(actionBtn)

    // Breadcrumb and event detail header appear
    await waitFor(() => {
      expect(screen.getByText('عنوان ها و زیر عنوان های رویداد')).toBeDefined()
    })
    expect(screen.getByText('تجهیزات ثابت و دوار')).toBeDefined()
    expect(screen.getByText('دیجیتالیزاسیون و هوش مصنوعی')).toBeDefined()
  })

  it('renders categories and nested subtopics hierarchy', async () => {
    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('تجهیزات ثابت و دوار')).toBeDefined()
    })

    // Subtopics of category 1 should be visible
    expect(screen.getByText('ساخت دستگاه پلیمرزدایی از تاورها')).toBeDefined()
    expect(screen.getByText('طراحی و ساخت پمپ مگنتی مقاوم به خوردگی')).toBeDefined()
  })

  it('does not present the raw employer user id as an employer identity', async () => {
    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('ساخت دستگاه پلیمرزدایی از تاورها')).toBeDefined()
    })
    expect(screen.queryByText(/employer-user-42/)).toBeNull()
  })

  it('downloads subtopic RFP and displays file information', async () => {
    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('ساخت دستگاه پلیمرزدایی از تاورها')).toBeDefined()
    })

    // Click on RFP button for subtopic 1
    const rfpButton = screen.getByRole('button', {
      name: /ساخت دستگاه پلیمرزدایی از تاورها/i,
    })
    fireEvent.click(rfpButton)

    await waitFor(() => {
      expect(screen.getByText('RFP-Polymer-Tower-Specs.pdf')).toBeDefined()
    })
    expect(screen.getByRole('link', { name: /دانلود/i })).toBeDefined()
  })

  it('handles subtopics without uploaded RFP files gracefully', async () => {
    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('طراحی و ساخت پمپ مگنتی مقاوم به خوردگی')).toBeDefined()
    })

    // Click on RFP button for subtopic 2 (which has currentRfpVersionId: null)
    const rfpButton2 = screen.getByRole('button', {
      name: /طراحی و ساخت پمپ مگنتی مقاوم به خوردگی/i,
    })
    fireEvent.click(rfpButton2)

    await waitFor(() => {
      expect(screen.getByText('فایل RFP بارگذاری نشده است')).toBeDefined()
    })
  })

  it('opens a title and subtitle popup on «ثبت نام» and continues to the application for the chosen subtitle', async () => {
    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('ساخت دستگاه پلیمرزدایی از تاورها')).toBeDefined()
    })
    expect(screen.queryByRole('checkbox')).toBeNull()

    const registerBtn = screen.getByRole('button', { name: 'ثبت نام' })
    await waitFor(() => expect((registerBtn as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(registerBtn)
    expect(mockPush).not.toHaveBeenCalled()

    expect(screen.getByText('انتخاب عنوان')).toBeDefined()
    chooseOption(screen.getByLabelText('عنوان'), 'دیجیتالیزاسیون و هوش مصنوعی')
    chooseOption(screen.getByLabelText('زیر عنوان'), 'سامانه مانیتورینگ هوشمند ارتعاشات توربین')

    fireEvent.click(screen.getByRole('button', { name: 'تایید' }))
    expect(mockPush).toHaveBeenCalledWith(
      `/dashboard/new-request?service=events&eventId=${encodeURIComponent(mockEvent.rawId!)}&subtopicId=sub-3`,
    )
  })

  it('renders empty and error states for categories gracefully', async () => {
    vi.spyOn(dashboardApi, 'getEventCategories').mockRejectedValueOnce(
      new Error('Network error'),
    )

    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('خطا در دریافت عناوین و زیرعنوان‌ها')).toBeDefined()
    })

    const retryBtn = screen.getByRole('button', { name: /تلاش دوباره/i })
    expect(retryBtn).toBeDefined()
  })

  it('allows breadcrumb return back to event list', async () => {
    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('عنوان ها و زیر عنوان های رویداد')).toBeDefined()
    })

    const breadcrumbBack = screen.getByRole('button', { name: /بازگشت به رویدادها و نمایشگاه‌ها/i })
    fireEvent.click(breadcrumbBack)

    await waitFor(() => {
      expect(screen.queryByText('عنوان ها و زیر عنوان های رویداد')).toBeNull()
    })
    expect(screen.getByText('نمایشگاه بین‌المللی انرژی و نوآوری پارس')).toBeDefined()
  })

  it.each([
    [403, 'دسترسی به عناوین و زیرعنوان‌های این رویداد مجاز نیست.'],
    [404, 'عناوین این رویداد برای حساب شما در دسترس نیست.'],
    [401, 'نشست شما پایان یافته است. برای مشاهده عناوین دوباره وارد شوید.'],
  ])('explains a %i hierarchy response instead of showing an empty event', async (status, copy) => {
    vi.spyOn(dashboardApi, 'getEventCategories').mockRejectedValueOnce(
      new dashboardApi.DashboardApiError(status, 'not_found'),
    )

    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText(copy)).toBeDefined()
    })
    expect(screen.queryByText('هیچ عنوان یا زیرعنوانی برای این رویداد تعریف نشده است.')).toBeNull()
  })

  it('reports a denied RFP read separately from a missing RFP', async () => {
    vi.spyOn(dashboardApi, 'getSubtopicRfp').mockRejectedValueOnce(
      new dashboardApi.DashboardApiError(403, 'forbidden'),
    )

    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    const open = await screen.findByRole('button', {
      name: 'ساخت دستگاه پلیمرزدایی از تاورها',
    })
    fireEvent.click(open)

    await waitFor(() => {
      expect(screen.getByText('دسترسی به فایل RFP این زیرعنوان امکان‌پذیر نیست.')).toBeDefined()
    })
    expect(screen.queryByText('فایل RFP بارگذاری نشده است')).toBeNull()
  })
})

describe('EventsView design QA #276 - shared list toolbar, card click and event page filter', () => {
  const older: EventItem = {
    ...mockEvent,
    id: 'events-uuid-0',
    rawId: '00000000-0000-0000-0000-000000000000',
    title: 'رویداد قدیمی',
    badgeText: 'تمام شده',
    badgeType: 'ended',
    hasActionButton: false,
    startTimestamp: 1,
  }
  const newer: EventItem = { ...mockEvent, startTimestamp: 2 }

  beforeEach(() => {
    mockPush.mockReset()
    vi.spyOn(dashboardApi, 'getEventCategories').mockResolvedValue({ items: mockCategories })
    vi.spyOn(dashboardApi, 'getEventSubtopics').mockResolvedValue({ items: mockSubtopics })
    vi.spyOn(dashboardApi, 'fetchCompanyVerification').mockResolvedValue({
      status: 'approved',
      revision: 1,
      submittedAt: null,
      decidedAt: null,
      reason: null,
      canRequestVerification: false,
    })
    vi.spyOn(dashboardApi, 'fetchProfileDossier').mockResolvedValue({
      dossier: {} as dashboardApi.CompanyDossierDto,
      documents: [],
      missing: { required: [], optional: [], canRequestVerification: true },
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('puts search and the filter template at the start of the toolbar', () => {
    const { container } = render(createElement(EventsView, { initialEventsList: [newer] }))
    const group = container.querySelector('[data-slot="list-toolbar"]')!.firstElementChild!
    expect(group.querySelector('input[type="search"]')).toBeTruthy()
    expect(group.querySelector('button[aria-label^="فیلتر رویدادها"]')).toBeTruthy()
  })

  it('opens an event from a click anywhere on its card; only a card with no page behind it stays inert', async () => {
    // An upcoming public page with no operational event takes no applications and has nowhere to go.
    const idle: EventItem = {
      ...mockEvent,
      id: 'events-uuid-2',
      rawId: undefined,
      title: 'رویداد بدون پرونده عملیاتی',
      badgeType: 'upcoming',
      hasActionButton: false,
      startTimestamp: 0,
    }
    render(createElement(EventsView, { initialEventsList: [idle, older, newer] }))
    const cards = screen.getAllByRole('article')
    // Newest first: the card with the registration button, then the ended one (its page is read-only).
    expect(cards[0]!.getAttribute('data-row-link')).not.toBeNull()
    expect(cards[1]!.getAttribute('data-row-link')).not.toBeNull()
    expect(cards[1]!.className).toContain('hover:bg-neutral-50')
    expect(cards[2]!.getAttribute('data-row-link')).toBeNull()
    expect(cards[2]!.className).not.toContain('hover:bg-neutral-50')

    fireEvent.click(within(cards[0]!).getByText('عسلویه، مرکز همایش‌های بین‌المللی'))
    expect(mockPush).toHaveBeenCalledWith(`/dashboard/events?eventId=${newer.rawId}`)
    await waitFor(() => expect(screen.getByText('عنوان ها و زیر عنوان های رویداد')).toBeDefined())
  })

  it('orders the list from the filter template, and filters by status only after «اعمال»', () => {
    render(createElement(EventsView, { initialEventsList: [older, newer] }))
    const titles = () => screen.getAllByRole('article').map((card) => within(card).getByRole('heading').textContent)
    expect(titles()).toEqual([newer.title, older.title])

    fireEvent.click(screen.getByRole('button', { name: /فیلتر رویدادها/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'قدیمی ترین رویداد ها' }))
    expect(titles()).toEqual([newer.title, older.title])
    fireEvent.click(screen.getByRole('button', { name: 'اعمال' }))
    expect(titles()).toEqual([older.title, newer.title])

    fireEvent.click(screen.getByRole('button', { name: /فیلتر رویدادها/ }))
    chooseOption(screen.getByRole('combobox', { name: 'وضعیت رویداد' }), /تمام شده/)
    fireEvent.click(screen.getByRole('button', { name: 'اعمال' }))
    expect(titles()).toEqual([older.title])
  })

})

describe('EventsView design QA #281 - card typography, status tags and spacing', () => {
  const ended: EventItem = {
    ...mockEvent,
    id: 'events-ended',
    rawId: 'ended-1',
    title: 'رویداد تمام شده',
    badgeText: 'تمام شده',
    badgeType: 'ended',
    hasActionButton: false,
    startTimestamp: 1,
  }
  const active: EventItem = { ...mockEvent, startTimestamp: 2 }
  const upcoming: EventItem = {
    ...mockEvent,
    id: 'events-upcoming',
    rawId: 'upcoming-1',
    title: 'رویداد پیش رو',
    badgeText: 'پیش‌رو',
    badgeType: 'upcoming',
    startTimestamp: 3,
  }

  beforeEach(() => {
    mockPush.mockReset()
    vi.spyOn(dashboardApi, 'getEventCategories').mockResolvedValue({ items: [] })
    vi.spyOn(dashboardApi, 'getEventSubtopics').mockResolvedValue({ items: [] })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('maps the three event statuses to the secondary, primary and gray tags', () => {
    expect(EVENT_TAG_VARIANT).toEqual({ upcoming: 'secondary', active: 'primary', ended: 'gray' })
    render(createElement(EventsView, { initialEventsList: [ended, active, upcoming] }))
    const tagIn = (title: string, label: string) =>
      within(screen.getByRole('heading', { name: title }).closest('article')!).getByText(label)
    expect(tagIn(upcoming.title, 'پیش‌رو').getAttribute('data-variant')).toBe('secondary')
    expect(tagIn(active.title, 'در حال برگزاری').getAttribute('data-variant')).toBe('primary')
    expect(tagIn(ended.title, 'تمام شده').getAttribute('data-variant')).toBe('gray')
    expect(tagIn(ended.title, 'تمام شده').getAttribute('data-slot')).toBe('badge')
  })

  it('uses the same status tag on the event page', async () => {
    render(createElement(EventsView, { initialEventsList: [upcoming], initialSelectedEventId: upcoming.rawId }))
    expect(screen.getByText('پیش‌رو').getAttribute('data-variant')).toBe('secondary')
    await waitFor(() => expect(dashboardApi.getEventCategories).toHaveBeenCalled())
  })

  it('sets the date and place in the 16/semibold body style, neutral-600, icon first', () => {
    render(createElement(EventsView, { initialEventsList: [active] }))
    const card = screen.getByRole('article')
    for (const text of [active.dates, active.location]) {
      const node = within(card).getByText(text)
      expect(node.getAttribute('data-variant')).toBe('16/semibold')
      expect(node.className).toContain('text-neutral-600')
      // The icon is the first child of the row, so it sits on the right in RTL.
      expect(node.previousElementSibling?.tagName.toLowerCase()).toBe('svg')
      expect(node.parentElement!.firstElementChild).toBe(node.previousElementSibling)
    }
    expect(within(card).getByText(active.dates).parentElement!.parentElement!.className).toContain('gap-4')
  })

  it('puts the tick icon of «ثبت درخواست» before the label, which is the right side in RTL', () => {
    const { container } = render(createElement(EventsView, { initialEventsList: [active] }))
    expect(container.querySelector('[dir="rtl"]')).toBeTruthy()
    const button = screen.getByRole('button', { name: 'ثبت درخواست' })
    expect(button.children).toHaveLength(2)
    expect(button.children[0]!.tagName.toLowerCase()).toBe('svg')
    expect(button.children[1]!.textContent).toBe('ثبت درخواست')
    expect(button.children[1]!.getAttribute('data-variant')).toBe('16/semibold')
  })

  it('shows the register button on the event page as the plain «ثبت نام» label (Figma 31981:77644)', async () => {
    render(createElement(EventsView, { initialEventsList: [active], initialSelectedEventId: active.rawId }))
    const button = screen.getByRole('button', { name: 'ثبت نام' })
    expect(button.querySelector('svg')).toBeNull()
    await waitFor(() => expect(dashboardApi.getEventCategories).toHaveBeenCalled())
  })

  it('leaves 16px between the cards of the list and of its skeleton', () => {
    const { container, rerender } = render(createElement(EventsView, { initialEventsList: [ended, active, upcoming] }))
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(3)
    expect(cards[0]!.parentElement!.className).toContain('gap-4')
    expect(cards[0]!.parentElement!.className).not.toContain('gap-[32px]')
    rerender(createElement(EventsView, { initialEventsList: [active], state: 'loading' }))
    expect(container.querySelector('[role="status"]')!.className).toContain('gap-4')
  })

  it('uses no physical margin, padding or text-alignment classes', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/dashboard/events-view.tsx'), 'utf8')
    expect(source).not.toMatch(/["'\s](?:[a-z]+:)?-?[mp][lr]-\S/)
    expect(source).not.toMatch(/["'\s]text-(?:left|right)["'\s]/)
    expect(source).toContain('ms-6')
  })
})
