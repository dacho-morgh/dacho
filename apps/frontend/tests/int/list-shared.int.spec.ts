// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ListFilterButton, type ListFilterGroup } from '@/components/dashboard/list-filter-button'
import { RowActions } from '@/components/dashboard/list-row-actions'
import { ListRow, ListTableFrame } from '@/components/dashboard/list-table'
import { ListToolbar } from '@/components/dashboard/list-toolbar'
import { RequestsListView, type RequestItem } from '@/components/dashboard/requests'

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
