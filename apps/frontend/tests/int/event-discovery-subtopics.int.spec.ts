// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventsView, type EventItem } from '@/components/dashboard/events-view'
import * as dashboardApi from '@/utilities/dashboard-api'

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

  it('shows employer identity where available', async () => {
    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    await waitFor(() => {
      expect(screen.getAllByText(/employer-user-42/).length).toBeGreaterThan(0)
    })
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
      name: /دریافت فایل RFP برای ساخت دستگاه پلیمرزدایی از تاورها|مشاهده و دانلود RFP/i,
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
      name: /دریافت فایل RFP برای طراحی و ساخت پمپ مگنتی مقاوم به خوردگی/i,
    })
    fireEvent.click(rfpButton2)

    await waitFor(() => {
      expect(screen.getByText('فایل RFP بارگذاری نشده است')).toBeDefined()
    })
  })

  it('allows multi-selection of subtopics and warns each becomes a separate application', async () => {
    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('ساخت دستگاه پلیمرزدایی از تاورها')).toBeDefined()
    })

    // Must clearly state each selected subtopic becomes a separate application
    expect(
      screen.getByText(/برای هر زیرعنوان انتخاب‌شده، یک پرونده و کد رهگیری جداگانه تشکیل خواهد شد/i),
    ).toBeDefined()

    // Select subtopic 1
    const checkbox1 = screen.getByRole('checkbox', {
      name: /انتخاب زیرعنوان ساخت دستگاه پلیمرزدایی از تاورها/i,
    }) as HTMLInputElement
    fireEvent.click(checkbox1)
    expect(checkbox1.checked).toBe(true)

    // Select subtopic 2
    const checkbox2 = screen.getByRole('checkbox', {
      name: /انتخاب زیرعنوان طراحی و ساخت پمپ مگنتی مقاوم به خوردگی/i,
    }) as HTMLInputElement
    fireEvent.click(checkbox2)
    expect(checkbox2.checked).toBe(true)

    // Counter badge shows 2 selected
    expect(screen.getByText(/۲ زیرعنوان انتخاب شده/i)).toBeDefined()

    // Register button reflects count
    const registerBtn = screen.getByRole('button', { name: /ثبت درخواست \(۲ زیرعنوان\)/i })
    expect(registerBtn).toBeDefined()

    // Clicking register passes real server IDs
    fireEvent.click(registerBtn)
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining(
        `eventId=${encodeURIComponent(mockEvent.rawId!)}&subtopicId=sub-1%2Csub-2`,
      ),
    )
  })

  it('provides quick selection modal matching Figma Frame 120', async () => {
    render(
      createElement(EventsView, {
        initialEventsList: [mockEvent],
        initialSelectedEventId: mockEvent.rawId,
      }),
    )

    await waitFor(() => {
      expect(screen.getByText('عنوان ها و زیر عنوان های رویداد')).toBeDefined()
    })

    // Open quick select modal
    const modalTrigger = screen.getByRole('button', { name: /انتخاب سریع عنوان/i })
    fireEvent.click(modalTrigger)

    // Modal appears with title "انتخاب عنوان"
    expect(screen.getByText('انتخاب عنوان')).toBeDefined()
    expect(
      screen.getByText('برای مشاهده فرم عنوان و زیر عنوان مورد نظر خود را انتخاب کنید.'),
    ).toBeDefined()

    // Select category and subtopic in modal
    const catSelect = screen.getByLabelText('عنوان')
    fireEvent.change(catSelect, { target: { value: 'cat-2' } })

    const subSelect = screen.getByLabelText('زیر عنوان')
    fireEvent.change(subSelect, { target: { value: 'sub-3' } })

    // Confirm selection
    const confirmBtn = screen.getByRole('button', { name: /^تایید$/i })
    fireEvent.click(confirmBtn)

    // Subtopic 3 is now selected
    await waitFor(() => {
      expect(screen.getByText(/۱ زیرعنوان انتخاب شده/i)).toBeDefined()
    })
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
})
