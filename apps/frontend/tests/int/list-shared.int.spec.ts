// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ListFilterButton, type ListFilterGroup } from '@/components/dashboard/list-filter-button'
import { RowActions } from '@/components/dashboard/list-row-actions'
import { ListRow, ListTableFrame } from '@/components/dashboard/list-table'
import { ListToolbar } from '@/components/dashboard/list-toolbar'
import { RequestsFilters, RequestsListView, type RequestItem } from '@/components/dashboard/requests'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, refresh: vi.fn() }),
  usePathname: () => '/dashboard/requests',
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const groups: ListFilterGroup[] = [
  {
    key: 'status',
    label: 'وضعیت درخواست',
    value: 'approved',
    options: [
      { value: '', label: 'همه', count: 5 },
      { value: 'approved', label: 'تایید شده', count: 2 },
      { value: 'rejected', label: 'رد شده', count: 1 },
    ],
  },
  {
    key: 'sort',
    label: 'مرتب سازی بر اساس',
    kind: 'radio',
    options: [
      { value: '', label: 'جدیدترین' },
      { value: 'oldest', label: 'قدیمی ترین' },
    ],
  },
]

describe('ListFilterButton (the one filter template)', () => {
  it('opens Figma’s panel: title, a labelled field per filter, a sort block, apply and cancel', () => {
    render(createElement(ListFilterButton, { groups, label: 'فیلتر درخواست‌ها' }))
    // One applied filter; a sort order is not a filter.
    const trigger = screen.getByRole('button', { name: 'فیلتر درخواست‌ها (۱ فیلتر فعال)' })
    fireEvent.click(trigger)

    const panel = screen.getByRole('dialog', { name: 'فیلتر درخواست‌ها' })
    expect(within(panel).getByRole('heading', { name: 'فیلتر' })).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'بستن فیلتر' })).toBeTruthy()
    const status = within(panel).getByRole('combobox', { name: 'وضعیت درخواست' }) as HTMLSelectElement
    expect(status.value).toBe('approved')
    expect(within(status).getByRole('option', { name: /تایید شده/ }).textContent).toContain('۲')
    expect(within(panel).getByRole('radiogroup', { name: 'مرتب سازی بر اساس' })).toBeTruthy()
    // The primary action comes first in the DOM: it sits on the right of the RTL panel.
    const buttons = within(panel).getAllByRole('button').map((button) => button.textContent)
    expect(buttons.indexOf('اعمال')).toBeLessThan(buttons.indexOf('لغو'))
  })

  it('changes nothing until «اعمال», then writes every choice to the URL at once and restarts at page 1', () => {
    window.history.replaceState({}, '', '/dashboard/requests?page=3&search=abc')
    render(createElement(ListFilterButton, { groups }))
    fireEvent.click(screen.getByRole('button', { name: /فیلتر/ }))

    fireEvent.change(screen.getByRole('combobox', { name: 'وضعیت درخواست' }), { target: { value: 'rejected' } })
    fireEvent.click(screen.getByRole('radio', { name: 'قدیمی ترین' }))
    expect(nav.push).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'اعمال' }))
    expect(nav.push).toHaveBeenCalledTimes(1)
    const target = new URL(String(nav.push.mock.calls[0]![0]), 'http://localhost')
    expect(target.pathname).toBe('/dashboard/requests')
    expect(Object.fromEntries(target.searchParams)).toEqual({ search: 'abc', status: 'rejected', sort: 'oldest' })
  })

  it('drops the draft on «لغو» and on the close icon', () => {
    const onChange = vi.fn()
    render(createElement(ListFilterButton, { groups, onChange }))
    const open = () => fireEvent.click(screen.getByRole('button', { name: /فیلتر/ }))

    open()
    fireEvent.change(screen.getByRole('combobox', { name: 'وضعیت درخواست' }), { target: { value: 'rejected' } })
    fireEvent.click(screen.getByRole('button', { name: 'لغو' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    open()
    expect((screen.getByRole('combobox', { name: 'وضعیت درخواست' }) as HTMLSelectElement).value).toBe('approved')
    fireEvent.click(screen.getByRole('button', { name: 'بستن فیلتر' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('hands a client list only the changed filters', () => {
    const onChange = vi.fn()
    render(createElement(ListFilterButton, { groups, onChange }))
    fireEvent.click(screen.getByRole('button', { name: /فیلتر/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'وضعیت درخواست' }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'اعمال' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('status', undefined)
  })
})

describe('ListToolbar', () => {
  it('puts search and filter first (the RTL right) and the page actions after them', () => {
    render(
      createElement(ListToolbar, {
        search: createElement('input', { 'aria-label': 'search' }),
        filter: createElement('button', { type: 'button' }, 'filter'),
        actions: createElement('button', { type: 'button' }, 'create'),
      }),
    )
    const order = Array.from(document.querySelectorAll('[data-slot="list-toolbar"] input, [data-slot="list-toolbar"] button')).map(
      (node) => node.getAttribute('aria-label') ?? node.textContent,
    )
    expect(order).toEqual(['search', 'filter', 'create'])
    expect(document.querySelector('[data-slot="list-toolbar"]')!.getAttribute('dir')).toBe('rtl')
  })
})

describe('ListRow (row hover and click)', () => {
  const renderRow = () =>
    render(
      createElement(
        ListTableFrame,
        null,
        createElement(
          'table',
          null,
          createElement(
            'tbody',
            null,
            createElement(
              ListRow,
              { href: '/dashboard/requests/r-1' },
              createElement(
                'td',
                null,
                createElement('span', null, 'cell text'),
                createElement('a', { href: '/elsewhere', onClick: (event: { preventDefault: () => void }) => event.preventDefault() }, 'inner link'),
                createElement('button', { type: 'button' }, 'inner button'),
              ),
            ),
          ),
        ),
      ),
    )

  it('has the hover and focus styles and is a keyboard stop', () => {
    renderRow()
    const row = screen.getAllByRole('row')[0]!
    expect(row.className).toContain('hover:bg-neutral-50')
    expect(row.className).toContain('focus-visible:outline-2')
    expect(row.className).toContain('cursor-pointer')
    expect(row.getAttribute('tabindex')).toBe('0')
  })

  it('opens its page on a click or Enter anywhere on the row', () => {
    renderRow()
    fireEvent.click(screen.getByText('cell text'))
    expect(nav.push).toHaveBeenCalledWith('/dashboard/requests/r-1')
    nav.push.mockClear()

    const row = screen.getAllByRole('row')[0]!
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(nav.push).toHaveBeenCalledWith('/dashboard/requests/r-1')
  })

  it('leaves inner links and buttons to their own action', () => {
    renderRow()
    fireEvent.click(screen.getByText('inner link'))
    fireEvent.click(screen.getByText('inner button'))
    // Enter on an inner control is the control's, not the row's.
    fireEvent.keyDown(screen.getByText('inner button'), { key: 'Enter' })
    expect(nav.push).not.toHaveBeenCalled()
  })

  it('fills the page height instead of hugging its rows', () => {
    const { container } = renderRow()
    const frame = container.querySelector('[data-slot="list-table-frame"]')!
    expect(frame.className).toContain('flex-1')
    expect(frame.className).toContain('min-h-0')
  })
})

describe('RowActions', () => {
  it('shows a lone action directly, with no «more» menu', () => {
    render(createElement(RowActions, { actions: [{ id: 'view', label: 'مشاهده', href: '/dashboard/requests/r-1' }] }))
    expect(screen.queryByRole('button', { name: 'عملیات' })).toBeNull()
    expect(screen.getByRole('link', { name: 'مشاهده' }).getAttribute('href')).toBe('/dashboard/requests/r-1')
  })

  it('keeps a «more» menu for two or more, and closes it after the choice', () => {
    const onSelect = vi.fn()
    render(
      createElement(RowActions, {
        actions: [
          { id: 'view', label: 'مشاهده', href: '/dashboard/requests/r-1' },
          { id: 'delete', label: 'حذف', destructive: true, onSelect },
        ],
      }),
    )
    expect(screen.queryByRole('link', { name: 'مشاهده' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'عملیات' }))
    expect(screen.getByRole('link', { name: 'مشاهده' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'حذف' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'حذف' })).toBeNull()
  })

  it('does not trigger the row click when an action is chosen', () => {
    const onSelect = vi.fn()
    render(
      createElement(
        'table',
        null,
        createElement(
          'tbody',
          null,
          createElement(
            ListRow,
            { href: '/dashboard/requests/r-1' },
            createElement(
              'td',
              null,
              createElement(RowActions, {
                actions: [
                  { id: 'a', label: 'اول', onSelect },
                  { id: 'b', label: 'دوم', onSelect },
                ],
              }),
            ),
          ),
        ),
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'عملیات' }))
    fireEvent.click(screen.getByRole('button', { name: 'اول' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(nav.push).not.toHaveBeenCalled()
  })
})

describe('the company request list', () => {
  const item: RequestItem = {
    id: 'req-1',
    trackingCode: 'T-1',
    title: 'همایش نفت و گاز',
    status: 'in_review',
    statusLabel: 'در حال بررسی',
    currentStep: 'review',
    allowedActions: [],
    dueDate: '۱۴۰۵/۰۱/۰۶',
    createdDate: '۱۴۰۵/۰۱/۰۶',
  }

  it('opens the dossier from the whole row and shows its one action directly', () => {
    render(createElement(RequestsListView, { items: [item], state: 'default' }))
    // One action: no «more» menu, the action itself.
    expect(screen.queryByRole('button', { name: 'عملیات بیشتر' })).toBeNull()
    expect(screen.getAllByRole('link', { name: 'مشاهده' })[0]!.getAttribute('href')).toBe('/dashboard/requests/req-1')

    fireEvent.click(screen.getByText('کد پیگیری: T-1'))
    expect(nav.push).toHaveBeenCalledWith('/dashboard/requests/req-1')
  })

  it('puts the search and filter at the start of the toolbar, above a frame that fills the height', () => {
    const { container } = render(
      createElement(RequestsListView, {
        items: [item],
        state: 'default',
        filterForm: createElement('input', { 'aria-label': 'search' }),
      }),
    )
    const toolbar = container.querySelector('[data-slot="list-toolbar"]')!
    expect(toolbar.firstElementChild!.querySelector('input')).toBeTruthy()
    expect(container.querySelector('[data-slot="list-table-frame"]')!.className).toContain('flex-1')
  })
})

describe('design QA round 2', () => {
  it('keeps option keys unique when a real option is named «all»', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      createElement(ListFilterButton, {
        groups: [
          {
            key: 'view',
            label: 'نمای صف',
            options: [
              { value: '', label: 'در انتظار' },
              { value: 'closed', label: 'بسته‌شده' },
              { value: 'all', label: 'همه' },
            ],
          },
          {
            key: 'sort',
            label: 'مرتب سازی',
            kind: 'radio',
            options: [
              { value: '', label: 'جدیدترین' },
              { value: 'all', label: 'همه' },
            ],
          },
        ],
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /فیلتر/ }))
    const duplicate = errors.mock.calls.filter((call) => String(call[0]).includes('same key'))
    errors.mockRestore()
    expect(duplicate).toHaveLength(0)
    // Radios keep their own ids too, so each label points at its own radio.
    expect(screen.getByRole('radio', { name: 'همه' })).toBeTruthy()
  })

  it('wraps the toolbar so the search field keeps a full line on a phone', () => {
    const { container } = render(
      createElement(ListToolbar, {
        search: createElement(RequestsFilters, { filters: {}, events: [] }),
      }),
    )
    const group = container.querySelector('[data-slot="list-toolbar"]')!.firstElementChild!
    expect(group.className).toContain('flex-wrap')
    // The form around the search field takes the whole line below `sm`, never a shrinking flex share.
    const form = group.querySelector('form[role="search"]')!
    expect(form.className).toContain('w-full')
    expect(form.className).not.toContain('flex-1')
    expect(screen.getByRole('searchbox').getAttribute('placeholder')).toBe('درخواست خود را جست و جو کنید')
  })

  it('draws the radio as Figma 32291:40807: a white ring when off, a filled brand circle with a check when on', () => {
    render(
      createElement(
        RadioGroup,
        { defaultValue: 'a' },
        createElement(RadioGroupItem, { value: 'a', 'aria-label': 'on' }),
        createElement(RadioGroupItem, { value: 'b', 'aria-label': 'off' }),
      ),
    )
    const on = screen.getByRole('radio', { name: 'on' })
    const off = screen.getByRole('radio', { name: 'off' })
    for (const radio of [on, off]) {
      expect(radio.className).toContain('border-[1.5px]')
      expect(radio.className).toContain('border-neutral-200')
      expect(radio.className).toContain('data-[state=checked]:bg-brand-500')
    }
    expect(on.querySelector('svg')).toBeTruthy()
    expect(off.querySelector('svg')).toBeNull()
  })

  it('opens the filter panel with the neutral-100 border and the Figma shadow token', () => {
    render(createElement(ListFilterButton, { groups }))
    fireEvent.click(screen.getByRole('button', { name: /فیلتر/ }))
    const panel = screen.getByRole('dialog')
    expect(panel.className).toContain('border-neutral-100')
    expect(panel.className).toContain('shadow-filter-panel')
  })
})
